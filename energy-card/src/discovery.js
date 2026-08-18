/**
 * Auto-Discovery der Entities.
 *
 * Die Karte soll ohne Konfiguration etwas Sinnvolles zeigen. Explizite
 * Angaben in der YAML-Konfiguration schlagen die Discovery immer.
 */

const POWER_UNITS = new Set(["W", "kW", "MW", "mW"]);
const ENERGY_UNITS = new Set(["Wh", "kWh", "MWh"]);

const NAME_HINTS = [
  [/pulse/i, 60],
  [/tibber/i, 50],
  [/haus|house|home|gesamt|total|grid|netz/i, 20],
];

function scoreName(entityId, friendlyName) {
  const haystack = `${entityId} ${friendlyName || ""}`;
  let score = 0;
  for (const [pattern, points] of NAME_HINTS) {
    if (pattern.test(haystack)) score += points;
  }
  return score;
}

function candidates(hass, { deviceClass, units }) {
  const out = [];
  for (const [entityId, state] of Object.entries(hass?.states || {})) {
    if (!entityId.startsWith("sensor.")) continue;
    const attrs = state.attributes || {};
    if (attrs.device_class !== deviceClass) continue;
    if (!units.has(String(attrs.unit_of_measurement || ""))) continue;
    out.push({ entityId, state, attrs });
  }
  return out;
}

/** Der Sensor für den Live-Wert: Leistung, möglichst der Haus-Zähler. */
export function discoverPowerEntity(hass) {
  const list = candidates(hass, { deviceClass: "power", units: POWER_UNITS });
  if (!list.length) return null;

  let best = null;
  let bestScore = -Infinity;

  for (const item of list) {
    let score = scoreName(item.entityId, item.attrs.friendly_name);
    // Ohne `measurement` gibt es keine Statistiken und damit keine langen Zeiträume
    if (item.attrs.state_class === "measurement") score += 25;
    // Ein Hauszähler misst mehr als eine einzelne Steckdose
    const value = Number(item.state.state);
    if (Number.isFinite(value)) score += Math.min(10, Math.log10(Math.max(1, value)) * 4);

    if (score > bestScore) {
      bestScore = score;
      best = item.entityId;
    }
  }

  return best;
}

/**
 * Der Energiesensor für „Used today". Bevorzugt werden Sensoren, die
 * erkennbar den heutigen Verbrauch führen und zum Leistungssensor gehören —
 * die Tibber-Integration liefert etwa `sensor.accumulated_consumption_<home>`.
 */
export function discoverEnergyEntity(hass, powerEntityId) {
  const list = candidates(hass, { deviceClass: "energy", units: ENERGY_UNITS });
  if (!list.length) return null;

  const stem = (powerEntityId || "")
    .replace(/^sensor\./, "")
    .replace(/(^|_)(power|leistung|verbrauch)(_|$)/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  let best = null;
  let bestScore = -Infinity;

  for (const item of list) {
    let score = scoreName(item.entityId, item.attrs.friendly_name);
    if (/today|heute|daily|täglich|taeglich|accumulated_consumption/i.test(item.entityId)) {
      score += 70;
    }
    if (/yesterday|gestern|month|monat|year|jahr|cost|kosten|preis|price/i.test(item.entityId)) {
      score -= 90;
    }
    if (stem && item.entityId.includes(stem)) score += 30;
    if (item.attrs.state_class === "total_increasing") score += 10;

    if (score > bestScore) {
      bestScore = score;
      best = item.entityId;
    }
  }

  // Ein Gesamtzähler ohne Tagesbezug wäre irreführend — dann lieber nichts
  // vorschlagen und die Karte rechnet den Tageswert selbst aus.
  return bestScore >= 0 ? best : null;
}

export function resolveEntities(hass, config) {
  const power = config.power_entity || discoverPowerEntity(hass);
  const energy =
    config.energy_today_entity ??
    (config.energy_today_entity === null ? null : discoverEnergyEntity(hass, power));
  return { power, energy };
}
