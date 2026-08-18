/** Zahlen- und Zeitformatierung, an der Tibber-App orientiert. */

let cachedLocale = null;

export function setLocale(locale) {
  cachedLocale = locale || null;
}

const locale = () => cachedLocale || undefined;

/** Die aktive Locale für Module, die eigene Intl-Formate aufbauen. */
export function getLocale() {
  return locale();
}

/**
 * Leistung. Die App bleibt bis in den Kilowattbereich bei Watt und gruppiert
 * Tausender mit einem schmalen Leerzeichen („8 642 W"), deshalb hier ebenso.
 */
export function formatWatt(value) {
  if (!Number.isFinite(value)) return "–";
  const rounded = Math.round(value);
  return new Intl.NumberFormat(locale(), { useGrouping: true })
    .format(rounded)
    .replace(/[ ,.](?=\d{3}\b)/g, " ");
}

export function formatKwh(value, reference = value) {
  if (!Number.isFinite(value)) return "–";
  // Die Genauigkeit darf sich an einer Bezugsgrösse orientieren — auf einer
  // Achse sollen alle Werte gleich viele Stellen tragen, sonst steht „0,00"
  // unter „300".
  const scale = Math.abs(Number.isFinite(reference) ? reference : value);
  let digits = 2;
  if (scale >= 100) digits = 0;
  else if (scale >= 10) digits = 1;

  return new Intl.NumberFormat(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * Energiemenge samt passender Einheit. Unter 0,1 kWh wird auf Wattstunden
 * umgestellt: Seit die Kacheln auch kurzen Zeiträumen folgen, stünde ein
 * Fünf-Minuten-Fenster in Kilowattstunden sonst dauerhaft auf „0,00" — was
 * wie ein Ausfall aussieht und nicht wie ein kleiner Verbrauch.
 */
export function formatEnergy(kwh) {
  if (!Number.isFinite(kwh)) return { value: "–", unit: "kWh" };
  if (Math.abs(kwh) < 0.1) {
    const wh = new Intl.NumberFormat(locale(), {
      maximumFractionDigits: Math.abs(kwh) < 0.01 ? 1 : 0,
    }).format(kwh * 1000);
    return { value: wh, unit: "Wh" };
  }
  return { value: formatKwh(kwh), unit: "kWh" };
}

/**
 * Geldbetrag, zerlegt in Zahl und Währungszeichen.
 *
 * Die Zerlegung geht über `formatToParts` statt über Zeichenketten-Basteln,
 * weil das Symbol je nach Sprache vor oder hinter der Zahl steht („29,34 €"
 * gegenüber „€29.34"). `prefix` sagt, welche Seite es ist — nur so lässt sich
 * das Zeichen kleiner setzen, ohne die Reihenfolge zu zerstören.
 */
export function formatMoney(value, currency) {
  if (!Number.isFinite(value)) return { value: "–", unit: "", prefix: false };

  const digits = Math.abs(value) >= 100 ? 0 : 2;
  const parts = new Intl.NumberFormat(locale(), {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).formatToParts(value);

  const symbolAt = parts.findIndex((p) => p.type === "currency");
  const symbol = symbolAt >= 0 ? parts[symbolAt].value : "";
  const number = parts
    .filter((p) => p.type !== "currency")
    .map((p) => p.value)
    .join("")
    .trim();

  return { value: number, unit: symbol, prefix: symbolAt === 0 };
}

/** Derselbe Betrag als fertiger Text, für Fliesstext ohne eigene Auszeichnung. */
export function formatMoneyPlain(value, currency) {
  const { value: number, unit, prefix } = formatMoney(value, currency);
  if (!unit) return number;
  return prefix ? `${unit}${number}` : `${number} ${unit}`;
}

export function formatClock(timestamp) {
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat(locale(), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

/**
 * Zeitpunkt eines Messwerts. Über Tagesgrenzen hinweg braucht es das Datum
 * dazu, sonst lässt sich „18:20" nicht zuordnen — bewusst nur Tag und Monat
 * in Ziffern, weil ausgeschriebene Wochentage die Kacheln sprengen.
 */
export function formatMoment(timestamp, windowMs) {
  if (!Number.isFinite(timestamp)) return "";
  const options =
    windowMs > 36 * 3_600_000
      ? { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }
      : { hour: "2-digit", minute: "2-digit" };
  return new Intl.DateTimeFormat(locale(), options).format(new Date(timestamp));
}
