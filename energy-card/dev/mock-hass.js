/**
 * Mock-Instanz von Home Assistant für die lokale Entwicklung.
 *
 * Bildet die drei WebSocket-Befehle nach, die die Karte benutzt, und leitet
 * alles aus einer einzigen Lastfunktion `powerAt(t)` ab — so verhalten sich
 * Rohhistorie, 5-Minuten- und Stundenstatistik zueinander konsistent, genau
 * wie beim echten Recorder.
 *
 * Die Verläufe der letzten Stunde sind den Referenz-Screenshots nachempfunden
 * (IMG_4945 Niedriglast, IMG_4950 Hochlast), damit der optische Abgleich
 * überhaupt möglich ist.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* ------------------------------------------------------------------ *
 * Deterministischer Zufall
 * ------------------------------------------------------------------ */

function hash(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const noise = (t, scale) => hash(Math.floor(t / scale));

/* ------------------------------------------------------------------ *
 * Grundlastprofil — ein plausibler Haushalt
 * ------------------------------------------------------------------ */

function baseLoad(t) {
  const date = new Date(t);
  const hour = date.getHours() + date.getMinutes() / 60;
  const dayIndex = Math.floor(t / DAY);

  let watt = 40; // Standby: Router, Kühlschrank, Netzteile

  // Tagesgang
  if (hour >= 6.5 && hour < 9) watt += 120 + 60 * Math.sin((hour - 6.5) * 1.2);
  else if (hour >= 9 && hour < 17) watt += 55 + 25 * noise(t, 20 * MINUTE);
  else if (hour >= 17 && hour < 23) watt += 130 + 70 * Math.sin((hour - 17) * 0.5);

  // Kühlschrank-Kompressor, etwa alle 40 Minuten für 12 Minuten
  const cycle = (t % (40 * MINUTE)) / MINUTE;
  if (cycle < 12) watt += 65;

  // Kochen am Abend
  if (hour >= 18 && hour < 19.2 && noise(dayIndex, 1) > 0.25) {
    watt += 1400 + 600 * Math.sin((hour - 18) * 4);
  }

  // Waschmaschine oder Backofen, ein paar Mal pro Woche
  if (hour >= 10 && hour < 12 && noise(dayIndex * 7, 1) > 0.55) {
    watt += 900 + 500 * Math.sin((hour - 10) * 3.1);
  }

  // Wasserkocher: kurze, hohe Spitzen
  if (noise(t, 3 * MINUTE) > 0.985) watt += 1900;

  watt += (noise(t, 30_000) - 0.5) * 14;
  return Math.max(38, watt);
}

/* ------------------------------------------------------------------ *
 * Szenarien für die letzte Stunde
 *
 * Stützstellen in Minuten vor „jetzt". Zwischen zwei Stützstellen wird
 * linear interpoliert, sofern die zweite nicht als Stufe markiert ist.
 * ------------------------------------------------------------------ */

const SCENARIOS = {
  // IMG_4945: ruhiger Abend, zwei Plateaus um 70 W, Grundlast 41 W
  low: [
    [64, 40], [59.4, 40], [59.2, 78, "step"], [58.8, 71],
    [52, 70], [45, 69], [38, 68], [34, 67], [32.5, 66],
    [32.2, 41, "step"], [24.5, 41.5],
    [24.2, 70, "step"], [20, 71], [16, 70], [12, 70.5],
    [10.2, 70], [9.8, 85, "step"], [9.4, 71],
    [7.4, 71], [7.1, 41, "step"], [0, 40.6],
  ],
  // IMG_4950: Grundlast steigt auf ~160 W, am Ende springt ein Verbraucher
  // mit gut 800 W dazu
  high: [
    [62, 40], [55, 42], [52, 47], [48, 48],
    [47.6, 52, "step"], [45.5, 52],
    [45.2, 168, "step"], [44, 165], [41, 158], [38, 156],
    [34, 152], [30, 150], [26, 149], [22, 148],
    [21, 158, "step"], [20.4, 149],
    [16, 148], [14.6, 156, "step"], [14, 148],
    [9, 149], [7.4, 150],
    [6.6, 250], [6.2, 640], [5.8, 782], [4, 790],
    [1.4, 795], [0.6, 812], [0, 812],
  ],
};

function scenarioAt(points, minutesAgo) {
  if (minutesAgo > points[0][0]) return null;
  for (let i = 0; i < points.length - 1; i++) {
    const [aMin, aVal] = points[i];
    const [bMin, bVal, bMode] = points[i + 1];
    if (minutesAgo <= aMin && minutesAgo >= bMin) {
      if (bMode === "step") return minutesAgo > bMin ? aVal : bVal;
      const span = aMin - bMin || 1;
      const t = (aMin - minutesAgo) / span;
      return aVal + (bVal - aVal) * t;
    }
  }
  return points[points.length - 1][1];
}

/* ------------------------------------------------------------------ *
 * Mock
 * ------------------------------------------------------------------ */

export function createMockHass({
  scenario = "low",
  now = Date.now(),
  powerEntity = "sensor.power_s19",
  energyEntity = "sensor.accumulated_consumption_s19",
  historyKeepMs = 3 * HOUR,
  live = true,
  // Wie das Energie-Dashboard eingerichtet ist:
  //   "stat"  — fertige Kostenstatistik (stat_cost), der genaueste Weg
  //   "fixed" — fester Arbeitspreis (number_energy_price)
  //   "none"  — gar nicht eingerichtet, energy/get_prefs antwortet mit Fehler
  costMode = "stat",
  pricePerKwh = 0.324,
  currency = "EUR",
  // Ab wann der Zähler überhaupt Daten hat. Ein frisch aufgesetzter Pulse ist
  // der Normalfall, und die halbleere Jahresansicht muss ihn aushalten.
  dataStart = now - 400 * DAY,
} = {}) {
  const script = SCENARIOS[scenario] || SCENARIOS.low;
  let clock = now;

  const powerAt = (t) => {
    const minutesAgo = (clock - t) / MINUTE;
    const scripted = minutesAgo >= 0 ? scenarioAt(script, minutesAgo) : null;
    if (scripted != null) {
      return scripted + (noise(t, 15_000) - 0.5) * 0.7;
    }
    return baseLoad(t);
  };

  const sampleHistory = (startMs, endMs, stepMs = 10_000) => {
    const from = Math.max(startMs, clock - historyKeepMs, dataStart);
    const points = [];
    for (let t = Math.ceil(from / stepMs) * stepMs; t <= endMs; t += stepMs) {
      points.push({ s: powerAt(t).toFixed(1), lu: t / 1000 });
    }
    return points;
  };

  /**
   * Die Bucketgrenzen einer Periode — wie beim echten Recorder an lokalen
   * Kalendergrenzen ausgerichtet. Nur so hat der Umstellungstag im Prüfstand
   * auch wirklich 25 Stunden und der Februar 28 Tage.
   */
  const bucketEdges = (startMs, endMs, period) => {
    const edges = [];
    if (period === "5minute" || period === "hour") {
      const size = period === "5minute" ? 5 * MINUTE : HOUR;
      for (let t = Math.floor(startMs / size) * size; t < endMs; t += size) {
        edges.push([t, t + size]);
      }
      return edges;
    }

    const cursor = new Date(startMs);
    cursor.setHours(0, 0, 0, 0);
    if (period === "month") cursor.setDate(1);
    else if (period === "week") cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));

    while (cursor.getTime() < endMs) {
      const from = cursor.getTime();
      if (period === "month") cursor.setMonth(cursor.getMonth() + 1);
      else if (period === "week") cursor.setDate(cursor.getDate() + 7);
      else cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      edges.push([from, cursor.getTime()]);
    }
    return edges;
  };

  /** Verbrauch in kWh über ein Intervall, mit begrenzter Schrittzahl. */
  const energyBetween = (start, to) => {
    const from = Math.max(start, dataStart);
    const stop = Math.min(to, clock);
    if (stop <= from) return 0;
    const step = Math.max(60_000, (stop - from) / 240);
    let wattMs = 0;
    for (let t = from; t < stop; t += step) {
      wattMs += powerAt(t) * Math.min(step, stop - t);
    }
    return wattMs / 3_600_000 / 1000;
  };

  const aggregate = (startMs, endMs, period) => {
    // So lange wie der Recorder die Daten wirklich vorhält
    const retention = period === "5minute" ? 10 * DAY : 400 * DAY;
    const from = Math.max(startMs, clock - retention, dataStart);

    const out = [];
    for (const [bucket, end] of bucketEdges(from, endMs, period)) {
      const width = end - bucket;
      const step = Math.max(10_000, width / 30);
      let sum = 0;
      let count = 0;
      let min = Infinity;
      let max = -Infinity;
      for (let t = Math.max(bucket, dataStart); t < end && t <= clock; t += step) {
        const value = powerAt(t);
        sum += value;
        count++;
        if (value < min) min = value;
        if (value > max) max = value;
      }
      if (!count) continue;
      out.push({ start: bucket, end, mean: sum / count, min, max });
    }
    return out;
  };

  const energyToday = () => {
    const start = new Date(clock);
    start.setHours(0, 0, 0, 0);
    let wattMs = 0;
    const step = 5 * MINUTE;
    for (let t = start.getTime(); t < clock; t += step) {
      wattMs += powerAt(t) * step;
    }
    return wattMs / 3_600_000 / 1000;
  };

  const subscribers = new Set();
  const costEntity = "sensor.accumulated_consumption_s19_cost";

  const hass = {
    locale: { language: "de" },
    themes: {},
    config: { currency, time_zone: "Europe/Berlin" },
    states: {
      [powerEntity]: {
        entity_id: powerEntity,
        state: powerAt(clock).toFixed(1),
        last_updated: new Date(clock).toISOString(),
        attributes: {
          friendly_name: "Power S19",
          device_class: "power",
          state_class: "measurement",
          unit_of_measurement: "W",
        },
      },
      [energyEntity]: {
        entity_id: energyEntity,
        state: energyToday().toFixed(3),
        last_updated: new Date(clock).toISOString(),
        attributes: {
          friendly_name: "Accumulated consumption S19",
          device_class: "energy",
          state_class: "total_increasing",
          unit_of_measurement: "kWh",
        },
      },
      "sensor.outdoor_temperature": {
        entity_id: "sensor.outdoor_temperature",
        state: "29.6",
        last_updated: new Date(clock).toISOString(),
        attributes: {
          friendly_name: "Outdoor",
          device_class: "temperature",
          unit_of_measurement: "°C",
        },
      },
    },

    async callWS(message) {
      switch (message.type) {
        case "history/history_during_period": {
          const start = Date.parse(message.start_time);
          const end = message.end_time ? Date.parse(message.end_time) : clock;
          return { [message.entity_ids[0]]: sampleHistory(start, end) };
        }
        case "recorder/statistics_during_period": {
          const start = Date.parse(message.start_time);
          const end = message.end_time ? Date.parse(message.end_time) : clock;
          const id = message.statistic_ids[0];

          if (message.types?.includes("change")) {
            // Verbrauch je Bucket, damit sich Zeiträume korrekt aufsummieren.
            // Die Kostenstatistik ist derselbe Verlauf mal dem Arbeitspreis —
            // wie beim echten Kostensensor, den das Energie-Dashboard führt.
            const preis = id === costEntity ? pricePerKwh : 1;
            const out = [];
            for (const [bucket, stop] of bucketEdges(start, end, message.period)) {
              const kwh = energyBetween(bucket, stop);
              if (kwh <= 0) continue;
              out.push({ start: bucket, end: stop, change: kwh * preis });
            }
            return { [id]: out };
          }
          if (id !== powerEntity) return {};
          return { [id]: aggregate(start, end, message.period) };
        }
        case "energy/get_prefs": {
          if (costMode === "none") {
            const error = new Error("not_found");
            error.code = "not_found";
            throw error;
          }
          return {
            energy_sources: [
              {
                type: "grid",
                flow_from: [
                  {
                    stat_energy_from: energyEntity,
                    stat_cost: costMode === "stat" ? costEntity : null,
                    entity_energy_price: null,
                    number_energy_price: costMode === "fixed" ? pricePerKwh : null,
                  },
                ],
                flow_to: [],
                cost_adjustment_day: 0,
              },
            ],
            device_consumption: [],
          };
        }
        case "energy/info":
          return {
            cost_sensors: costMode === "stat" ? { [energyEntity]: costEntity } : {},
            solar_forecast_domains: [],
          };
        case "recorder/list_statistic_ids":
          return [{ statistic_id: powerEntity, unit_of_measurement: "W" }];
        default:
          return {};
      }
    },

    connection: {
      async subscribeMessage(callback, message) {
        if (message.type !== "history/stream") throw new Error("unsupported");
        const start = Date.parse(message.start_time);
        callback({
          states: { [message.entity_ids[0]]: sampleHistory(start, clock) },
          start_time: message.start_time,
        });
        const entry = { callback, entityId: message.entity_ids[0], last: clock };
        subscribers.add(entry);
        return () => subscribers.delete(entry);
      },
    },
  };

  /* Live-Betrieb: Uhr weiterlaufen lassen und neue Messwerte nachschieben */
  let timer = null;
  const tick = () => {
    clock += 2000;
    const value = powerAt(clock);
    hass.states[powerEntity] = {
      ...hass.states[powerEntity],
      state: value.toFixed(1),
      last_updated: new Date(clock).toISOString(),
    };
    for (const entry of subscribers) {
      entry.callback({
        states: { [entry.entityId]: [{ s: value.toFixed(1), lu: clock / 1000 }] },
      });
      entry.last = clock;
    }
    hass.onUpdate?.(hass);
  };

  if (live) timer = setInterval(tick, 2000);

  hass.stop = () => clearInterval(timer);
  hass.getClock = () => clock;

  return hass;
}
