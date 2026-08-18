/**
 * Datenpipeline: WebSocket-Abfragen gegen Recorder und History, Auswahl der
 * passenden Auflösung und Downsampling.
 *
 * Grundidee: kurze Fenster kommen aus der Rohhistorie (und werden live
 * nachgeführt), lange Fenster aus den Langzeitstatistiken. Welche Quelle
 * zuständig ist, entscheidet ausschliesslich `pickResolution` — dieselbe
 * Funktion bedient die Toggle-Leiste und das Nachladen beim Zoomen.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RANGES = [
  { key: "5min", labelKey: "range_5min", windowMs: 5 * MINUTE },
  { key: "1h", labelKey: "range_1h", windowMs: HOUR },
  { key: "6h", labelKey: "range_6h", windowMs: 6 * HOUR },
  { key: "12h", labelKey: "range_12h", windowMs: 12 * HOUR },
  { key: "24h", labelKey: "range_24h", windowMs: DAY },
  { key: "7d", labelKey: "range_7d", windowMs: 7 * DAY },
  { key: "30d", labelKey: "range_30d", windowMs: 30 * DAY },
];

/**
 * Voreinstellung der Leiste. 6 Std und 12 Std sind bewusst nicht dabei: sieben
 * Schaltflächen drängeln sich auf einem Handy, und die Vorlage kennt sie auch
 * nicht. Wer sie will, nimmt sie in `ranges` auf.
 */
export const DEFAULT_RANGE_KEYS = ["5min", "1h", "24h", "7d", "30d"];

/**
 * Womit die Live-Ansicht aufmacht, solange nichts anderes eingestellt ist.
 * Eine Stunde zeigt den Tagesrhythmus noch nicht, aber jedes Ein- und
 * Ausschalten — das ist es, wofür man auf den Live-Screen schaut.
 */
export const DEFAULT_START_RANGE = "1h";

/** Sortiert Bereichsschlüssel in die natürliche Reihenfolge kurz → lang. */
export function sortRangeKeys(keys) {
  const order = new Map(RANGES.map((range, index) => [range.key, index]));
  return [...keys].sort((a, b) => order.get(a) - order.get(b));
}

export function rangeByKey(key) {
  return RANGES.find((r) => r.key === key) || RANGES[1];
}

/**
 * Wählt Quelle und Auflösung für ein Zeitfenster.
 *
 * Die 5-Minuten-Statistiken werden von HA nur so lange vorgehalten wie die
 * Rohhistorie (`purge_keep_days`, Standard 10 Tage) — deshalb greifen wir ab
 * zwei Wochen auf Stundenwerte zurück, die dauerhaft bleiben.
 */
export function pickResolution(windowMs) {
  if (windowMs <= 3 * HOUR) return { source: "history", period: null, live: true };
  if (windowMs <= 36 * HOUR) return { source: "statistics", period: "5minute", live: false };
  if (windowMs <= 35 * DAY) return { source: "statistics", period: "hour", live: false };
  return { source: "statistics", period: "day", live: false };
}

/* ------------------------------------------------------------------ *
 * Hilfsfunktionen
 * ------------------------------------------------------------------ */

const toMs = (value) => {
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const isUsableState = (state) =>
  state != null && state !== "unavailable" && state !== "unknown" && state !== "";

/** Faktor, um die Einheit einer Entity auf Watt zu bringen. */
export function powerFactor(unit) {
  switch (String(unit || "").trim()) {
    case "kW":
      return 1000;
    case "MW":
      return 1_000_000;
    case "mW":
      return 0.001;
    default:
      return 1;
  }
}

export function entityUnit(hass, entityId) {
  return hass?.states?.[entityId]?.attributes?.unit_of_measurement || "W";
}

/* ------------------------------------------------------------------ *
 * Downsampling — Largest Triangle Three Buckets
 *
 * Behält im Gegensatz zu naivem Ausdünnen die Spitzen, auf die es bei
 * Leistungsverläufen ankommt: ein 3-kW-Ausreisser von zehn Sekunden Dauer
 * verschwindet sonst spurlos.
 * ------------------------------------------------------------------ */

export function downsample(points, threshold) {
  const n = points.length;
  if (threshold >= n || threshold < 3) return points;

  const sampled = [points[0]];
  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);

    // Schwerpunkt des nächsten Buckets als Referenz für die Dreiecksfläche
    let avgT = 0;
    let avgV = 0;
    const avgCount = Math.max(1, rangeEnd - rangeStart);
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgT += points[j].t;
      avgV += points[j].v;
    }
    avgT /= avgCount;
    avgV /= avgCount;

    const currentStart = Math.floor(i * bucketSize) + 1;
    const currentEnd = Math.floor((i + 1) * bucketSize) + 1;
    const pointA = points[a];

    let maxArea = -1;
    let chosen = currentStart;
    for (let j = currentStart; j < currentEnd && j < n; j++) {
      const area = Math.abs(
        (pointA.t - avgT) * (points[j].v - pointA.v) -
          (pointA.t - points[j].t) * (avgV - pointA.v)
      );
      if (area > maxArea) {
        maxArea = area;
        chosen = j;
      }
    }

    sampled.push(points[chosen]);
    a = chosen;
  }

  sampled.push(points[n - 1]);
  return sampled;
}

/* ------------------------------------------------------------------ *
 * Rohhistorie
 * ------------------------------------------------------------------ */

function parseHistoryStates(entries, factor) {
  const points = [];
  for (const entry of entries || []) {
    const state = entry.s ?? entry.state;
    if (!isUsableState(state)) continue;
    const value = Number(state);
    if (!Number.isFinite(value)) continue;
    const t = toMs(entry.lu ?? entry.last_updated ?? entry.last_changed);
    if (t == null) continue;
    points.push({ t, v: value * factor });
  }
  return points.sort((a, b) => a.t - b.t);
}

export async function fetchHistory(hass, entityId, startMs, endMs) {
  const factor = powerFactor(entityUnit(hass, entityId));
  const response = await hass.callWS({
    type: "history/history_during_period",
    start_time: new Date(startMs).toISOString(),
    end_time: new Date(endMs).toISOString(),
    entity_ids: [entityId],
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });
  return parseHistoryStates(response?.[entityId], factor);
}

/**
 * Live-Abo über `history/stream`: liefert den Initialbestand und danach jede
 * Änderung, ohne dass wir pollen müssen. Gibt eine Abmelde-Funktion zurück.
 *
 * Fällt auf eine einmalige Abfrage zurück, wenn der Core den Befehl nicht
 * kennt — dann trägt die Karte neue Werte aus `hass.states` selbst nach.
 */
export async function subscribeHistory(hass, entityId, startMs, onPoints) {
  const factor = powerFactor(entityUnit(hass, entityId));

  try {
    const unsubscribe = await hass.connection.subscribeMessage(
      (event) => {
        const points = parseHistoryStates(event?.states?.[entityId], factor);
        if (points.length) onPoints(points);
      },
      {
        type: "history/stream",
        entity_ids: [entityId],
        start_time: new Date(startMs).toISOString(),
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      }
    );
    return unsubscribe;
  } catch (err) {
    const points = await fetchHistory(hass, entityId, startMs, Date.now());
    if (points.length) onPoints(points);
    return () => {};
  }
}

/* ------------------------------------------------------------------ *
 * Langzeitstatistiken
 * ------------------------------------------------------------------ */

function parseStatistics(entries, factor) {
  const points = [];
  for (const entry of entries || []) {
    const t = toMs(entry.start);
    if (t == null) continue;
    const mean = Number(entry.mean ?? entry.state);
    if (!Number.isFinite(mean)) continue;
    const min = Number(entry.min);
    const max = Number(entry.max);
    points.push({
      t,
      v: mean * factor,
      min: Number.isFinite(min) ? min * factor : undefined,
      max: Number.isFinite(max) ? max * factor : undefined,
    });
  }
  return points.sort((a, b) => a.t - b.t);
}

export async function fetchStatistics(hass, entityId, startMs, endMs, period) {
  const response = await hass.callWS({
    type: "recorder/statistics_during_period",
    start_time: new Date(startMs).toISOString(),
    end_time: new Date(endMs).toISOString(),
    statistic_ids: [entityId],
    period,
    types: ["mean", "min", "max"],
    units: { power: "W" },
  });
  // `units` erledigt die Umrechnung serverseitig, deshalb Faktor 1.
  return parseStatistics(response?.[entityId], 1);
}

/**
 * Holt die Messreihe für ein Zeitfenster. Liefern die Statistiken nichts —
 * etwa weil dem Sensor `state_class: measurement` fehlt — wird still auf die
 * Rohhistorie ausgewichen.
 *
 * Die Auflösung darf von aussen vorgegeben werden: geladen wird mit Puffer,
 * entscheiden soll aber das sichtbare Fenster — sonst rutschten 30 Tage
 * Ansicht allein wegen des Puffers in die Tagesauflösung.
 */
export async function fetchSeries(
  hass,
  entityId,
  startMs,
  endMs,
  resolution = pickResolution(endMs - startMs)
) {
  if (resolution.source === "statistics") {
    try {
      const points = await fetchStatistics(
        hass,
        entityId,
        startMs,
        endMs,
        resolution.period
      );
      if (points.length) return { points, resolution };
    } catch (err) {
      /* auf History zurückfallen */
    }
    const points = await fetchHistory(hass, entityId, startMs, endMs);
    return {
      points: downsample(points, 600),
      resolution: { source: "history", period: null, live: false },
    };
  }

  const points = await fetchHistory(hass, entityId, startMs, endMs);
  return { points: downsample(points, 600), resolution };
}

/* ------------------------------------------------------------------ *
 * Tageskennzahlen für die Stat-Kacheln
 * ------------------------------------------------------------------ */

/**
 * Lokaler Tagesbeginn. Bewusst über `Date.now()` statt `new Date()`, damit die
 * gesamte Zeitrechnung der Karte an einer einzigen Stelle hängt und sich in
 * Tests auf einen festen Zeitpunkt legen lässt.
 */
export function startOfToday() {
  const now = new Date(Date.now());
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

/**
 * Maximum und Minimum des laufenden Tages samt Uhrzeit.
 *
 * Die Tibber-Integration liefert zwar fertige `sensor.max_power_*`-Entities,
 * aber ohne Zeitstempel — und genau den zeigt die App unter dem Wert an.
 * Deshalb rechnen wir selbst, bevorzugt auf den 5-Minuten-Statistiken.
 */
export async function fetchTodayExtremes(hass, entityId) {
  const start = startOfToday();
  const end = Date.now();

  let entries = [];
  try {
    const response = await hass.callWS({
      type: "recorder/statistics_during_period",
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
      statistic_ids: [entityId],
      period: "5minute",
      types: ["mean", "min", "max"],
      units: { power: "W" },
    });
    entries = response?.[entityId] || [];
  } catch (err) {
    entries = [];
  }

  let max = null;
  let min = null;
  const means = [];

  if (entries.length) {
    for (const entry of entries) {
      const t = toMs(entry.start);
      const hi = Number(entry.max);
      const lo = Number(entry.min);
      const mean = Number(entry.mean);
      if (Number.isFinite(hi) && (!max || hi > max.value)) max = { value: hi, t };
      if (Number.isFinite(lo) && (!min || lo < min.value)) min = { value: lo, t };
      if (Number.isFinite(mean)) means.push(mean);
    }
  } else {
    const points = await fetchHistory(hass, entityId, start, end);
    for (const point of points) {
      if (!max || point.v > max.value) max = { value: point.v, t: point.t };
      if (!min || point.v < min.value) min = { value: point.v, t: point.t };
      means.push(point.v);
    }
  }

  return { max, min, typical: percentile(means, 0.95) };
}

/**
 * Perzentil einer Messreihe. Dient als Bezugswert für den Ring: das absolute
 * Tagesmaximum wäre dafür untauglich, weil ein einziger Wasserkocher den Ring
 * für den Rest des Tages auf einen Stummel schrumpfen liesse.
 */
export function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[index];
}

/**
 * Heutiger Energieverbrauch in kWh.
 *
 * Reihenfolge: konfigurierter Energiesensor → dessen Tagesdifferenz aus den
 * Statistiken → als letzte Rettung numerische Integration des
 * Leistungsverlaufs. Der Integrationspfad ist ungenauer, aber immer noch
 * brauchbar und verhindert eine leere Kachel.
 */
export async function fetchEnergyToday(hass, powerEntityId, energyEntityId) {
  if (energyEntityId && hass.states?.[energyEntityId]) {
    const state = hass.states[energyEntityId];
    const value = Number(state.state);
    if (isUsableState(state.state) && Number.isFinite(value)) {
      const unit = state.attributes?.unit_of_measurement;
      const kwh = unit === "Wh" ? value / 1000 : unit === "MWh" ? value * 1000 : value;
      // Ein Gesamtzähler taugt nicht als Tageswert — dann lieber weiterrechnen.
      if (state.attributes?.state_class !== "total_increasing" || kwh < 1000) {
        return kwh;
      }
    }
  }

  if (energyEntityId) {
    try {
      const response = await hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: new Date(startOfToday()).toISOString(),
        statistic_ids: [energyEntityId],
        period: "day",
        types: ["change"],
        units: { energy: "kWh" },
      });
      const change = Number(response?.[energyEntityId]?.[0]?.change);
      if (Number.isFinite(change)) return change;
    } catch (err) {
      /* weiter zur Integration */
    }
  }

  const { points } = await fetchSeries(hass, powerEntityId, startOfToday(), Date.now());
  return integrateToKwh(points);
}

/**
 * Integriert eine Leistungsreihe (W über ms) zu kWh.
 *
 * Für Rohmesswerte ist die Trapezregel richtig: zwischen zwei Messungen wird
 * linear übergegangen. Statistikpunkte tragen dagegen den Mittelwert eines
 * ganzen Zeitfensters — dort gilt der Wert bis zum nächsten Bucket unverändert,
 * also die Rechteckregel. Mit der Trapezregel gerechnet würden Lastspitzen am
 * Rand systematisch verschmiert.
 */
export function integrateToKwh(points, { buckets = false, endMs = null } = {}) {
  if (!points || points.length < 2) return 0;

  let wattMs = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dt = points[i + 1].t - points[i].t;
    if (dt <= 0) continue;
    wattMs += buckets
      ? points[i].v * dt
      : ((points[i].v + points[i + 1].v) / 2) * dt;
  }

  // Der letzte Bucket hat keinen Nachfolger — er zählt bis zum Fensterende,
  // höchstens aber eine übliche Bucketbreite lang.
  if (buckets) {
    const last = points.at(-1);
    const width = last.t - points.at(-2).t;
    const tail = endMs == null ? width : Math.min(width, Math.max(0, endMs - last.t));
    wattMs += last.v * tail;
  }

  return wattMs / 3_600_000 / 1000;
}

/** Erster Index mit points[i].t >= t. */
export function lowerBound(points, t) {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Kennzahlen über ein Zeitfenster, gerechnet auf den bereits geladenen Punkten
 * — kein zusätzlicher Abruf nötig, und die Werte folgen Zoom und Pan sofort.
 *
 * Statistikpunkte bringen die echten Extrema ihres Buckets mit; nur den
 * Mittelwert heranzuziehen würde die Spitze einer Stunde unterschlagen.
 */
export function computeWindowStats(points, startMs, endMs, { buckets = false } = {}) {
  const empty = { max: null, min: null, typical: null, energy: null, count: 0 };
  if (!points?.length) return empty;

  const from = lowerBound(points, startMs);
  const to = lowerBound(points, endMs);
  const slice = points.slice(from, Math.max(from + 1, to));
  if (!slice.length) return empty;

  let max = null;
  let min = null;
  const means = [];

  for (const point of slice) {
    const hi = point.max ?? point.v;
    const lo = point.min ?? point.v;
    if (Number.isFinite(hi) && (!max || hi > max.value)) max = { value: hi, t: point.t };
    if (Number.isFinite(lo) && (!min || lo < min.value)) min = { value: lo, t: point.t };
    if (Number.isFinite(point.v)) means.push(point.v);
  }

  return {
    max,
    min,
    typical: percentile(means, 0.95),
    energy: integrateToKwh(slice, { buckets, endMs }),
    count: slice.length,
  };
}

/**
 * Kürzeste Spanne, für die sich der Griff zu den Zählerstatistiken lohnt.
 *
 * Die Statistik liegt in festen Blöcken, und ein Fenster endet fast nie auf
 * einer Blockgrenze. Bei zwei Stunden macht der angeschnittene 5-Minuten-Block
 * höchstens vier Prozent aus; bei fünf Minuten bekäme die Kachel dagegen den
 * Verbrauch eines ganzen Blocks untergeschoben. Darunter bleibt deshalb die
 * Integration des Leistungsverlaufs zuständig, die exakt am Fenster liegt.
 */
export const ENERGY_STATS_MIN_MS = 2 * HOUR;

/* ------------------------------------------------------------------ *
 * Balkendaten für die Analyse-Ansicht
 * ------------------------------------------------------------------ */

/** Rohabfrage einer Statistik; gibt eine Zuordnung Bucketbeginn → Wert zurück. */
async function statisticsByStart(hass, statisticId, startMs, endMs, period, type, units) {
  const response = await hass.callWS({
    type: "recorder/statistics_during_period",
    start_time: new Date(startMs).toISOString(),
    end_time: new Date(endMs).toISOString(),
    statistic_ids: [statisticId],
    period,
    types: [type],
    ...(units ? { units } : {}),
  });

  const map = new Map();
  for (const entry of response?.[statisticId] || []) {
    const t = toMs(entry.start);
    const value = Number(entry[type]);
    if (t != null && Number.isFinite(value)) map.set(t, value);
  }
  return map;
}

/**
 * Verbrauch je Balken einer Periode.
 *
 * Die Balkenliste kommt von aussen aus `bucketStarts()` und nicht aus der
 * Antwort des Recorders: nur so bleibt eine Lücke eine Lücke, statt die Achse
 * stillschweigend zusammenzuschieben. Fehlende Buckets bekommen `kwh: null`.
 *
 * Erste Wahl ist der Zählerstand (`change`), weil er die Wahrheit des Zählers
 * trägt. Fehlt er, wird der Leistungsmittelwert über die tatsächliche Dauer des
 * Balkens integriert — an Umstellungstagen ist die eben nicht 24 Stunden.
 */
export async function fetchBuckets(
  hass,
  { energyEntityId, powerEntityId, startMs, endMs, period, starts }
) {
  if (energyEntityId) {
    try {
      const map = await statisticsByStart(
        hass, energyEntityId, startMs, endMs, period, "change", { energy: "kWh" }
      );
      if (map.size) {
        return {
          source: "energy",
          buckets: starts.map((t) => ({ t, kwh: map.has(t) ? map.get(t) : null })),
        };
      }
    } catch (err) {
      /* auf die Leistung ausweichen */
    }
  }

  if (!powerEntityId) return { source: null, buckets: starts.map((t) => ({ t, kwh: null })) };

  try {
    const map = await statisticsByStart(
      hass, powerEntityId, startMs, endMs, period, "mean", { power: "W" }
    );
    return {
      source: "power",
      buckets: starts.map((t, i) => {
        if (!map.has(t)) return { t, kwh: null };
        const next = i + 1 < starts.length ? starts[i + 1] : endMs;
        return { t, kwh: (map.get(t) * (next - t)) / 3_600_000 / 1000 };
      }),
    };
  } catch (err) {
    return { source: null, buckets: starts.map((t) => ({ t, kwh: null })) };
  }
}

/**
 * Grundlast: der Median der Tagesminima der letzten Tage.
 *
 * Der Median statt des Mittelwerts, weil ein einzelner Tag mit durchlaufender
 * Waschmaschine sonst die ganze Aussage verschiebt. Was hier herauskommt, ist
 * die Leistung, die das Haus zieht, während niemand etwas tut.
 */
export async function fetchBaseload(hass, powerEntityId, days = 7) {
  if (!powerEntityId) return null;

  const end = Date.now();
  const start = new Date(end);
  // `days - 1`, weil der laufende Tag mitzählt: sonst wären es sieben volle
  // Tage plus der angebrochene, also acht Blöcke bei `days = 7`.
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  try {
    const map = await statisticsByStart(
      hass, powerEntityId, start.getTime(), end, "day", "min", { power: "W" }
    );
    const values = [...map.values()].filter((v) => Number.isFinite(v) && v >= 0);
    if (!values.length) return null;

    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const watt =
      values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;

    return { watt, kwhPerDay: (watt * 24) / 1000, days: values.length };
  } catch (err) {
    return null;
  }
}

/**
 * Energieverbrauch über einen beliebigen Zeitraum aus den Zählerstatistiken.
 * Genauer als jede Integration des Leistungsverlaufs, kostet aber einen Abruf
 * und setzt einen Energiesensor voraus.
 */
export async function fetchEnergyForPeriod(hass, energyEntityId, startMs, endMs) {
  if (!energyEntityId) return null;

  // Je kürzer das Fenster, desto feiner muss der Block sein — sonst überwiegt
  // der Fehler am Rand den Genauigkeitsgewinn gegenüber der Integration.
  const span = endMs - startMs;
  let period = "day";
  if (span <= 36 * HOUR) period = "5minute";
  else if (span <= 3 * DAY) period = "hour";
  try {
    const response = await hass.callWS({
      type: "recorder/statistics_during_period",
      start_time: new Date(startMs).toISOString(),
      end_time: new Date(endMs).toISOString(),
      statistic_ids: [energyEntityId],
      period,
      types: ["change"],
      units: { energy: "kWh" },
    });

    const entries = response?.[energyEntityId];
    if (!entries?.length) return null;

    let sum = 0;
    let seen = false;
    for (const entry of entries) {
      const change = Number(entry.change);
      if (Number.isFinite(change)) {
        sum += change;
        seen = true;
      }
    }
    return seen ? sum : null;
  } catch (err) {
    return null;
  }
}
