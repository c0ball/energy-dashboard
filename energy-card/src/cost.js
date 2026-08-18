/**
 * Kosten.
 *
 * Home Assistant führt die Preisinformation im Energie-Dashboard, nicht am
 * Sensor. Die Karte holt sie dort ab, statt einen eigenen Preis zu verlangen:
 * wer die Energieseite einmal eingerichtet hat, soll nichts doppelt pflegen.
 *
 * Die Auflösung geht der Reihe nach vor, und die Reihenfolge ist keine
 * Geschmacksfrage — sie geht von der genauesten Quelle zur gröbsten:
 *
 *   1. `cost_entity` aus der Kartenkonfiguration
 *   2. `stat_cost` aus den Energie-Einstellungen — eine fertige Kostenstatistik,
 *      die auch vergangene Preiswechsel korrekt abbildet
 *   3. der von Home Assistant erzeugte Kostensensor (`energy/info`)
 *   4. `entity_energy_price` — Preissensor, je Zeitblock im damaligen Mittel
 *   5. `number_energy_price` — fester Preis aus den Energie-Einstellungen
 *   6. `price` aus der Kartenkonfiguration
 *
 * Die ersten drei liefern echte Kosten aus der Statistik. Die letzten drei
 * rechnen Kilowattstunden mal Preis — bei einem festen Tarif dasselbe, bei
 * einem variablen eine Näherung, und rückwirkend mit dem heutigen Preis
 * gerechnet. Welcher Weg genommen wurde, gibt `resolveCostSource` mit zurück,
 * damit die Oberfläche das benennen kann.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Findet heraus, woher die Kosten kommen.
 *
 * @returns {{kind, statisticId?, priceEntityId?, price?, currency}|null}
 */
export async function resolveCostSource(hass, config, energyEntityId) {
  const currency = hass?.config?.currency || "EUR";

  if (config?.cost_entity) {
    return { kind: "statistic", statisticId: config.cost_entity, currency };
  }

  const flow = await gridFlow(hass, energyEntityId);

  if (flow?.stat_cost) {
    return { kind: "statistic", statisticId: flow.stat_cost, currency };
  }

  if (energyEntityId) {
    const sensor = await costSensorFor(hass, energyEntityId);
    if (sensor) return { kind: "statistic", statisticId: sensor, currency };
  }

  if (flow?.entity_energy_price) {
    return { kind: "price_entity", priceEntityId: flow.entity_energy_price, currency };
  }

  if (Number.isFinite(flow?.number_energy_price)) {
    return { kind: "fixed", price: flow.number_energy_price, currency };
  }

  const configured = Number(config?.price);
  if (Number.isFinite(configured) && configured > 0) {
    return { kind: "fixed", price: configured, currency };
  }

  return null;
}

/** Der Netzbezugs-Eintrag der Energie-Einstellungen für unseren Zähler. */
async function gridFlow(hass, energyEntityId) {
  let prefs;
  try {
    prefs = await hass.callWS({ type: "energy/get_prefs" });
  } catch (err) {
    // Ohne eingerichtetes Energie-Dashboard antwortet der Core mit
    // ERR_NOT_FOUND — das ist kein Fehler, nur eine fehlende Quelle.
    return null;
  }

  const flows = [];
  for (const source of prefs?.energy_sources || []) {
    if (source?.type === "grid") flows.push(...(source.flow_from || []));
  }
  if (!flows.length) return null;

  // Ohne passenden Zähler taugt der erste Netzbezug immer noch als Preisquelle
  return flows.find((flow) => flow?.stat_energy_from === energyEntityId) || flows[0];
}

async function costSensorFor(hass, energyEntityId) {
  try {
    const info = await hass.callWS({ type: "energy/info" });
    return info?.cost_sensors?.[energyEntityId] || null;
  } catch (err) {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Abfragen
 * ------------------------------------------------------------------ */

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
    const start = Number(entry.start);
    const value = Number(entry[type]);
    if (Number.isFinite(start) && Number.isFinite(value)) map.set(start, value);
  }
  return map;
}

/**
 * Kosten je Balken, passend zu den Verbrauchsbalken aus `fetchBuckets`.
 *
 * @param buckets [{ t, kwh }] — dieselbe Liste, die das Chart zeigt
 */
export async function fetchBucketCosts(hass, source, { buckets, startMs, endMs, period }) {
  if (!source || !buckets?.length) return null;

  if (source.kind === "fixed") {
    return buckets.map((b) => (Number.isFinite(b.kwh) ? b.kwh * source.price : null));
  }

  try {
    if (source.kind === "statistic") {
      const map = await statisticsByStart(
        hass, source.statisticId, startMs, endMs, period, "change"
      );
      if (!map.size) return null;
      return buckets.map((b) => (map.has(b.t) ? map.get(b.t) : null));
    }

    // Preissensor: der im Block gültige Mittelpreis mal dem Verbrauch. Nicht so
    // genau wie eine Kostenstatistik, die den Preis zu jeder Kilowattstunde
    // kennt, aber deutlich besser als ein pauschaler Tagespreis.
    const map = await statisticsByStart(
      hass, source.priceEntityId, startMs, endMs, period, "mean"
    );
    if (!map.size) return null;
    return buckets.map((b) =>
      Number.isFinite(b.kwh) && map.has(b.t) ? b.kwh * map.get(b.t) : null
    );
  } catch (err) {
    return null;
  }
}

/**
 * Kosten über einen zusammenhängenden Zeitraum.
 *
 * `kwh` dient als Rückfall für feste Preise und für Fenster, die zu kurz für
 * die Blockstatistik sind — dieselbe Überlegung wie beim Verbrauch: ein
 * Fünf-Minuten-Fenster bekäme sonst den Betrag eines ganzen Blocks
 * untergeschoben.
 */
export async function fetchCostForPeriod(
  hass,
  source,
  { startMs, endMs, kwh = null, effectivePrice = null }
) {
  if (!source) return null;

  const span = endMs - startMs;
  if (source.kind === "fixed") {
    return Number.isFinite(kwh) ? kwh * source.price : null;
  }

  if (span < 2 * HOUR) {
    // Zu kurz für Blöcke: die Statistik läge um bis zu einen ganzen Block
    // daneben. Stattdessen der bekannte Arbeitspreis mal dem Verbrauch — und
    // wo nur eine Kostenstatistik existiert, der daraus abgeleitete
    // Durchschnittspreis des Tages. Das ist eine Näherung, aber eine
    // nachvollziehbare; ein Strich wäre schlicht weniger Information.
    const price = (await currentPrice(hass, source)) ?? effectivePrice;
    return Number.isFinite(kwh) && Number.isFinite(price) ? kwh * price : null;
  }

  let period = "day";
  if (span <= 36 * HOUR) period = "5minute";
  else if (span <= 3 * DAY) period = "hour";

  try {
    if (source.kind === "statistic") {
      const map = await statisticsByStart(
        hass, source.statisticId, startMs, endMs, period, "change"
      );
      if (!map.size) return null;
      let sum = 0;
      for (const value of map.values()) sum += value;
      return sum;
    }

    const price = await currentPrice(hass, source);
    return Number.isFinite(kwh) && Number.isFinite(price) ? kwh * price : null;
  } catch (err) {
    return null;
  }
}

/** Der aktuelle Arbeitspreis, soweit die Quelle einen hergibt. */
export async function currentPrice(hass, source) {
  if (!source) return null;
  if (source.kind === "fixed") return source.price;
  if (source.kind === "price_entity") {
    const value = Number(hass?.states?.[source.priceEntityId]?.state);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}
