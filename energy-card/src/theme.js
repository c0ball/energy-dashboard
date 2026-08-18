/**
 * Farb-Tokens, Schwellwert-Logik und Typografie.
 *
 * Die Werte sind aus den Tibber-App-Screenshots abgelesen (Pulse-Screen,
 * IMG_4945 = Niedriglast, IMG_4950 = Hochlast).
 */

export const TOKENS = {
  cardBg: "#141516",
  tileBg: "#191A1C",
  pageBg: "#0B0B0C",
  text: "#FFFFFF",
  textDim: "#9A9A9A",
  textFaint: "#6E6E70",
  grid: "rgba(255, 255, 255, 0.065)",
  tileRadius: "16px",
  cardRadius: "20px",
  font: `ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
};

/**
 * Helle Variante. Teal und Orange sind kräftiger als im Dunkelmodus — die
 * Originaltöne haben auf Weiss zu wenig Kontrast und wirken ausgewaschen.
 */
export const LIGHT_TOKENS = {
  cardBg: "#FFFFFF",
  tileBg: "#F3F4F6",
  pageBg: "#F0F1F3",
  text: "#101113",
  textDim: "#5F646C",
  textFaint: "#8B9098",
  grid: "rgba(0, 0, 0, 0.08)",
};

/**
 * Standard-Schwellen in Watt. Bis 300 W bleibt alles rein teal — deshalb ist
 * die Kurve in IMG_4945 (Spitze 78 W) durchgehend grün, während sie in
 * IMG_4950 (812 W) nach oben hin orange ausläuft.
 */
export const DEFAULT_THRESHOLDS = [
  { value: 0, color: "#3ED2AC" },
  { value: 300, color: "#3ED2AC" },
  { value: 900, color: "#f06b1c" },
];

export const DEFAULT_THRESHOLDS_LIGHT = [
  { value: 0, color: "#12A87E" },
  { value: 300, color: "#12A87E" },
  { value: 900, color: "#f06b1c" },
];

export const ACCENT = { dark: "#3ED2AC", light: "#12A87E" };

/**
 * Ob ein Farbwert hell ist. Dient dazu, das aktive Home-Assistant-Theme zu
 * erkennen: statt auf `prefers-color-scheme` zu setzen — das an einem hellen
 * HA-Theme im dunklen System vorbeiginge — messen wir die Textfarbe, die die
 * Karte vom Dashboard erbt.
 */
export function isLightColor(color) {
  const [r, g, b] = parseColor(color);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

/* ------------------------------------------------------------------ *
 * Farbmathematik
 *
 * Zwischen Teal und Orange direkt in sRGB zu interpolieren ergibt in der
 * Mitte ein schmutziges Graubraun. Über OKLab bleibt der Verlauf sauber
 * und gleichmäßig hell — genau wie in der Vorlage.
 * ------------------------------------------------------------------ */

export function parseColor(input) {
  if (Array.isArray(input)) return input.slice(0, 3);
  const value = String(input).trim();

  const hex = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) digits = digits.replace(/./g, (c) => c + c);
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
    ];
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length >= 3) return parts.slice(0, 3);
  }

  return [62, 210, 172];
}

export function toHex([r, g, b]) {
  const channel = (n) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function withAlpha(color, alpha) {
  const [r, g, b] = parseColor(color);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

const srgbToLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (v) =>
  (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255;

function rgbToOklab(rgb) {
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** Mischt zwei Farben über OKLab. `t` von 0 (a) bis 1 (b). */
export function mixColors(a, b, t) {
  const clamped = Math.max(0, Math.min(1, t));
  const labA = rgbToOklab(parseColor(a));
  const labB = rgbToOklab(parseColor(b));
  const lab = labA.map((v, i) => v + (labB[i] - v) * clamped);
  return toHex(oklabToRgb(lab));
}

/* ------------------------------------------------------------------ *
 * Schwellen
 * ------------------------------------------------------------------ */

export function normalizeThresholds(thresholds) {
  const list = (Array.isArray(thresholds) && thresholds.length
    ? thresholds
    : DEFAULT_THRESHOLDS
  )
    .filter((t) => t && Number.isFinite(Number(t.value)) && t.color)
    .map((t) => ({ value: Number(t.value), color: String(t.color) }))
    .sort((a, b) => a.value - b.value);

  return list.length ? list : DEFAULT_THRESHOLDS;
}

/** Die Farbe, die ein einzelner Messwert bekommt (Ring, Header, Cursor). */
export function colorForValue(value, thresholds) {
  const stops = normalizeThresholds(thresholds);
  const v = Number(value);
  if (!Number.isFinite(v)) return stops[0].color;

  if (v <= stops[0].value) return stops[0].color;
  const last = stops[stops.length - 1];
  if (v >= last.value) return last.color;

  for (let i = 0; i < stops.length - 1; i++) {
    const lo = stops[i];
    const hi = stops[i + 1];
    if (v >= lo.value && v <= hi.value) {
      const span = hi.value - lo.value;
      const t = span === 0 ? 0 : (v - lo.value) / span;
      return mixColors(lo.color, hi.color, t);
    }
  }

  return last.color;
}

/**
 * Übersetzt die Watt-Schwellen in SVG-Gradient-Stops für eine Achse, die von
 * 0 bis `scaleMax` reicht. Stops außerhalb der Achse werden nicht einfach
 * geklemmt, sondern an den Rändern korrekt interpoliert — sonst würde eine
 * Achse, die nur bis 100 W reicht, an ihrer Oberkante fälschlich Orange zeigen.
 *
 * offset 0 = unten (0 W), offset 1 = oben (scaleMax).
 */
export function buildGradientStops(thresholds, scaleMax) {
  const stops = normalizeThresholds(thresholds);
  const max = scaleMax > 0 ? scaleMax : 1;

  const inside = stops
    .filter((s) => s.value > 0 && s.value < max)
    .map((s) => ({ offset: s.value / max, color: s.color }));

  return [
    { offset: 0, color: colorForValue(0, stops) },
    ...inside,
    { offset: 1, color: colorForValue(max, stops) },
  ];
}
