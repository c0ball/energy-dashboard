// energy-card/src/theme.js
var TOKENS = {
  cardBg: "#141516",
  tileBg: "#191A1C",
  pageBg: "#0B0B0C",
  text: "#FFFFFF",
  textDim: "#9A9A9A",
  textFaint: "#6E6E70",
  grid: "rgba(255, 255, 255, 0.065)",
  tileRadius: "16px",
  cardRadius: "20px",
  font: `ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
};
var LIGHT_TOKENS = {
  cardBg: "#FFFFFF",
  tileBg: "#F3F4F6",
  pageBg: "#F0F1F3",
  text: "#101113",
  textDim: "#5F646C",
  textFaint: "#8B9098",
  grid: "rgba(0, 0, 0, 0.08)"
};
var DEFAULT_THRESHOLDS = [
  { value: 0, color: "#3ED2AC" },
  { value: 300, color: "#3ED2AC" },
  { value: 900, color: "#f06b1c" }
];
var DEFAULT_THRESHOLDS_LIGHT = [
  { value: 0, color: "#12A87E" },
  { value: 300, color: "#12A87E" },
  { value: 900, color: "#f06b1c" }
];
function isLightColor(color) {
  const [r, g, b] = parseColor(color);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}
function parseColor(input) {
  if (Array.isArray(input)) return input.slice(0, 3);
  const value = String(input).trim();
  const hex = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) digits = digits.replace(/./g, (c) => c + c);
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16)
    ];
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length >= 3) return parts.slice(0, 3);
  }
  return [62, 210, 172];
}
function toHex([r, g, b]) {
  const channel = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
function withAlpha(color, alpha) {
  const [r, g, b] = parseColor(color);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}
var srgbToLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
var linearToSrgb = (v) => (v <= 31308e-7 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255;
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
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}
function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ];
}
function mixColors(a, b, t2) {
  const clamped = Math.max(0, Math.min(1, t2));
  const labA = rgbToOklab(parseColor(a));
  const labB = rgbToOklab(parseColor(b));
  const lab = labA.map((v, i) => v + (labB[i] - v) * clamped);
  return toHex(oklabToRgb(lab));
}
function normalizeThresholds(thresholds) {
  const list = (Array.isArray(thresholds) && thresholds.length ? thresholds : DEFAULT_THRESHOLDS).filter((t2) => t2 && Number.isFinite(Number(t2.value)) && t2.color).map((t2) => ({ value: Number(t2.value), color: String(t2.color) })).sort((a, b) => a.value - b.value);
  return list.length ? list : DEFAULT_THRESHOLDS;
}
function colorForValue(value, thresholds) {
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
      const t2 = span === 0 ? 0 : (v - lo.value) / span;
      return mixColors(lo.color, hi.color, t2);
    }
  }
  return last.color;
}
function buildGradientStops(thresholds, scaleMax) {
  const stops = normalizeThresholds(thresholds);
  const max = scaleMax > 0 ? scaleMax : 1;
  const inside = stops.filter((s) => s.value > 0 && s.value < max).map((s) => ({ offset: s.value / max, color: s.color }));
  return [
    { offset: 0, color: colorForValue(0, stops) },
    ...inside,
    { offset: 1, color: colorForValue(max, stops) }
  ];
}

// energy-card/src/styles.js
var CARD_STYLES = `
  :host {
    display: block;
    height: 100%;
    --ec-card-bg: ${TOKENS.cardBg};
    --ec-tile-bg: ${TOKENS.tileBg};
    --ec-text: ${TOKENS.text};
    --ec-text-dim: ${TOKENS.textDim};
    --ec-text-faint: ${TOKENS.textFaint};
    --ec-grid: ${TOKENS.grid};
    --ec-accent: #3ED2AC;
    --ec-pill-border: #303234;
    --ec-pill-border-active: rgba(255, 255, 255, 0.85);
    --ec-cursor-line: rgba(255, 255, 255, 0.35);
    --ec-ring-track: #2C2E31;
    --ec-band: #FFFFFF;
    --ec-delta-up: ${DEFAULT_THRESHOLDS.at(-1).color};
    --ec-font: ${TOKENS.font};

    --ec-title-size: 20px;
    --ec-value-size: 34px;
    --ec-unit-size: 27px;
    --ec-label-size: 17px;
    --ec-ring-size: 40px;
    --ec-pad: 20px;
  }

  .card.light {
    --ec-card-bg: ${LIGHT_TOKENS.cardBg};
    --ec-tile-bg: ${LIGHT_TOKENS.tileBg};
    --ec-text: ${LIGHT_TOKENS.text};
    --ec-text-dim: ${LIGHT_TOKENS.textDim};
    --ec-text-faint: ${LIGHT_TOKENS.textFaint};
    --ec-grid: ${LIGHT_TOKENS.grid};
    --ec-accent: #12A87E;
    --ec-pill-border: #D8DBDF;
    --ec-pill-border-active: rgba(16, 17, 19, 0.85);
    --ec-cursor-line: rgba(16, 17, 19, 0.35);
    --ec-ring-track: #E3E5E8;
    --ec-band: #101113;
    --ec-delta-up: ${DEFAULT_THRESHOLDS_LIGHT.at(-1).color};
  }

  .card {
    background: var(--ec-card-bg);
    /* Folgt dem Thema und wird in der Panel-Ansicht automatisch eckig, weil
       Home Assistant dort --ha-card-border-radius auf 0 setzt. */
    border-radius: var(--ha-card-border-radius, ${TOKENS.cardRadius});
    padding: 18px 0 16px;
    font-family: var(--ec-font);
    color: var(--ec-text);
    overflow: hidden;
    -webkit-font-smoothing: antialiased;

    /* Spaltenaufbau, damit das Chart \xFCbersch\xFCssige H\xF6he aufnehmen kann.
       height statt min-height: nur mit fester H\xF6he entsteht in der
       Panel-Ansicht auch Schrumpfdruck, sodass das Chart bei knapper H\xF6he
       kleiner wird, statt die Karte unten hinauslaufen zu lassen. Wo der
       Beh\xE4lter keine H\xF6he vorgibt, l\xF6st der Prozentwert ohnehin zu auto auf. */
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
  }

  /* Alles ausser dem Chart beh\xE4lt seine nat\xFCrliche H\xF6he */
  .title,
  .header,
  .ranges,
  .zoom-reset,
  .stats,
  .error { flex: 0 0 auto; }

  .card.is-wide { padding: 24px 0 22px; --ec-pad: 28px; }
  .card.is-wide {
    --ec-title-size: 22px;
    --ec-value-size: 42px;
    --ec-unit-size: 32px;
    --ec-label-size: 18px;
    --ec-ring-size: 48px;
  }
  .card.is-xwide {
    --ec-pad: 34px;
    --ec-value-size: 48px;
    --ec-unit-size: 36px;
    --ec-ring-size: 54px;
  }
  .card.is-narrow {
    --ec-pad: 16px;
    --ec-value-size: 30px;
    --ec-unit-size: 24px;
    --ec-label-size: 16px;
  }

  .title {
    margin: 0 0 14px;
    padding: 0 var(--ec-pad);
    text-align: center;
    font-size: var(--ec-title-size);
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  /* ---------------- Kopfbereich ---------------- */

  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 var(--ec-pad) 4px;
    cursor: pointer;
  }

  .ring {
    flex: 0 0 auto;
    width: var(--ec-ring-size);
    height: var(--ec-ring-size);
  }
  .ring circle {
    fill: none;
    stroke-width: 6;
    stroke-linecap: round;
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
  }
  .ring .track { stroke: var(--ec-ring-track); }
  .ring .value-arc { transition: stroke-dashoffset 260ms ease, stroke 260ms ease; }

  .headline { min-width: 0; flex: 1; }

  .headline .label {
    font-size: var(--ec-label-size);
    font-weight: 500;
    color: var(--ec-text-dim);
    line-height: 1.2;
  }

  .headline .value {
    font-size: var(--ec-value-size);
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
  .headline .value .unit {
    font-size: var(--ec-unit-size);
    font-weight: 700;
    margin-left: 7px;
  }

  /* ---------------- Live-Anzeige ---------------- */

  .live {
    flex: 0 0 auto;
    align-self: flex-start;
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--ec-text-dim);
    opacity: 0;
    transition: opacity 240ms ease;
    pointer-events: none;
  }
  .live.visible { opacity: 1; }

  .live .dot {
    position: relative;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ec-live-color, var(--ec-accent));
    transition: background 260ms ease;
  }
  /* Der Ring l\xE4uft aus dem Punkt heraus, statt den Punkt selbst zu skalieren \u2014
     so bleibt der Kern ruhig lesbar. */
  .live .dot::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: inherit;
    animation: teg-pulse 1900ms cubic-bezier(0.2, 0.7, 0.4, 1) infinite;
  }

  @keyframes teg-pulse {
    0%   { transform: scale(1);   opacity: 0.55; }
    70%  { transform: scale(3.2); opacity: 0; }
    100% { transform: scale(3.2); opacity: 0; }
  }

  /* Endpunkt der Kurve atmet im Takt mit. Nur der Pulsring wird animiert \u2014
     Hof und Kern bleiben stehen, damit das Kurvenende jederzeit ablesbar ist. */
  svg.chart .end-pulse {
    transform-origin: center;
    transform-box: fill-box;
    opacity: 0;
  }
  svg.chart .end.live .end-pulse {
    animation: teg-breathe 1900ms cubic-bezier(0.2, 0.7, 0.4, 1) infinite;
  }

  @keyframes teg-breathe {
    0%   { transform: scale(0.6); opacity: 0.65; }
    70%  { transform: scale(2.4); opacity: 0; }
    100% { transform: scale(2.4); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .live .dot::after,
    svg.chart .end.live .end-pulse { animation: none; }
    .loading-bar::after { animation: none; }
  }

  /* ---------------- Chart ---------------- */

  .chart-wrap {
    position: relative;
    margin-top: 12px;
    padding: 0 14px 0 8px;
    /* Grundh\xF6he kommt aus der Breite (in card.js gesetzt); bleibt dar\xFCber
       hinaus Platz, w\xE4chst das Chart hinein statt Leerraum zu lassen. */
    flex: 1 1 var(--ec-chart-basis, 220px);
    min-height: 170px;
    touch-action: pan-y;          /* vertikales Scrollen bleibt dem Dashboard */
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .card.is-wide .chart-wrap { padding: 0 20px 0 14px; }
  .chart-wrap.grabbing { cursor: grabbing; }

  svg.chart { display: block; width: 100%; overflow: visible; }

  svg.chart .grid line {
    stroke: var(--ec-grid);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }

  svg.chart .axis-label {
    fill: var(--ec-text-faint);
    font-family: var(--ec-font);
    font-size: 13px;
    font-weight: 500;
    dominant-baseline: middle;
  }
  svg.chart .axis-unit {
    fill: var(--ec-text-faint);
    font-family: var(--ec-font);
    font-size: 12px;
    font-weight: 500;
  }
  .card.is-wide svg.chart .axis-label { font-size: 14px; }

  /* Schmaler Rand in Kartenfarbe: sonst verschwimmt der Punkt im hellen Thema
     mit der Fl\xE4che, \xFCber der er sitzt. */
  svg.chart .end-dot,
  svg.chart .cursor-dot {
    stroke: var(--ec-card-bg);
    stroke-width: 1.5;
  }

  svg.chart .cursor-line {
    stroke: var(--ec-cursor-line);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    inset: 0;
    color: var(--ec-text-faint);
    font-size: 14px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms ease;
  }
  .empty.visible { opacity: 1; }

  .loading-bar {
    position: absolute;
    left: 8px;
    right: 14px;
    top: 0;
    height: 2px;
    overflow: hidden;
    opacity: 0;
    transition: opacity 160ms ease;
  }
  .loading-bar.visible { opacity: 1; }
  .loading-bar::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, var(--ec-accent), transparent);
    animation: teg-sweep 1.1s linear infinite;
  }
  @keyframes teg-sweep {
    from { transform: translateX(-100%); }
    to { transform: translateX(100%); }
  }

  /* ---------------- Zeitraum-Pillen ---------------- */

  .ranges {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 14px;
    padding: 0 16px;
    flex-wrap: wrap;
  }
  .card.is-wide .ranges { gap: 10px; margin-top: 18px; }

  .ranges button {
    appearance: none;
    background: transparent;
    color: var(--ec-text-dim);
    border: 1px solid var(--ec-pill-border);
    border-radius: 12px;
    padding: 9px 15px;
    font-family: var(--ec-font);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: color 160ms ease, border-color 160ms ease;
  }
  .ranges button:hover { color: var(--ec-text); }
  .ranges button:focus-visible {
    outline: 2px solid var(--ec-accent);
    outline-offset: 2px;
  }
  .ranges button.active {
    color: var(--ec-text);
    border-color: var(--ec-pill-border-active);
  }
  .card.is-wide .ranges button { padding: 10px 20px; font-size: 16px; }
  .card.is-narrow .ranges button { padding: 8px 12px; font-size: 14px; }

  .zoom-reset {
    display: none;
    margin: 10px auto 0;
    appearance: none;
    background: color-mix(in srgb, var(--ec-text) 10%, transparent);
    color: var(--ec-text);
    border: none;
    border-radius: 999px;
    padding: 6px 14px;
    font-family: var(--ec-font);
    font-size: 13px;
    cursor: pointer;
  }
  .zoom-reset.visible { display: block; }

  /* ---------------- Reiter ---------------- */

  /* Der Abstand nach unten ist bewusst grossz\xFCgig: die Reiterleiste ist eine
     Navigationsebene, der Kopf darunter der Inhalt. Kleben beide aneinander,
     liest sich \u201EJetzt gerade" wie eine Unterzeile des Reiters. */
  .tabs {
    display: flex;
    gap: 4px;
    margin: 4px var(--ec-pad) 18px;
    padding: 3px;
    background: var(--ec-tile-bg);
    border-radius: 12px;
  }
  .tabs button {
    appearance: none;
    flex: 1 1 0;
    background: transparent;
    color: var(--ec-text-dim);
    border: none;
    border-radius: 9px;
    padding: 8px 10px;
    font-family: var(--ec-font);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease;
  }
  .tabs button:hover { color: var(--ec-text); }
  .tabs button:focus-visible { outline: 2px solid var(--ec-accent); outline-offset: 1px; }
  .tabs button.active {
    background: var(--ec-card-bg);
    color: var(--ec-text);
  }
  .card.is-wide .tabs { font-size: 15px; margin-bottom: 24px; }
  .card.is-wide .tabs button { padding: 10px 12px; font-size: 15px; }

  /* Die inaktive Ansicht bleibt im DOM: Zur\xFCckschalten ist dann sofort da,
     statt Chart und Daten neu aufzubauen. */
  .view[hidden] { display: none; }
  .view {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }

  /* ---------------- Analyse ---------------- */

  .analysis .levels {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 12px;
    padding: 0 16px;
    flex-wrap: wrap;
    flex: 0 0 auto;
  }
  .analysis .levels button {
    appearance: none;
    background: transparent;
    color: var(--ec-text-dim);
    border: 1px solid var(--ec-pill-border);
    border-radius: 12px;
    padding: 8px 14px;
    font-family: var(--ec-font);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: color 160ms ease, border-color 160ms ease;
  }
  .analysis .levels button:hover { color: var(--ec-text); }
  .analysis .levels button:focus-visible {
    outline: 2px solid var(--ec-accent);
    outline-offset: 2px;
  }
  .analysis .levels button.active {
    color: var(--ec-text);
    border-color: var(--ec-pill-border-active);
  }

  .period-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    padding: 0 var(--ec-pad);
    flex: 0 0 auto;
  }
  .period-nav .nav {
    appearance: none;
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    background: var(--ec-tile-bg);
    color: var(--ec-text);
    border: none;
    border-radius: 999px;
    cursor: pointer;
    transition: opacity 160ms ease;
  }
  .period-nav .nav svg { width: 22px; height: 22px; fill: currentColor; }
  .period-nav .nav:disabled { opacity: 0.3; cursor: default; }
  .period-nav .nav:focus-visible { outline: 2px solid var(--ec-accent); outline-offset: 2px; }

  .period-title { flex: 1 1 auto; text-align: center; min-width: 0; }
  .period-label {
    font-size: 17px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .period-sub {
    margin-top: 1px;
    font-size: 13px;
    color: var(--ec-text-faint);
    height: 0;
    opacity: 0;
    transition: opacity 160ms ease;
  }
  .period-sub.visible { height: auto; opacity: 1; }
  .card.is-wide .period-label { font-size: 19px; }

  .summary {
    margin-top: 14px;
    padding: 0 var(--ec-pad);
    flex: 0 0 auto;
  }
  .summary-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .value-mode {
    display: flex;
    flex: 0 0 auto;
    gap: 2px;
    padding: 2px;
    background: var(--ec-tile-bg);
    border-radius: 9px;
  }
  .value-mode[hidden] { display: none; }
  .value-mode button {
    appearance: none;
    background: transparent;
    color: var(--ec-text-dim);
    border: none;
    border-radius: 7px;
    padding: 4px 10px;
    min-width: 34px;
    font-family: var(--ec-font);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .value-mode button.active { background: var(--ec-card-bg); color: var(--ec-text); }
  .value-mode button:focus-visible { outline: 2px solid var(--ec-accent); outline-offset: 1px; }

  .summary-value {
    font-size: var(--ec-value-size);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.05;
  }
  .summary-value .unit {
    font-size: var(--ec-unit-size);
    font-weight: 600;
    margin-left: 4px;
    color: var(--ec-text-dim);
  }
  .summary-value .unit.prefix { margin-left: 0; margin-right: 3px; }
  .summary-sub {
    margin-top: 4px;
    font-size: 14px;
    color: var(--ec-text-dim);
    min-height: 1em;
  }
  .summary-delta {
    margin-top: 2px;
    font-size: 14px;
    font-weight: 600;
    color: var(--ec-text-faint);
    min-height: 1em;
  }
  /* Mehr verbraucht ist nicht \u201Eschlecht", aber es soll auffallen \u2014 deshalb
     die Signalfarbe der Kurve statt eines eigenen Rot-Gr\xFCn-Paars. */
  .summary-delta.up { color: var(--ec-delta-up); }
  .summary-delta.down { color: var(--ec-accent); }

  .bars-wrap {
    position: relative;
    margin-top: 10px;
    padding: 0 14px 0 8px;
    flex: 1 1 var(--ec-chart-basis, 220px);
    min-height: 150px;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .card.is-wide .bars-wrap { padding: 0 20px 0 14px; }

  svg.bars { display: block; width: 100%; overflow: visible; }
  svg.bars .grid line {
    stroke: var(--ec-grid);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  svg.bars .axis-label {
    fill: var(--ec-text-faint);
    font-family: var(--ec-font);
    font-size: 12px;
    font-weight: 500;
    dominant-baseline: middle;
  }
  svg.bars .axis-unit {
    fill: var(--ec-text-faint);
    font-family: var(--ec-font);
    font-size: 12px;
    font-weight: 500;
  }
  svg.bars .bar { transition: opacity 140ms ease; }
  /* Vorperiode und Hochrechnung sind beide \u201Enicht jetzt gemessen" und teilen
     sich deshalb die zur\xFCckgenommene Darstellung. */
  svg.bars .ghost { fill: var(--ec-band); opacity: 0.11; }
  svg.bars .bar-future { opacity: 0.22; }
  /* Das Wochenmuster steht dauerhaft unter den Balken: es beantwortet \u201Ewann"
     statt \u201Ewie viel", und beides nebeneinander zu sehen ist der eigentliche
     Gewinn. Deshalb ein ruhiger Trenner statt einer zweiten \xDCberschrift. */
  .pattern {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--ec-grid);
    flex: 0 0 auto;
  }
  .pattern[hidden] { display: none; }

  .pattern-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 0 var(--ec-pad);
  }
  .pattern-name { font-size: 15px; font-weight: 600; }
  .pattern-sub {
    margin-left: 8px;
    font-size: 13px;
    color: var(--ec-text-faint);
  }
  .pattern-readout { text-align: right; white-space: nowrap; }
  .pattern-value { font-size: 17px; font-weight: 700; }
  .pattern-value .unit {
    font-size: 13px;
    font-weight: 600;
    margin-left: 3px;
    color: var(--ec-text-dim);
  }
  .pattern-when {
    display: block;
    font-size: 12px;
    color: var(--ec-text-faint);
  }
  .card.is-narrow .pattern-sub { display: none; }

  .heatmap-wrap {
    margin-top: 10px;
    padding: 0 14px 0 8px;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .card.is-wide .heatmap-wrap { padding: 0 20px 0 14px; }

  svg.heatmap { display: block; width: 100%; overflow: visible; }
  svg.heatmap .axis-label {
    fill: var(--ec-text-faint);
    font-family: var(--ec-font);
    font-size: 11px;
    font-weight: 500;
  }
  svg.heatmap .cell { transition: opacity 120ms ease; }
  svg.heatmap .cell.selected {
    stroke: var(--ec-text);
    stroke-width: 1.5;
    opacity: 1 !important;
  }

  svg.bars .average {
    stroke: var(--ec-text-faint);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    opacity: 0.7;
  }

  .to-current {
    display: none;
    margin: 10px auto 0;
    appearance: none;
    background: color-mix(in srgb, var(--ec-text) 10%, transparent);
    color: var(--ec-text);
    border: none;
    border-radius: 999px;
    padding: 6px 14px;
    font-family: var(--ec-font);
    font-size: 13px;
    cursor: pointer;
    flex: 0 0 auto;
  }
  .to-current.visible { display: block; }

  /* Die Grundlast steht ruhig unter dem Chart \u2014 sie \xE4ndert sich kaum und soll
     nicht mit den Zahlen des gew\xE4hlten Zeitraums konkurrieren. */
  .baseload {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 12px;
    padding: 0 var(--ec-pad);
    font-size: 13px;
    flex: 0 0 auto;
  }
  .baseload[hidden] { display: none; }
  .baseload-label { color: var(--ec-text-faint); font-weight: 600; flex: 0 0 auto; }
  .baseload-value { color: var(--ec-text-dim); }

  /* ---------------- Stat-Kacheln ---------------- */

  /* Die Spaltenbreite richtet sich nach der l\xE4ngsten \xDCberschrift, und die ist
     im Deutschen \u201EVerbrauch Ausschnitt" \u2014 bei 150px wurde das Symbol aus der
     Kachel gedr\xE4ngt. Englisch k\xE4me mit deutlich weniger aus; eine Breite je
     Sprache w\xE4re aber nur schwer nachvollziehbar. */
  .stats {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(180px, 1fr);
    gap: 10px;
    margin-top: 18px;
    padding: 0 var(--ec-pad) 2px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .stats::-webkit-scrollbar { display: none; }

  /* Ab Tablet-Breite passen alle drei Kacheln nebeneinander \u2014 dann kein
     Wischen mehr, sondern gleichm\xE4ssig verteilt. */
  .card.is-wide .stats {
    grid-auto-flow: row;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-top: 24px;
    overflow-x: visible;
  }

  .tile {
    background: var(--ec-tile-bg);
    border-radius: ${TOKENS.tileRadius};
    padding: 14px 16px 16px;
    cursor: pointer;
  }
  .card.is-wide .tile { padding: 18px 20px 20px; }

  .tile .tile-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--ec-text-dim);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }
  /* Letzte Sicherung: ohne min-width schiebt ein zu langer Text das Symbol aus
     der Kachel heraus, statt selbst zu k\xFCrzen \u2014 unabh\xE4ngig von der Sprache. */
  .tile .tile-head span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card.is-wide .tile .tile-head { font-size: 14px; }
  .tile .tile-head svg { width: 17px; height: 17px; fill: currentColor; flex: 0 0 auto; }

  .tile .tile-value {
    margin-top: 10px;
    font-size: 23px;
    font-weight: 700;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .tile .tile-value .unit { font-size: 18px; margin-left: 3px; }
  .card.is-wide .tile .tile-value { font-size: 27px; }

  .tile .tile-sub {
    margin-top: 2px;
    font-size: 14px;
    color: var(--ec-text-dim);
    min-height: 1em;
  }

  /* Die Tagesreihe ist eine Erg\xE4nzung, keine gleichrangige Zeile: etwas
     flacher und mit kleinerem Wert, damit der Blick beim Zeitraum bleibt.
     Die Regeln stehen bewusst nach den .is-wide-Bl\xF6cken \u2014 gleiche
     Spezifit\xE4t, also entscheidet die Reihenfolge. */
  .stats-today { margin-top: 10px; }
  .stats-today .tile { padding: 11px 16px 12px; }
  .stats-today .tile .tile-head { font-size: 13px; }
  .stats-today .tile .tile-value { margin-top: 6px; font-size: 19px; }
  .stats-today .tile .tile-value .unit { font-size: 15px; }
  .stats-today .tile .tile-sub { font-size: 13px; }

  .card.is-wide .stats-today { margin-top: 14px; }
  .card.is-wide .stats-today .tile { padding: 14px 20px 15px; }
  .card.is-wide .stats-today .tile .tile-value { font-size: 22px; }

  .error {
    padding: 20px;
    color: #F06B1C;
    font-family: var(--ec-font);
    font-size: 14px;
  }
`;

// energy-card/src/data.js
var MINUTE = 6e4;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
var RANGES = [
  { key: "5min", labelKey: "range_5min", windowMs: 5 * MINUTE },
  { key: "1h", labelKey: "range_1h", windowMs: HOUR },
  { key: "6h", labelKey: "range_6h", windowMs: 6 * HOUR },
  { key: "12h", labelKey: "range_12h", windowMs: 12 * HOUR },
  { key: "24h", labelKey: "range_24h", windowMs: DAY },
  { key: "7d", labelKey: "range_7d", windowMs: 7 * DAY },
  { key: "30d", labelKey: "range_30d", windowMs: 30 * DAY }
];
var DEFAULT_RANGE_KEYS = ["5min", "1h", "24h", "7d", "30d"];
var DEFAULT_START_RANGE = "1h";
function sortRangeKeys(keys) {
  const order = new Map(RANGES.map((range, index) => [range.key, index]));
  return [...keys].sort((a, b) => order.get(a) - order.get(b));
}
function rangeByKey(key) {
  return RANGES.find((r) => r.key === key) || RANGES[1];
}
function pickResolution(windowMs) {
  if (windowMs <= 3 * HOUR) return { source: "history", period: null, live: true };
  if (windowMs <= 36 * HOUR) return { source: "statistics", period: "5minute", live: false };
  if (windowMs <= 35 * DAY) return { source: "statistics", period: "hour", live: false };
  return { source: "statistics", period: "day", live: false };
}
var toMs = (value) => {
  if (typeof value === "number") return value < 1e12 ? value * 1e3 : value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};
var isUsableState = (state) => state != null && state !== "unavailable" && state !== "unknown" && state !== "";
function powerFactor(unit) {
  switch (String(unit || "").trim()) {
    case "kW":
      return 1e3;
    case "MW":
      return 1e6;
    case "mW":
      return 1e-3;
    default:
      return 1;
  }
}
function entityUnit(hass, entityId) {
  return hass?.states?.[entityId]?.attributes?.unit_of_measurement || "W";
}
function downsample(points, threshold) {
  const n = points.length;
  if (threshold >= n || threshold < 3) return points;
  const sampled = [points[0]];
  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);
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
        (pointA.t - avgT) * (points[j].v - pointA.v) - (pointA.t - points[j].t) * (avgV - pointA.v)
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
function parseHistoryStates(entries, factor) {
  const points = [];
  for (const entry of entries || []) {
    const state = entry.s ?? entry.state;
    if (!isUsableState(state)) continue;
    const value = Number(state);
    if (!Number.isFinite(value)) continue;
    const t2 = toMs(entry.lu ?? entry.last_updated ?? entry.last_changed);
    if (t2 == null) continue;
    points.push({ t: t2, v: value * factor });
  }
  return points.sort((a, b) => a.t - b.t);
}
async function fetchHistory(hass, entityId, startMs, endMs) {
  const factor = powerFactor(entityUnit(hass, entityId));
  const response = await hass.callWS({
    type: "history/history_during_period",
    start_time: new Date(startMs).toISOString(),
    end_time: new Date(endMs).toISOString(),
    entity_ids: [entityId],
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false
  });
  return parseHistoryStates(response?.[entityId], factor);
}
async function subscribeHistory(hass, entityId, startMs, onPoints) {
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
        significant_changes_only: false
      }
    );
    return unsubscribe;
  } catch (err) {
    const points = await fetchHistory(hass, entityId, startMs, Date.now());
    if (points.length) onPoints(points);
    return () => {
    };
  }
}
function parseStatistics(entries, factor) {
  const points = [];
  for (const entry of entries || []) {
    const t2 = toMs(entry.start);
    if (t2 == null) continue;
    const mean = Number(entry.mean ?? entry.state);
    if (!Number.isFinite(mean)) continue;
    const min = Number(entry.min);
    const max = Number(entry.max);
    points.push({
      t: t2,
      v: mean * factor,
      min: Number.isFinite(min) ? min * factor : void 0,
      max: Number.isFinite(max) ? max * factor : void 0
    });
  }
  return points.sort((a, b) => a.t - b.t);
}
async function fetchStatistics(hass, entityId, startMs, endMs, period) {
  const response = await hass.callWS({
    type: "recorder/statistics_during_period",
    start_time: new Date(startMs).toISOString(),
    end_time: new Date(endMs).toISOString(),
    statistic_ids: [entityId],
    period,
    types: ["mean", "min", "max"],
    units: { power: "W" }
  });
  return parseStatistics(response?.[entityId], 1);
}
async function fetchSeries(hass, entityId, startMs, endMs, resolution = pickResolution(endMs - startMs)) {
  if (resolution.source === "statistics") {
    try {
      const points3 = await fetchStatistics(
        hass,
        entityId,
        startMs,
        endMs,
        resolution.period
      );
      if (points3.length) return { points: points3, resolution };
    } catch (err) {
    }
    const points2 = await fetchHistory(hass, entityId, startMs, endMs);
    return {
      points: downsample(points2, 600),
      resolution: { source: "history", period: null, live: false }
    };
  }
  const points = await fetchHistory(hass, entityId, startMs, endMs);
  return { points: downsample(points, 600), resolution };
}
function startOfToday() {
  const now = new Date(Date.now());
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}
async function fetchTodayExtremes(hass, entityId) {
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
      units: { power: "W" }
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
      const t2 = toMs(entry.start);
      const hi = Number(entry.max);
      const lo = Number(entry.min);
      const mean = Number(entry.mean);
      if (Number.isFinite(hi) && (!max || hi > max.value)) max = { value: hi, t: t2 };
      if (Number.isFinite(lo) && (!min || lo < min.value)) min = { value: lo, t: t2 };
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
function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[index];
}
async function fetchEnergyToday(hass, powerEntityId, energyEntityId) {
  if (energyEntityId && hass.states?.[energyEntityId]) {
    const state = hass.states[energyEntityId];
    const value = Number(state.state);
    if (isUsableState(state.state) && Number.isFinite(value)) {
      const unit = state.attributes?.unit_of_measurement;
      const kwh = unit === "Wh" ? value / 1e3 : unit === "MWh" ? value * 1e3 : value;
      if (state.attributes?.state_class !== "total_increasing" || kwh < 1e3) {
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
        units: { energy: "kWh" }
      });
      const change = Number(response?.[energyEntityId]?.[0]?.change);
      if (Number.isFinite(change)) return change;
    } catch (err) {
    }
  }
  const { points } = await fetchSeries(hass, powerEntityId, startOfToday(), Date.now());
  return integrateToKwh(points);
}
function integrateToKwh(points, { buckets = false, endMs = null } = {}) {
  if (!points || points.length < 2) return 0;
  let wattMs = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dt = points[i + 1].t - points[i].t;
    if (dt <= 0) continue;
    wattMs += buckets ? points[i].v * dt : (points[i].v + points[i + 1].v) / 2 * dt;
  }
  if (buckets) {
    const last = points.at(-1);
    const width = last.t - points.at(-2).t;
    const tail = endMs == null ? width : Math.min(width, Math.max(0, endMs - last.t));
    wattMs += last.v * tail;
  }
  return wattMs / 36e5 / 1e3;
}
function lowerBound(points, t2) {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (points[mid].t < t2) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function computeWindowStats(points, startMs, endMs, { buckets = false } = {}) {
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
    count: slice.length
  };
}
var ENERGY_STATS_MIN_MS = 2 * HOUR;
async function statisticsByStart(hass, statisticId, startMs, endMs, period, type, units) {
  const response = await hass.callWS({
    type: "recorder/statistics_during_period",
    start_time: new Date(startMs).toISOString(),
    end_time: new Date(endMs).toISOString(),
    statistic_ids: [statisticId],
    period,
    types: [type],
    ...units ? { units } : {}
  });
  const map = /* @__PURE__ */ new Map();
  for (const entry of response?.[statisticId] || []) {
    const t2 = toMs(entry.start);
    const value = Number(entry[type]);
    if (t2 != null && Number.isFinite(value)) map.set(t2, value);
  }
  return map;
}
async function fetchBuckets(hass, { energyEntityId, powerEntityId, startMs, endMs, period, starts }) {
  if (energyEntityId) {
    try {
      const map = await statisticsByStart(
        hass,
        energyEntityId,
        startMs,
        endMs,
        period,
        "change",
        { energy: "kWh" }
      );
      if (map.size) {
        return {
          source: "energy",
          buckets: starts.map((t2) => ({ t: t2, kwh: map.has(t2) ? map.get(t2) : null }))
        };
      }
    } catch (err) {
    }
  }
  if (!powerEntityId) return { source: null, buckets: starts.map((t2) => ({ t: t2, kwh: null })) };
  try {
    const map = await statisticsByStart(
      hass,
      powerEntityId,
      startMs,
      endMs,
      period,
      "mean",
      { power: "W" }
    );
    return {
      source: "power",
      buckets: starts.map((t2, i) => {
        if (!map.has(t2)) return { t: t2, kwh: null };
        const next = i + 1 < starts.length ? starts[i + 1] : endMs;
        return { t: t2, kwh: map.get(t2) * (next - t2) / 36e5 / 1e3 };
      })
    };
  } catch (err) {
    return { source: null, buckets: starts.map((t2) => ({ t: t2, kwh: null })) };
  }
}
async function fetchBaseload(hass, powerEntityId, days = 7) {
  if (!powerEntityId) return null;
  const end = Date.now();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  try {
    const map = await statisticsByStart(
      hass,
      powerEntityId,
      start.getTime(),
      end,
      "day",
      "min",
      { power: "W" }
    );
    const values = [...map.values()].filter((v) => Number.isFinite(v) && v >= 0);
    if (!values.length) return null;
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const watt = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    return { watt, kwhPerDay: watt * 24 / 1e3, days: values.length };
  } catch (err) {
    return null;
  }
}
async function fetchEnergyForPeriod(hass, energyEntityId, startMs, endMs) {
  if (!energyEntityId) return null;
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
      units: { energy: "kWh" }
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

// energy-card/src/svg.js
var SVG_NS = "http://www.w3.org/2000/svg";
var el = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
};
function syncNodes(group, items, tagName, update) {
  const nodes = group.childNodes;
  while (nodes.length > items.length) group.lastChild.remove();
  while (nodes.length < items.length) group.appendChild(el(tagName));
  items.forEach((item, i) => update(nodes[i], item));
}
function barPath(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  const right = x + width;
  const bottom = y + height;
  if (r <= 0) return `M${x} ${y}H${right}V${bottom}H${x}Z`;
  return `M${x} ${bottom}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}H${right - r}A${r} ${r} 0 0 1 ${right} ${y + r}V${bottom}Z`;
}

// energy-card/src/scale.js
function niceStep(rough) {
  const exponent = Math.floor(Math.log10(rough));
  const magnitude = 10 ** exponent;
  const fraction = rough / magnitude;
  let nice;
  if (fraction <= 1) nice = 1;
  else if (fraction <= 2) nice = 2;
  else if (fraction <= 2.5) nice = 2.5;
  else if (fraction <= 5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}
function yTicks(scaleMax, target = 4) {
  if (!(scaleMax > 0)) return { step: 1, ticks: [0] };
  const step = niceStep(scaleMax / target);
  const ticks = [];
  for (let v = 0; v <= scaleMax + 1e-6; v += step) ticks.push(Number(v.toFixed(6)));
  return { step, ticks };
}

// energy-card/src/chart.js
var PAD = { top: 26, right: 48, bottom: 26, left: 2 };
var gradientSeq = 0;
var pad2 = (n) => String(n).padStart(2, "0");
var clockLabel = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
var WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
function xTicks(startMs, endMs, maxTicks = 5) {
  const span = endMs - startMs;
  const MINUTE2 = 6e4;
  const HOUR4 = 60 * MINUTE2;
  const DAY3 = 24 * HOUR4;
  const candidates2 = [
    MINUTE2,
    2 * MINUTE2,
    5 * MINUTE2,
    10 * MINUTE2,
    15 * MINUTE2,
    30 * MINUTE2,
    HOUR4,
    2 * HOUR4,
    3 * HOUR4,
    6 * HOUR4,
    12 * HOUR4,
    DAY3,
    2 * DAY3,
    7 * DAY3,
    14 * DAY3
  ];
  const step = candidates2.find((c) => span / c <= maxTicks) ?? candidates2.at(-1);
  const format = step >= DAY3 ? (date) => span > 20 * DAY3 ? `${date.getDate()}.${date.getMonth() + 1}.` : WEEKDAYS[date.getDay()] : clockLabel;
  const first = new Date(startMs);
  if (step >= DAY3) first.setHours(0, 0, 0, 0);
  else first.setSeconds(0, 0);
  let t2 = Math.ceil(first.getTime() / step) * step;
  const offset = new Date(t2).getTimezoneOffset() * MINUTE2;
  t2 = Math.ceil((startMs - offset) / step) * step + offset;
  const ticks = [];
  for (; t2 <= endMs; t2 += step) {
    if (t2 >= startMs) ticks.push({ t: t2, label: format(new Date(t2)) });
  }
  return ticks;
}
var Chart = class {
  constructor(options = {}) {
    this.options = options;
    this.points = [];
    this.startMs = Date.now() - 36e5;
    this.endMs = Date.now();
    this.width = 0;
    this.height = 0;
    this.scaleMax = 1;
    this.showBand = false;
    this.thresholds = options.thresholds;
    this.liveEnd = true;
    this._buildSkeleton();
  }
  _buildSkeleton() {
    const uid = `teg${++gradientSeq}`;
    this.uid = uid;
    const svg = el("svg", {
      class: "chart",
      xmlns: SVG_NS,
      preserveAspectRatio: "none"
    });
    const defs = el("defs");
    this.strokeGradient = el("linearGradient", {
      id: `${uid}-stroke`,
      gradientUnits: "userSpaceOnUse"
    });
    this.fillGradient = el("linearGradient", {
      id: `${uid}-fill`,
      gradientUnits: "userSpaceOnUse"
    });
    this.bandGradient = el("linearGradient", {
      id: `${uid}-band`,
      gradientUnits: "userSpaceOnUse"
    });
    const glow = el("filter", {
      id: `${uid}-glow`,
      x: "-120%",
      y: "-120%",
      width: "340%",
      height: "340%"
    });
    glow.appendChild(el("feGaussianBlur", { stdDeviation: "4", result: "blur" }));
    const merge = el("feMerge");
    merge.appendChild(el("feMergeNode", { in: "blur" }));
    merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
    glow.appendChild(merge);
    this.clipRect = el("rect", { x: 0, y: 0, width: 0, height: 0 });
    const clip = el("clipPath", { id: `${uid}-clip` });
    clip.appendChild(this.clipRect);
    defs.append(this.strokeGradient, this.fillGradient, this.bandGradient, glow, clip);
    svg.appendChild(defs);
    this.gridGroup = el("g", { class: "grid" });
    this.plotGroup = el("g", { "clip-path": `url(#${uid}-clip)` });
    this.axisGroup = el("g", { class: "axis" });
    this.bandPath = el("path", {
      class: "band",
      fill: `url(#${uid}-band)`,
      stroke: "none"
    });
    this.areaPath = el("path", {
      class: "area",
      fill: `url(#${uid}-fill)`,
      stroke: "none"
    });
    this.linePath = el("path", {
      class: "line",
      fill: "none",
      stroke: `url(#${uid}-stroke)`,
      "stroke-width": "2.4",
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    });
    this.plotGroup.append(this.bandPath, this.areaPath, this.linePath);
    this.endHalo = el("circle", { class: "end-halo", r: "13" });
    this.endPulse = el("circle", { class: "end-pulse", r: "9" });
    this.endDot = el("circle", { class: "end-dot", r: "5", filter: `url(#${uid}-glow)` });
    this.endGroup = el("g", { class: "end" });
    this.endGroup.append(this.endHalo, this.endPulse, this.endDot);
    this.cursorLine = el("line", { class: "cursor-line" });
    this.cursorHalo = el("circle", { class: "cursor-halo", r: "11" });
    this.cursorDot = el("circle", { class: "cursor-dot", r: "5" });
    this.cursorGroup = el("g", { class: "cursor", opacity: "0" });
    this.cursorGroup.append(this.cursorLine, this.cursorHalo, this.cursorDot);
    svg.append(this.gridGroup, this.plotGroup, this.endGroup, this.cursorGroup, this.axisGroup);
    this.svg = svg;
  }
  /* -------------------------------------------------------------- */
  get plot() {
    return {
      x: PAD.left,
      y: PAD.top,
      width: Math.max(0, this.width - PAD.left - PAD.right),
      height: Math.max(0, this.height - PAD.top - PAD.bottom)
    };
  }
  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.svg.setAttribute("width", width);
    this.svg.setAttribute("height", height);
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  setSeries(points, { showBand = false } = {}) {
    this.points = points || [];
    this.showBand = showBand;
  }
  setWindow(startMs, endMs, { liveEnd = true } = {}) {
    this.startMs = startMs;
    this.endMs = endMs;
    this.liveEnd = liveEnd;
  }
  setThresholds(thresholds) {
    this.thresholds = thresholds;
  }
  /** Lässt den Punkt am Kurvenende atmen, solange Werte hereinströmen. */
  setLive(active) {
    this.endGroup.classList.toggle("live", !!active);
  }
  scaleX(t2) {
    const { x, width } = this.plot;
    const span = this.endMs - this.startMs || 1;
    return x + (t2 - this.startMs) / span * width;
  }
  scaleY(v) {
    const { y, height } = this.plot;
    const max = this.scaleMax || 1;
    return y + height - Math.max(0, v) / max * height;
  }
  /** Die im aktuellen Zeitfenster sichtbaren Punkte, mit je einem Nachbarn
   *  links und rechts, damit die Kurve am Rand nicht abknickt. */
  visiblePoints() {
    const points = this.points;
    if (!points.length) return [];
    let lo = lowerBound(points, this.startMs) - 1;
    let hi = lowerBound(points, this.endMs) + 1;
    lo = Math.max(0, lo);
    hi = Math.min(points.length, hi + 1);
    return points.slice(lo, hi);
  }
  /**
   * Obergrenze der Y-Achse: etwas Luft über dem Maximum, dann auf die nächste
   * Gitterlinie aufgerundet. Dadurch liegt die oberste Linie beschriftet am
   * Rand statt irgendwo im Nirgendwo — in der Vorlage endet die Skala bei
   * einer Spitze von rund 80 W genau auf 100.
   *
   * Bewusst nur die Kurvenwerte, nie die Bandobergrenze: eine einzelne
   * Kochspitze im Min/Max-Band zöge die Achse sonst auf das Doppelte und
   * drückte den Tagesrhythmus zu einer flachen Linie am unteren Rand. Das Band
   * darf stattdessen oben aus dem Bild laufen.
   */
  computeScaleMax(visible) {
    let max = 0;
    for (const point of visible) {
      if (point.v > max) max = point.v;
    }
    if (max <= 0) return 1;
    const raw = max * 1.05;
    const { step } = yTicks(raw);
    return Math.ceil(raw / step) * step;
  }
  /* -------------------------------------------------------------- */
  render() {
    const { x, y, width, height } = this.plot;
    if (width <= 0 || height <= 0) return;
    this.clipRect.setAttribute("x", x - 1);
    this.clipRect.setAttribute("y", y - 8);
    this.clipRect.setAttribute("width", width + 2);
    this.clipRect.setAttribute("height", height + 10);
    const scale = this.width >= 620 ? 1.35 : 1;
    this.linePath.setAttribute("stroke-width", (2.4 * scale).toFixed(2));
    this.endHalo.setAttribute("r", (13 * scale).toFixed(1));
    this.endPulse.setAttribute("r", (9 * scale).toFixed(1));
    this.endDot.setAttribute("r", (5 * scale).toFixed(1));
    this.cursorHalo.setAttribute("r", (11 * scale).toFixed(1));
    this.cursorDot.setAttribute("r", (5 * scale).toFixed(1));
    const visible = this.visiblePoints();
    this.scaleMax = this.computeScaleMax(visible);
    this._renderGradients();
    this._renderGrid();
    this._renderPaths(visible);
    this._renderEndpoint(visible);
  }
  _renderGradients() {
    const { y, height } = this.plot;
    const stops = buildGradientStops(this.thresholds, this.scaleMax);
    const apply = (gradient, alphaFor) => {
      gradient.setAttribute("x1", "0");
      gradient.setAttribute("x2", "0");
      gradient.setAttribute("y1", y + height);
      gradient.setAttribute("y2", y);
      gradient.textContent = "";
      for (const stop of stops) {
        gradient.appendChild(
          el("stop", {
            offset: stop.offset,
            "stop-color": stop.color,
            "stop-opacity": alphaFor(stop.offset)
          })
        );
      }
    };
    apply(this.strokeGradient, () => 1);
    apply(this.fillGradient, (offset) => 0.22 + offset * 0.18);
    this.bandGradient.setAttribute("x1", "0");
    this.bandGradient.setAttribute("x2", "0");
    this.bandGradient.setAttribute("y1", y + height);
    this.bandGradient.setAttribute("y2", y);
    this.bandGradient.textContent = "";
    for (const [offset, opacity] of [[0, 0.05], [0.5, 0.12], [0.86, 0.02], [1, 0]]) {
      this.bandGradient.appendChild(
        el("stop", { offset, "stop-color": "var(--ec-band, #FFFFFF)", "stop-opacity": opacity })
      );
    }
  }
  _renderGrid() {
    const { x, y, width, height } = this.plot;
    const { ticks } = yTicks(this.scaleMax);
    const lines = [];
    const labels = [];
    for (const tick of ticks) {
      const ty = this.scaleY(tick);
      if (ty < y - 1 || ty > y + height + 1) continue;
      lines.push({ y: ty });
      labels.push({ y: ty, text: formatTick(tick), anchor: "end", x: this.width - 6 });
    }
    syncNodes(this.gridGroup, lines, "line", (node, item) => {
      node.setAttribute("x1", x);
      node.setAttribute("x2", x + width + 8);
      node.setAttribute("y1", item.y);
      node.setAttribute("y2", item.y);
    });
    const maxTicks = Math.max(3, Math.min(8, Math.round(width / 58)));
    const xLabels = xTicks(this.startMs, this.endMs, maxTicks).map((tick) => ({
      x: this.scaleX(tick.t),
      y: this.height - 8,
      text: tick.label,
      anchor: "middle"
    }));
    const axisItems = [
      { x: this.width - 6, y: y - 13, text: this.options.unit || "W", anchor: "end", dim: true },
      ...labels,
      // Randnahe Zeitmarken bleiben stehen — in der Vorlage steht die erste
      // Uhrzeit ganz links am Kartenrand —, rutschen dort aber auf links- bzw.
      // rechtsbündig, damit sie nicht aus der Karte laufen
      ...xLabels.filter((l) => l.x >= x - 14 && l.x <= x + width + 14).map((l) => {
        if (l.x < x + 24) return { ...l, x, anchor: "start" };
        if (l.x > x + width - 24) return { ...l, x: x + width, anchor: "end" };
        return l;
      })
    ];
    syncNodes(this.axisGroup, axisItems, "text", (node, item) => {
      node.setAttribute("x", item.x);
      node.setAttribute("y", item.y);
      node.setAttribute("text-anchor", item.anchor);
      node.setAttribute("class", item.dim ? "axis-unit" : "axis-label");
      node.textContent = item.text;
    });
  }
  _renderPaths(visible) {
    if (visible.length < 2) {
      this.linePath.setAttribute("d", "");
      this.areaPath.setAttribute("d", "");
      this.bandPath.setAttribute("d", "");
      return;
    }
    const { y, height } = this.plot;
    const baseline = y + height;
    let d = "";
    for (let i = 0; i < visible.length; i++) {
      const px = this.scaleX(visible[i].t);
      const py = this.scaleY(visible[i].v);
      d += `${i === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`;
    }
    this.linePath.setAttribute("d", d);
    const firstX = this.scaleX(visible[0].t);
    const lastX = this.scaleX(visible[visible.length - 1].t);
    this.areaPath.setAttribute(
      "d",
      `${d}L${lastX.toFixed(2)} ${baseline.toFixed(2)}L${firstX.toFixed(2)} ${baseline.toFixed(2)}Z`
    );
    if (this.showBand && visible.some((p) => p.max != null)) {
      let upper = "";
      let lower = "";
      for (let i = 0; i < visible.length; i++) {
        const point = visible[i];
        const px = this.scaleX(point.t).toFixed(2);
        upper += `${i === 0 ? "M" : "L"}${px} ${this.scaleY(point.max ?? point.v).toFixed(2)}`;
      }
      for (let i = visible.length - 1; i >= 0; i--) {
        const point = visible[i];
        const px = this.scaleX(point.t).toFixed(2);
        lower += `L${px} ${this.scaleY(point.min ?? point.v).toFixed(2)}`;
      }
      this.bandPath.setAttribute("d", `${upper}${lower}Z`);
    } else {
      this.bandPath.setAttribute("d", "");
    }
  }
  _renderEndpoint(visible) {
    const last = visible[visible.length - 1];
    const showEnd = this.liveEnd && last && last.t >= this.startMs;
    if (!showEnd) {
      this.endGroup.setAttribute("opacity", "0");
      return;
    }
    const color = colorForValue(last.v, this.thresholds);
    const px = this.scaleX(last.t);
    const py = this.scaleY(last.v);
    this.endGroup.setAttribute("opacity", "1");
    this.endGroup.setAttribute("transform", `translate(${px.toFixed(2)} ${py.toFixed(2)})`);
    this.endHalo.setAttribute("fill", withAlpha(color, 0.28));
    this.endPulse.setAttribute("fill", withAlpha(color, 0.55));
    this.endDot.setAttribute("fill", color);
  }
  /* -------------------------------------------------------------- *
   * Scrubbing
   * -------------------------------------------------------------- */
  /** Index des Messwerts, der einer Pixelposition am nächsten liegt. */
  indexAtX(px) {
    const points = this.points;
    if (!points.length) return -1;
    const { x, width } = this.plot;
    const clamped = Math.max(x, Math.min(x + width, px));
    const span = this.endMs - this.startMs || 1;
    const t2 = this.startMs + (clamped - x) / width * span;
    const i = lowerBound(points, t2);
    if (i <= 0) return 0;
    if (i >= points.length) return points.length - 1;
    return Math.abs(points[i].t - t2) < Math.abs(points[i - 1].t - t2) ? i : i - 1;
  }
  showCursor(index) {
    const point = this.points[index];
    if (!point) return null;
    const { y, height } = this.plot;
    const px = this.scaleX(point.t);
    const py = this.scaleY(point.v);
    const color = colorForValue(point.v, this.thresholds);
    this.cursorGroup.setAttribute("opacity", "1");
    this.cursorLine.setAttribute("x1", px);
    this.cursorLine.setAttribute("x2", px);
    this.cursorLine.setAttribute("y1", y);
    this.cursorLine.setAttribute("y2", y + height);
    this.cursorHalo.setAttribute("cx", px);
    this.cursorHalo.setAttribute("cy", py);
    this.cursorHalo.setAttribute("fill", withAlpha(color, 0.25));
    this.cursorDot.setAttribute("cx", px);
    this.cursorDot.setAttribute("cy", py);
    this.cursorDot.setAttribute("fill", color);
    this.endGroup.setAttribute("opacity", "0.25");
    return point;
  }
  hideCursor() {
    this.cursorGroup.setAttribute("opacity", "0");
    this.endGroup.setAttribute("opacity", this.liveEnd ? "1" : "0");
  }
};
function formatTick(value) {
  if (value >= 1e4) {
    const kilo = value / 1e3;
    return `${kilo % 1 === 0 ? kilo : kilo.toFixed(1)}k`;
  }
  return String(Math.round(value));
}

// energy-card/src/bars.js
var PAD2 = { top: 26, right: 48, bottom: 24, left: 2 };
var MAX_RADIUS = 5;
var gradientSeq2 = 0;
var Bars = class {
  constructor(options = {}) {
    this.options = options;
    this.buckets = [];
    this.compare = null;
    this.projection = null;
    this.level = "day";
    this.width = 0;
    this.height = 0;
    this.scaleMax = 1;
    this.selection = -1;
    this.thresholds = options.thresholds;
    this.completed = Infinity;
    this._buildSkeleton();
  }
  _buildSkeleton() {
    const uid = `teb${++gradientSeq2}`;
    this.uid = uid;
    const svg = el("svg", { class: "bars", preserveAspectRatio: "none" });
    const defs = el("defs");
    this.fillGradient = el("linearGradient", {
      id: `${uid}-fill`,
      gradientUnits: "userSpaceOnUse"
    });
    defs.appendChild(this.fillGradient);
    svg.appendChild(defs);
    this.gridGroup = el("g", { class: "grid" });
    this.ghostGroup = el("g", { class: "ghosts" });
    this.futureGroup = el("g", { class: "future" });
    this.barGroup = el("g", { class: "bars-body" });
    this.averageLine = el("line", { class: "average" });
    this.axisGroup = el("g", { class: "axis" });
    svg.append(
      this.gridGroup,
      this.ghostGroup,
      this.futureGroup,
      this.barGroup,
      this.averageLine,
      this.axisGroup
    );
    this.svg = svg;
  }
  /* -------------------------------------------------------------- */
  get plot() {
    return {
      x: PAD2.left,
      y: PAD2.top,
      width: Math.max(0, this.width - PAD2.left - PAD2.right),
      height: Math.max(0, this.height - PAD2.top - PAD2.bottom)
    };
  }
  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.svg.setAttribute("width", width);
    this.svg.setAttribute("height", height);
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  /**
   * @param buckets  [{ t, value }] — `value` ist null, wo keine Daten vorliegen
   * @param compare  gleich lange Liste der Vorperiode oder null
   * @param completed Zahl der bereits abgeschlossenen Balken; die übrigen
   *                  werden als Hochrechnung blass ergänzt
   */
  setData(buckets, { compare = null, level = "day", completed = Infinity } = {}) {
    this.buckets = buckets || [];
    this.compare = compare;
    this.level = level;
    this.completed = completed;
    if (this.selection >= this.buckets.length) this.selection = -1;
  }
  setThresholds(thresholds) {
    this.thresholds = thresholds;
  }
  setSelection(index) {
    this.selection = index == null ? -1 : index;
  }
  values() {
    return this.buckets.map((b) => b.value).filter((v) => Number.isFinite(v));
  }
  /** Mittel der abgeschlossenen Balken — Grundlage für Ø-Linie und Prognose. */
  averageValue() {
    const done = this.buckets.slice(0, Math.min(this.completed, this.buckets.length)).map((b) => b.value).filter((v) => Number.isFinite(v));
    if (!done.length) return null;
    return done.reduce((sum, v) => sum + v, 0) / done.length;
  }
  /**
   * Obergrenze der Achse. Anders als beim Linienchart zählt hier auch die
   * Vorperiode mit: ihre Schattenbalken dürfen nicht oben aus dem Bild laufen,
   * sonst sieht ein gestiegener Verbrauch nach einem gefallenen aus.
   */
  computeScaleMax() {
    let max = 0;
    for (const b of this.buckets) if (Number.isFinite(b.value) && b.value > max) max = b.value;
    for (const b of this.compare || []) {
      if (Number.isFinite(b.value) && b.value > max) max = b.value;
    }
    const average = this.averageValue();
    if (average != null && average > max) max = average;
    if (max <= 0) return 1;
    const raw = max * 1.08;
    const { step } = yTicks(raw);
    return Math.ceil(raw / step) * step;
  }
  scaleY(v) {
    const { y, height } = this.plot;
    return y + height - Math.max(0, v) / (this.scaleMax || 1) * height;
  }
  /** Waagerechte Aufteilung: ein Fach je Balken, darin der Balken mit Luft. */
  slot(index) {
    const { x, width } = this.plot;
    const count = Math.max(1, this.buckets.length);
    const pitch = width / count;
    const gap = Math.min(5, Math.max(1, pitch * 0.22));
    return { x: x + index * pitch + gap / 2, width: Math.max(1, pitch - gap), pitch };
  }
  /* -------------------------------------------------------------- */
  render() {
    const { width, height } = this.plot;
    if (width <= 0 || height <= 0) return;
    this.scaleMax = this.computeScaleMax();
    this._renderGradient();
    this._renderGrid();
    this._renderGhosts();
    this._renderBars();
    this._renderAverage();
  }
  /**
   * Der Farbverlauf skaliert sich selbst: bis zum Mittelwert der Periode bleibt
   * alles ruhig, ab dem Doppelten schlägt er nach Orange um. So sticht ein
   * Waschtag im Monatsbild sofort heraus, ohne dass die Wattschwellen der
   * Live-Ansicht auf Kilowattstunden umgedeutet werden müssten — 2 kWh sind an
   * einem Tag unauffällig und in einer Stunde bemerkenswert.
   */
  _renderGradient() {
    const { y, height } = this.plot;
    const stops = this.thresholds || [];
    const calm = stops[0]?.color || "#3ED2AC";
    const loud = stops[stops.length - 1]?.color || "#F06B1C";
    const average = this.averageValue();
    const scale = average && average > 0 ? buildGradientStops(
      [
        { value: 0, color: calm },
        { value: average, color: calm },
        { value: average * 2, color: loud }
      ],
      this.scaleMax
    ) : [{ offset: 0, color: calm }, { offset: 1, color: calm }];
    this.fillGradient.setAttribute("x1", "0");
    this.fillGradient.setAttribute("x2", "0");
    this.fillGradient.setAttribute("y1", y + height);
    this.fillGradient.setAttribute("y2", y);
    this.fillGradient.textContent = "";
    for (const stop of scale) {
      this.fillGradient.appendChild(
        el("stop", { offset: stop.offset, "stop-color": stop.color })
      );
    }
  }
  _renderGrid() {
    const { x, y, width, height } = this.plot;
    const { ticks } = yTicks(this.scaleMax);
    const format = this.options.formatTick || String;
    const lines = [];
    const labels = [];
    for (const tick of ticks) {
      const ty = this.scaleY(tick);
      if (ty < y - 1 || ty > y + height + 1) continue;
      lines.push({ y: ty });
      labels.push({ y: ty, text: format(tick, this.scaleMax), anchor: "end", x: this.width - 6 });
    }
    syncNodes(this.gridGroup, lines, "line", (node, item) => {
      node.setAttribute("x1", x);
      node.setAttribute("x2", x + width + 8);
      node.setAttribute("y1", item.y);
      node.setAttribute("y2", item.y);
    });
    const every = Math.max(1, Math.ceil(this.buckets.length / Math.max(2, Math.floor(width / 34))));
    const xLabels = [];
    this.buckets.forEach((bucket, i) => {
      if (i % every !== 0) return;
      const slot = this.slot(i);
      xLabels.push({
        x: slot.x + slot.width / 2,
        y: this.height - 7,
        text: this.options.tickLabel?.(bucket.t, i) ?? "",
        anchor: "middle"
      });
    });
    syncNodes(
      this.axisGroup,
      [
        { x: this.width - 6, y: y - 13, text: this.options.unit || "", anchor: "end", dim: true },
        ...labels,
        ...xLabels
      ],
      "text",
      (node, item) => {
        node.setAttribute("x", item.x);
        node.setAttribute("y", item.y);
        node.setAttribute("text-anchor", item.anchor);
        node.setAttribute("class", item.dim ? "axis-unit" : "axis-label");
        node.textContent = item.text;
      }
    );
  }
  /** Die Vorperiode als blasser Schatten hinter den Balken. */
  _renderGhosts() {
    const { y, height } = this.plot;
    const baseline = y + height;
    const items = [];
    if (this.compare) {
      this.compare.forEach((bucket, i) => {
        if (!Number.isFinite(bucket?.value) || bucket.value <= 0) return;
        if (i >= this.buckets.length) return;
        const slot = this.slot(i);
        const top = this.scaleY(bucket.value);
        items.push({ d: barPath(slot.x, top, slot.width, baseline - top, MAX_RADIUS) });
      });
    }
    syncNodes(this.ghostGroup, items, "path", (node, item) => {
      node.setAttribute("d", item.d);
      node.setAttribute("class", "ghost");
    });
  }
  _renderBars() {
    const { y, height } = this.plot;
    const baseline = y + height;
    const fill = `url(#${this.uid}-fill)`;
    const bars = [];
    const future = [];
    const average = this.averageValue();
    this.buckets.forEach((bucket, i) => {
      const slot = this.slot(i);
      if (i > this.completed) {
        if (average == null || average <= 0) return;
        const top2 = this.scaleY(average);
        future.push({ d: barPath(slot.x, top2, slot.width, baseline - top2, MAX_RADIUS) });
        return;
      }
      if (!Number.isFinite(bucket.value) || bucket.value <= 0) return;
      const top = this.scaleY(bucket.value);
      bars.push({
        d: barPath(slot.x, top, slot.width, baseline - top, MAX_RADIUS),
        selected: i === this.selection
      });
    });
    syncNodes(this.futureGroup, future, "path", (node, item) => {
      node.setAttribute("d", item.d);
      node.setAttribute("class", "bar-future");
      node.setAttribute("fill", fill);
    });
    syncNodes(this.barGroup, bars, "path", (node, item) => {
      node.setAttribute("d", item.d);
      node.setAttribute("fill", fill);
      node.setAttribute("class", `bar${item.selected ? " selected" : ""}`);
      node.setAttribute(
        "opacity",
        this.selection < 0 || item.selected ? "1" : "0.4"
      );
    });
  }
  _renderAverage() {
    const { x, width } = this.plot;
    const average = this.averageValue();
    const show = this.options.showAverage !== false && average != null && average > 0;
    this.averageLine.setAttribute("opacity", show ? "1" : "0");
    if (!show) return;
    const ty = this.scaleY(average);
    this.averageLine.setAttribute("x1", x);
    this.averageLine.setAttribute("x2", x + width);
    this.averageLine.setAttribute("y1", ty);
    this.averageLine.setAttribute("y2", ty);
  }
  /* -------------------------------------------------------------- *
   * Auswahl
   * -------------------------------------------------------------- */
  /** Der Balken unter einer Pixelposition, oder -1 daneben. */
  indexAtX(px) {
    const { x, width } = this.plot;
    const count = this.buckets.length;
    if (!count || width <= 0) return -1;
    if (px < x || px > x + width) return -1;
    return Math.min(count - 1, Math.floor((px - x) / width * count));
  }
  /** Bildschirmmitte eines Balkens — für den Zeiger über der Auswahl. */
  centerOf(index) {
    const slot = this.slot(index);
    return slot.x + slot.width / 2;
  }
  colorAt(index) {
    const value = this.buckets[index]?.value;
    const average = this.averageValue();
    const stops = this.thresholds || [];
    if (!Number.isFinite(value) || !average || average <= 0) {
      return stops[0]?.color || "#3ED2AC";
    }
    return colorForValue(value, [
      { value: 0, color: stops[0]?.color || "#3ED2AC" },
      { value: average, color: stops[0]?.color || "#3ED2AC" },
      { value: average * 2, color: stops[stops.length - 1]?.color || "#F06B1C" }
    ]);
  }
};

// energy-card/src/interactions.js
var MIN_WINDOW_MS = 3e4;
var MAX_WINDOW_MS = 90 * 24 * 36e5;
var SCRUB_RELEASE_MS = 2200;
function attachBarInteractions(surface, bars, handlers, options = {}) {
  const pointers = /* @__PURE__ */ new Map();
  let releaseTimer = null;
  let frame = null;
  let pendingX = null;
  let lastIndex = -1;
  let swipe = null;
  const localX = (event) => {
    const rect = surface.getBoundingClientRect();
    const scale = rect.width ? bars.width / rect.width : 1;
    return (event.clientX - rect.left) * scale;
  };
  const flush = () => {
    frame = null;
    if (pendingX == null) return;
    const index = bars.indexAtX(pendingX);
    pendingX = null;
    if (index < 0 || index === lastIndex) return;
    lastIndex = index;
    handlers.onSelect?.(index);
    if (options.haptics !== false) navigator.vibrate?.(4);
  };
  const selectAt = (x) => {
    pendingX = x;
    if (frame == null) frame = requestAnimationFrame(flush);
  };
  const clearSelection = () => {
    lastIndex = -1;
    pendingX = null;
    handlers.onSelect?.(-1);
  };
  const scheduleRelease = () => {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(clearSelection, 2500);
  };
  const onPointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    surface.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX });
    clearTimeout(releaseTimer);
    if (pointers.size === 1) {
      selectAt(localX(event));
    } else if (pointers.size === 2) {
      clearSelection();
      const [a, b] = [...pointers.values()];
      swipe = { start: (a.x + b.x) / 2, fired: false };
    }
  };
  const onPointerMove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX });
    if (pointers.size === 1) {
      selectAt(localX(event));
      return;
    }
    if (pointers.size >= 2 && swipe && !swipe.fired) {
      const [a, b] = [...pointers.values()];
      const delta = (a.x + b.x) / 2 - swipe.start;
      if (Math.abs(delta) > 42) {
        swipe.fired = true;
        handlers.onPage?.(delta < 0 ? 1 : -1);
      }
    }
  };
  const onPointerUp = (event) => {
    pointers.delete(event.pointerId);
    surface.releasePointerCapture?.(event.pointerId);
    if (pointers.size === 0) {
      if (swipe) swipe = null;
      else scheduleRelease();
    }
  };
  const onWheel = (event) => {
    const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (!horizontal) return;
    event.preventDefault();
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      handlers.onPage?.((event.deltaX || event.deltaY) > 0 ? 1 : -1);
    }, 60);
  };
  surface.addEventListener("pointerdown", onPointerDown);
  surface.addEventListener("pointermove", onPointerMove);
  surface.addEventListener("pointerup", onPointerUp);
  surface.addEventListener("pointercancel", onPointerUp);
  surface.addEventListener("pointerleave", scheduleRelease);
  surface.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    clearTimeout(releaseTimer);
    if (frame != null) cancelAnimationFrame(frame);
    surface.removeEventListener("pointerdown", onPointerDown);
    surface.removeEventListener("pointermove", onPointerMove);
    surface.removeEventListener("pointerup", onPointerUp);
    surface.removeEventListener("pointercancel", onPointerUp);
    surface.removeEventListener("pointerleave", scheduleRelease);
    surface.removeEventListener("wheel", onWheel);
  };
}
function attachInteractions(surface, chart, handlers, options = {}) {
  const pointers = /* @__PURE__ */ new Map();
  let mode = null;
  let gestureStart = null;
  let releaseTimer = null;
  let frame = null;
  let pendingScrubX = null;
  let lastScrubIndex = -1;
  const enabled = {
    scrub: options.scrub !== false,
    zoom: options.zoom !== false,
    pan: options.pan !== false
  };
  const localX = (event) => {
    const rect = surface.getBoundingClientRect();
    const scale = rect.width ? chart.width / rect.width : 1;
    return (event.clientX - rect.left) * scale;
  };
  const flushScrub = () => {
    frame = null;
    if (pendingScrubX == null) return;
    const index = chart.indexAtX(pendingScrubX);
    pendingScrubX = null;
    if (index < 0 || index === lastScrubIndex) return;
    lastScrubIndex = index;
    const point = chart.showCursor(index);
    if (point) {
      handlers.onScrub?.(point);
      if (options.haptics !== false) navigator.vibrate?.(4);
    }
  };
  const scrubTo = (x) => {
    pendingScrubX = x;
    if (frame == null) frame = requestAnimationFrame(flushScrub);
  };
  const endScrub = () => {
    lastScrubIndex = -1;
    pendingScrubX = null;
    chart.hideCursor();
    handlers.onScrub?.(null);
  };
  const scheduleRelease = () => {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(endScrub, SCRUB_RELEASE_MS);
  };
  const applyWindow = (startMs, endMs, settled) => {
    let span = Math.max(MIN_WINDOW_MS, Math.min(MAX_WINDOW_MS, endMs - startMs));
    let start = startMs;
    let end = start + span;
    const limit = Date.now() + span * 0.02;
    if (end > limit) {
      end = limit;
      start = end - span;
    }
    handlers.onViewport?.(start, end, { settled });
  };
  const zoomAround = (anchorX, factor, settled = false) => {
    if (!enabled.zoom) return;
    const { x, width } = chart.plot;
    const ratio = width ? (Math.max(x, Math.min(x + width, anchorX)) - x) / width : 0.5;
    const span = chart.endMs - chart.startMs;
    const anchorT = chart.startMs + span * ratio;
    const nextSpan = Math.max(MIN_WINDOW_MS, Math.min(MAX_WINDOW_MS, span * factor));
    applyWindow(anchorT - nextSpan * ratio, anchorT + nextSpan * (1 - ratio), settled);
  };
  const twoPointerState = () => {
    const [a, b] = [...pointers.values()];
    return { center: (a.x + b.x) / 2, distance: Math.abs(a.x - b.x) || 1 };
  };
  const onPointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    surface.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: localX(event), clientX: event.clientX });
    clearTimeout(releaseTimer);
    if (pointers.size === 1) {
      if (!enabled.scrub) return;
      mode = "scrub";
      scrubTo(localX(event));
    } else if (pointers.size === 2) {
      mode = "gesture";
      endScrub();
      const { center, distance } = twoPointerState();
      gestureStart = {
        center,
        distance,
        startMs: chart.startMs,
        endMs: chart.endMs
      };
      surface.classList.add("grabbing");
    }
  };
  const onPointerMove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: localX(event), clientX: event.clientX });
    if (mode === "scrub") {
      scrubTo(localX(event));
      return;
    }
    if (mode === "gesture" && pointers.size >= 2 && gestureStart) {
      const { center, distance } = twoPointerState();
      const span = gestureStart.endMs - gestureStart.startMs;
      const scale = enabled.zoom ? gestureStart.distance / distance : 1;
      const nextSpan = Math.max(MIN_WINDOW_MS, Math.min(MAX_WINDOW_MS, span * scale));
      const { x, width } = chart.plot;
      const ratio = width ? (gestureStart.center - x) / width : 0.5;
      const anchorT = gestureStart.startMs + span * ratio;
      let start = anchorT - nextSpan * ratio;
      if (enabled.pan && width) {
        start -= (center - gestureStart.center) / width * nextSpan;
      }
      applyWindow(start, start + nextSpan, false);
    }
  };
  const onPointerUp = (event) => {
    pointers.delete(event.pointerId);
    surface.releasePointerCapture?.(event.pointerId);
    if (mode === "scrub" && pointers.size === 0) {
      scheduleRelease();
      mode = null;
    } else if (mode === "gesture" && pointers.size < 2) {
      surface.classList.remove("grabbing");
      gestureStart = null;
      mode = null;
      applyWindow(chart.startMs, chart.endMs, true);
    }
  };
  const onWheel = (event) => {
    if (!enabled.zoom && !enabled.pan) return;
    const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (horizontal && enabled.pan) {
      event.preventDefault();
      const { width } = chart.plot;
      const span = chart.endMs - chart.startMs;
      const delta = (event.deltaX || event.deltaY) / (width || 1) * span;
      applyWindow(chart.startMs + delta, chart.endMs + delta, false);
    } else if (enabled.zoom) {
      event.preventDefault();
      const factor = Math.max(0.2, Math.min(5, Math.exp(event.deltaY * 18e-4)));
      zoomAround(localX(event), factor, false);
    }
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => applyWindow(chart.startMs, chart.endMs, true), 260);
  };
  const onDoubleClick = (event) => {
    event.preventDefault();
    endScrub();
    handlers.onReset?.();
  };
  const onLeave = () => {
    if (mode !== "scrub") return;
    scheduleRelease();
  };
  surface.addEventListener("pointerdown", onPointerDown);
  surface.addEventListener("pointermove", onPointerMove);
  surface.addEventListener("pointerup", onPointerUp);
  surface.addEventListener("pointercancel", onPointerUp);
  surface.addEventListener("pointerleave", onLeave);
  surface.addEventListener("wheel", onWheel, { passive: false });
  surface.addEventListener("dblclick", onDoubleClick);
  return () => {
    clearTimeout(releaseTimer);
    if (frame != null) cancelAnimationFrame(frame);
    surface.removeEventListener("pointerdown", onPointerDown);
    surface.removeEventListener("pointermove", onPointerMove);
    surface.removeEventListener("pointerup", onPointerUp);
    surface.removeEventListener("pointercancel", onPointerUp);
    surface.removeEventListener("pointerleave", onLeave);
    surface.removeEventListener("wheel", onWheel);
    surface.removeEventListener("dblclick", onDoubleClick);
  };
}

// energy-card/src/cost.js
var HOUR2 = 36e5;
var DAY2 = 24 * HOUR2;
async function resolveCostSource(hass, config, energyEntityId) {
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
async function gridFlow(hass, energyEntityId) {
  let prefs;
  try {
    prefs = await hass.callWS({ type: "energy/get_prefs" });
  } catch (err) {
    return null;
  }
  const flows = [];
  for (const source of prefs?.energy_sources || []) {
    if (source?.type === "grid") flows.push(...source.flow_from || []);
  }
  if (!flows.length) return null;
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
async function statisticsByStart2(hass, statisticId, startMs, endMs, period, type, units) {
  const response = await hass.callWS({
    type: "recorder/statistics_during_period",
    start_time: new Date(startMs).toISOString(),
    end_time: new Date(endMs).toISOString(),
    statistic_ids: [statisticId],
    period,
    types: [type],
    ...units ? { units } : {}
  });
  const map = /* @__PURE__ */ new Map();
  for (const entry of response?.[statisticId] || []) {
    const start = Number(entry.start);
    const value = Number(entry[type]);
    if (Number.isFinite(start) && Number.isFinite(value)) map.set(start, value);
  }
  return map;
}
async function fetchBucketCosts(hass, source, { buckets, startMs, endMs, period }) {
  if (!source || !buckets?.length) return null;
  if (source.kind === "fixed") {
    return buckets.map((b) => Number.isFinite(b.kwh) ? b.kwh * source.price : null);
  }
  try {
    if (source.kind === "statistic") {
      const map2 = await statisticsByStart2(
        hass,
        source.statisticId,
        startMs,
        endMs,
        period,
        "change"
      );
      if (!map2.size) return null;
      return buckets.map((b) => map2.has(b.t) ? map2.get(b.t) : null);
    }
    const map = await statisticsByStart2(
      hass,
      source.priceEntityId,
      startMs,
      endMs,
      period,
      "mean"
    );
    if (!map.size) return null;
    return buckets.map(
      (b) => Number.isFinite(b.kwh) && map.has(b.t) ? b.kwh * map.get(b.t) : null
    );
  } catch (err) {
    return null;
  }
}
async function fetchCostForPeriod(hass, source, { startMs, endMs, kwh = null, effectivePrice = null }) {
  if (!source) return null;
  const span = endMs - startMs;
  if (source.kind === "fixed") {
    return Number.isFinite(kwh) ? kwh * source.price : null;
  }
  if (span < 2 * HOUR2) {
    const price = await currentPrice(hass, source) ?? effectivePrice;
    return Number.isFinite(kwh) && Number.isFinite(price) ? kwh * price : null;
  }
  let period = "day";
  if (span <= 36 * HOUR2) period = "5minute";
  else if (span <= 3 * DAY2) period = "hour";
  try {
    if (source.kind === "statistic") {
      const map = await statisticsByStart2(
        hass,
        source.statisticId,
        startMs,
        endMs,
        period,
        "change"
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
async function currentPrice(hass, source) {
  if (!source) return null;
  if (source.kind === "fixed") return source.price;
  if (source.kind === "price_entity") {
    const value = Number(hass?.states?.[source.priceEntityId]?.state);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

// energy-card/src/format.js
var cachedLocale = null;
function setLocale(locale2) {
  cachedLocale = locale2 || null;
}
var locale = () => cachedLocale || void 0;
function getLocale() {
  return locale();
}
function formatWatt(value) {
  if (!Number.isFinite(value)) return "\u2013";
  const rounded = Math.round(value);
  return new Intl.NumberFormat(locale(), { useGrouping: true }).format(rounded).replace(/[ ,.](?=\d{3}\b)/g, "\u202F");
}
function formatKwh(value, reference = value) {
  if (!Number.isFinite(value)) return "\u2013";
  const scale = Math.abs(Number.isFinite(reference) ? reference : value);
  let digits = 2;
  if (scale >= 100) digits = 0;
  else if (scale >= 10) digits = 1;
  return new Intl.NumberFormat(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}
function formatEnergy(kwh) {
  if (!Number.isFinite(kwh)) return { value: "\u2013", unit: "kWh" };
  if (Math.abs(kwh) < 0.1) {
    const wh = new Intl.NumberFormat(locale(), {
      maximumFractionDigits: Math.abs(kwh) < 0.01 ? 1 : 0
    }).format(kwh * 1e3);
    return { value: wh, unit: "Wh" };
  }
  return { value: formatKwh(kwh), unit: "kWh" };
}
function formatMoney(value, currency) {
  if (!Number.isFinite(value)) return { value: "\u2013", unit: "", prefix: false };
  const digits = Math.abs(value) >= 100 ? 0 : 2;
  const parts = new Intl.NumberFormat(locale(), {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).formatToParts(value);
  const symbolAt = parts.findIndex((p) => p.type === "currency");
  const symbol = symbolAt >= 0 ? parts[symbolAt].value : "";
  const number = parts.filter((p) => p.type !== "currency").map((p) => p.value).join("").trim();
  return { value: number, unit: symbol, prefix: symbolAt === 0 };
}
function formatMoneyPlain(value, currency) {
  const { value: number, unit, prefix } = formatMoney(value, currency);
  if (!unit) return number;
  return prefix ? `${unit}${number}` : `${number} ${unit}`;
}
function formatMoment(timestamp, windowMs) {
  if (!Number.isFinite(timestamp)) return "";
  const options = windowMs > 36 * 36e5 ? { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit" };
  return new Intl.DateTimeFormat(locale(), options).format(new Date(timestamp));
}

// energy-card/src/i18n.js
var STRINGS = {
  en: {
    right_now: "Right now",
    live: "Live",
    used_today: "Used today",
    max_today: "Max today",
    min_today: "Min today",
    used_range: "Used {span}",
    max_range: "Max {span}",
    min_range: "Min {span}",
    used_view: "Used in view",
    max_view: "Max in view",
    min_view: "Min in view",
    no_data: "No data for this period",
    back_to_overview: "Back to overview",
    no_power_entity: "No power sensor found. Please set `power_entity` on the card.",
    range_5min: "5 min",
    range_1h: "1 h",
    range_6h: "6 h",
    range_12h: "12 h",
    range_24h: "24 h",
    range_7d: "7 d",
    range_30d: "30 d",
    tab_live: "Live",
    tab_analysis: "Analysis",
    level_day: "Day",
    level_week: "Week",
    level_month: "Month",
    level_year: "Year",
    level_pattern: "Pattern",
    pattern_weeks: "Average of the past {weeks} weeks",
    pattern_hint: "Tap a field to read it",
    pattern_cell: "{day} {from}:00\u2013{to}:00",
    pattern_peak: "Busiest hour: {when}",
    today: "Today",
    yesterday: "yesterday",
    this_week: "This week",
    this_month: "This month",
    this_year: "This year",
    last_week: "last week",
    last_month: "last month",
    last_year: "last year",
    to_current: "To the present",
    previous_period: "Previous",
    next_period: "Next",
    total: "Total",
    average_per_day: "{value} per day on average",
    average_per_hour: "{value} per hour on average",
    average_per_month: "{value} per month on average",
    projection: "Projected {value}",
    compare_more: "{value} more than {span}",
    compare_less: "{value} less than {span}",
    compare_same: "Same as {span}",
    compare_partial: "same period",
    compare_at_day: "on {label}",
    compare_at_week: "in the week of {label}",
    compare_at_month: "in {label}",
    compare_at_year: "in {label}",
    baseload: "Standby load",
    baseload_detail: "{watt} \xB7 {kwh} per day",
    baseload_month: "{value} per month",
    no_period_data: "No data for this period",
    data_from: "Data available from {date}",
    cost_today: "Cost today",
    cost_range: "Cost {span}",
    cost_view: "Cost in view",
    cost_month: "Month (projected)",
    editor_title: "Heading",
    editor_power_entity: "Power sensor",
    editor_energy_today_entity: "Energy sensor (today)",
    editor_ranges: "Time ranges",
    editor_default_range: "Opens with (live)",
    editor_default_level: "Opens with (analysis)",
    editor_gauge_max: "Ring maximum (empty = daily typical)",
    editor_stats_scope: "Tiles refer to",
    editor_show_stats: "Show tiles",
    editor_show_today_tiles: "Second row with today",
    editor_show_cost_tiles: "Cost row",
    editor_show_minmax_band: "Min/max band",
    editor_view: "View",
    editor_cost_entity: "Cost sensor (optional)",
    editor_price: "Fixed price per kWh (optional)",
    editor_compare: "Compare with previous",
    editor_show_pattern: "Pattern view",
    editor_show_baseload: "Standby load",
    view_live: "Live only",
    view_tabs: "Tabs: live and analysis",
    view_analysis: "Analysis only",
    scope_today: "Always today",
    scope_range: "The selected time range"
  },
  de: {
    right_now: "Jetzt gerade",
    live: "Live",
    used_today: "Heute verbraucht",
    max_today: "Maximum heute",
    min_today: "Minimum heute",
    used_range: "Verbrauch {span}",
    max_range: "Maximum {span}",
    min_range: "Minimum {span}",
    used_view: "Verbrauch Ausschnitt",
    max_view: "Maximum Ausschnitt",
    min_view: "Minimum Ausschnitt",
    no_data: "Keine Daten f\xFCr diesen Zeitraum",
    back_to_overview: "Zur\xFCck zur \xDCbersicht",
    no_power_entity: "Kein Leistungssensor gefunden. Bitte `power_entity` in der Karte angeben.",
    range_5min: "5 Min",
    range_1h: "1 Std",
    range_6h: "6 Std",
    range_12h: "12 Std",
    range_24h: "24 Std",
    range_7d: "7 T",
    range_30d: "30 T",
    tab_live: "Live",
    tab_analysis: "Analyse",
    level_day: "Tag",
    level_week: "Woche",
    level_month: "Monat",
    level_year: "Jahr",
    level_pattern: "Muster",
    pattern_weeks: "Mittel der letzten {weeks} Wochen",
    pattern_hint: "Ein Feld antippen zum Ablesen",
    pattern_cell: "{day} {from}\u2013{to} Uhr",
    pattern_peak: "St\xE4rkste Stunde: {when}",
    today: "Heute",
    yesterday: "gestern",
    this_week: "Diese Woche",
    this_month: "Dieser Monat",
    this_year: "Dieses Jahr",
    last_week: "in der Vorwoche",
    last_month: "im Vormonat",
    last_year: "im Vorjahr",
    to_current: "Zur\xFCck zur Gegenwart",
    previous_period: "Zur\xFCck",
    next_period: "Weiter",
    total: "Gesamt",
    average_per_day: "im Mittel {value} pro Tag",
    average_per_hour: "im Mittel {value} pro Stunde",
    average_per_month: "im Mittel {value} pro Monat",
    projection: "Hochrechnung {value}",
    compare_more: "{value} mehr als {span}",
    compare_less: "{value} weniger als {span}",
    compare_same: "genauso viel wie {span}",
    compare_partial: "gleicher Zeitabschnitt",
    compare_at_day: "am {label}",
    compare_at_week: "in der Woche {label}",
    compare_at_month: "im {label}",
    compare_at_year: "{label}",
    baseload: "Grundlast",
    baseload_detail: "{watt} \xB7 {kwh} pro Tag",
    baseload_month: "{value} im Monat",
    no_period_data: "Keine Daten f\xFCr diesen Zeitraum",
    data_from: "Daten liegen ab {date} vor",
    cost_today: "Kosten heute",
    cost_range: "Kosten {span}",
    cost_view: "Kosten Ausschnitt",
    cost_month: "Monat (Prognose)",
    editor_title: "\xDCberschrift",
    editor_power_entity: "Leistungssensor",
    editor_energy_today_entity: "Energiesensor (heute)",
    editor_ranges: "Zeitr\xE4ume",
    editor_default_range: "Startet mit (Live)",
    editor_default_level: "Startet mit (Analyse)",
    editor_gauge_max: "Ringmaximum (leer = Tagesniveau)",
    editor_stats_scope: "Kacheln beziehen sich auf",
    editor_show_stats: "Kacheln zeigen",
    editor_show_today_tiles: "Zweite Reihe mit heute",
    editor_show_cost_tiles: "Kostenreihe",
    editor_show_minmax_band: "Min/Max-Band",
    editor_view: "Ansicht",
    editor_cost_entity: "Kostensensor (optional)",
    editor_price: "Fester Preis je kWh (optional)",
    editor_compare: "Vergleich mit der Vorperiode",
    editor_show_pattern: "Musteransicht",
    editor_show_baseload: "Grundlast",
    view_live: "Nur Live",
    view_tabs: "Reiter: Live und Analyse",
    view_analysis: "Nur Analyse",
    scope_today: "Immer heute",
    scope_range: "Den gew\xE4hlten Zeitraum"
  }
};
var current = "en";
function setLanguage(language) {
  const code = String(language || "en").slice(0, 2).toLowerCase();
  current = STRINGS[code] ? code : "en";
  return current;
}
function t(key, vars) {
  const template = STRINGS[current]?.[key] ?? STRINGS.en[key] ?? key;
  if (!vars) return template;
  return template.replace(
    /\{(\w+)\}/g,
    (match, name) => vars[name] == null ? match : String(vars[name])
  );
}

// energy-card/src/heatmap.js
var PAD3 = { top: 18, right: 10, bottom: 20, left: 30 };
var Heatmap = class {
  constructor(options = {}) {
    this.options = options;
    this.cells = [];
    this.width = 0;
    this.height = 0;
    this.max = 0;
    this.selection = -1;
    this.thresholds = options.thresholds;
    this.firstWeekday = 1;
    const svg = el("svg", { class: "heatmap", preserveAspectRatio: "none" });
    this.cellGroup = el("g", { class: "cells" });
    this.axisGroup = el("g", { class: "axis" });
    svg.append(this.cellGroup, this.axisGroup);
    this.svg = svg;
  }
  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.svg.setAttribute("width", width);
    this.svg.setAttribute("height", height);
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  setThresholds(thresholds) {
    this.thresholds = thresholds;
  }
  /** @param cells [{ value, count }] der Länge 168, in Wochentag-Reihenfolge */
  setData(cells, { firstWeekday = 1 } = {}) {
    this.cells = cells || [];
    this.firstWeekday = firstWeekday;
    this.max = 0;
    for (const cell of this.cells) {
      if (Number.isFinite(cell?.value) && cell.value > this.max) this.max = cell.value;
    }
  }
  setSelection(index) {
    this.selection = index == null ? -1 : index;
  }
  get plot() {
    return {
      x: PAD3.left,
      y: PAD3.top,
      width: Math.max(0, this.width - PAD3.left - PAD3.right),
      height: Math.max(0, this.height - PAD3.top - PAD3.bottom)
    };
  }
  /** Zeile und Spalte an einer Pixelposition, oder -1. */
  indexAt(px, py) {
    const { x, y, width, height } = this.plot;
    if (px < x || px > x + width || py < y || py > y + height) return -1;
    const hour = Math.min(23, Math.floor((px - x) / width * 24));
    const row = Math.min(6, Math.floor((py - y) / height * 7));
    return row * 24 + hour;
  }
  render() {
    const { x, y, width, height } = this.plot;
    if (width <= 0 || height <= 0) return;
    const cellW = width / 24;
    const cellH = height / 7;
    const gap = Math.min(1.5, cellW * 0.08);
    const stops = this.thresholds || [];
    const calm = stops[0]?.color || "#3ED2AC";
    const loud = stops[stops.length - 1]?.color || "#F06B1C";
    const scale = this.max > 0 ? this.max : 1;
    const items = [];
    for (let row = 0; row < 7; row++) {
      for (let hour = 0; hour < 24; hour++) {
        const index = row * 24 + hour;
        const cell = this.cells[index];
        const value = cell?.value;
        const known = Number.isFinite(value);
        items.push({
          x: x + hour * cellW + gap / 2,
          y: y + row * cellH + gap / 2,
          w: Math.max(1, cellW - gap),
          h: Math.max(1, cellH - gap),
          // Ohne Daten bleibt die Zelle ein blasser Platzhalter statt einer
          // Null — „nie gemessen" und „nichts verbraucht" sind verschiedene
          // Aussagen, und die Farbe darf sie nicht verwechseln.
          fill: known ? colorForValue(value, [
            { value: 0, color: calm },
            { value: scale * 0.55, color: calm },
            { value: scale, color: loud }
          ]) : "var(--ec-band)",
          // Die Helligkeit trägt die Menge, der Farbton die Intensität —
          // zusammen bleibt auch ein schwacher Wert vom leeren Feld
          // unterscheidbar.
          opacity: known ? (0.18 + 0.82 * Math.min(1, value / scale)).toFixed(3) : "0.05",
          selected: index === this.selection
        });
      }
    }
    syncNodes(this.cellGroup, items, "rect", (node, item) => {
      node.setAttribute("x", item.x.toFixed(2));
      node.setAttribute("y", item.y.toFixed(2));
      node.setAttribute("width", item.w.toFixed(2));
      node.setAttribute("height", item.h.toFixed(2));
      node.setAttribute("rx", Math.min(2.5, item.w / 4).toFixed(2));
      node.setAttribute("fill", item.fill);
      node.setAttribute("opacity", item.opacity);
      node.setAttribute("class", item.selected ? "cell selected" : "cell");
    });
    this._renderAxis(cellW, cellH);
  }
  _renderAxis(cellW, cellH) {
    const { x, y, height } = this.plot;
    const labels = [];
    for (let row = 0; row < 7; row++) {
      labels.push({
        x: x - 6,
        y: y + row * cellH + cellH / 2,
        text: this.options.dayLabel?.((this.firstWeekday + row) % 7) ?? "",
        anchor: "end",
        middle: true
      });
    }
    const every = cellW < 22 ? 6 : 3;
    for (let hour = 0; hour < 24; hour += every) {
      labels.push({
        x: x + hour * cellW + cellW / 2,
        y: y + height + 14,
        text: String(hour),
        anchor: "middle"
      });
    }
    syncNodes(this.axisGroup, labels, "text", (node, item) => {
      node.setAttribute("x", item.x.toFixed(2));
      node.setAttribute("y", item.y.toFixed(2));
      node.setAttribute("text-anchor", item.anchor);
      node.setAttribute("class", "axis-label");
      node.setAttribute("dominant-baseline", item.middle ? "middle" : "auto");
      node.textContent = item.text;
    });
  }
};
function foldToWeek(buckets, firstWeekday = 1) {
  const cells = Array.from({ length: 168 }, () => ({ sum: 0, count: 0, value: null }));
  for (const bucket of buckets || []) {
    if (!Number.isFinite(bucket.kwh)) continue;
    const date = new Date(bucket.t);
    const row = (date.getDay() - firstWeekday + 7) % 7;
    const index = row * 24 + date.getHours();
    cells[index].sum += bucket.kwh;
    cells[index].count++;
  }
  for (const cell of cells) {
    cell.value = cell.count ? cell.sum / cell.count : null;
  }
  return cells;
}

// energy-card/src/periods.js
var HOUR3 = 36e5;
var LEVELS = ["day", "week", "month", "year"];
var DEFAULT_LEVEL = "month";
var PATTERN_LEVEL = "pattern";
var ALL_LEVELS = [...LEVELS, PATTERN_LEVEL];
function patternRange(weeks, firstWeekday = 1, nowMs = Date.now()) {
  const end = new Date(nowMs);
  end.setHours(end.getHours() + 1, 0, 0, 0);
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  const shift = (start.getDay() - firstWeekday + 7) % 7;
  start.setDate(start.getDate() - shift - weeks * 7);
  return { startMs: start.getTime(), endMs: end.getTime(), period: "hour" };
}
var LEVEL_PERIOD = {
  day: "hour",
  week: "day",
  month: "day",
  year: "month"
};
var WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};
function firstWeekdayIndex(hass) {
  const setting = hass?.locale?.first_weekday;
  if (setting && setting !== "language" && setting in WEEKDAY_INDEX) {
    return WEEKDAY_INDEX[setting];
  }
  try {
    const info = new Intl.Locale(hass?.locale?.language || "de").weekInfo;
    if (info?.firstDay) return info.firstDay % 7;
  } catch (err) {
  }
  return 1;
}
var startOfDay = (ms) => {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date;
};
function periodRange(level, anchorMs, { firstWeekday = 1 } = {}) {
  const start = startOfDay(anchorMs);
  if (level === "week") {
    const shift = (start.getDay() - firstWeekday + 7) % 7;
    start.setDate(start.getDate() - shift);
  } else if (level === "month") {
    start.setDate(1);
  } else if (level === "year") {
    start.setMonth(0, 1);
  }
  const end = new Date(start);
  if (level === "day") end.setDate(end.getDate() + 1);
  else if (level === "week") end.setDate(end.getDate() + 7);
  else if (level === "month") end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  end.setHours(0, 0, 0, 0);
  return {
    level,
    startMs: start.getTime(),
    endMs: end.getTime(),
    period: LEVEL_PERIOD[level]
  };
}
function shiftPeriod(level, anchorMs, delta, options = {}) {
  const { startMs } = periodRange(level, anchorMs, options);
  const date = new Date(startMs);
  if (level === "day") date.setDate(date.getDate() + delta);
  else if (level === "week") date.setDate(date.getDate() + delta * 7);
  else if (level === "month") date.setMonth(date.getMonth() + delta);
  else date.setFullYear(date.getFullYear() + delta);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function bucketStarts(level, startMs, endMs) {
  const out = [];
  if (level === "day") {
    for (let t2 = startMs; t2 < endMs; t2 += HOUR3) out.push(t2);
    return out;
  }
  const cursor = new Date(startMs);
  while (cursor.getTime() < endMs) {
    out.push(cursor.getTime());
    if (level === "year") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return out;
}
function isCurrentPeriod(startMs, endMs, nowMs = Date.now()) {
  return nowMs >= startMs && nowMs < endMs;
}
function completedBuckets(starts, endMs, nowMs = Date.now()) {
  if (nowMs >= endMs) return starts.length;
  let count = 0;
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : endMs;
    if (end <= nowMs) count++;
    else break;
  }
  return count;
}
var fmt = (options) => new Intl.DateTimeFormat(getLocale(), options);
function periodLabel(level, startMs, endMs) {
  const start = new Date(startMs);
  if (level === "year") return String(start.getFullYear());
  if (level === "month") return fmt({ month: "long", year: "numeric" }).format(start);
  if (level === "day") {
    return fmt({ weekday: "long", day: "numeric", month: "long" }).format(start);
  }
  const last = new Date(endMs - 1);
  const sameMonth = start.getMonth() === last.getMonth();
  const from = fmt(sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" }).format(start);
  const to = fmt({ day: "numeric", month: "long", year: "numeric" }).format(last);
  return `${from}.\u2013${to}`;
}
function bucketTick(level, ms) {
  const date = new Date(ms);
  if (level === "day") return String(date.getHours());
  if (level === "week") return fmt({ weekday: "short" }).format(date);
  if (level === "month") return String(date.getDate());
  return fmt({ month: "short" }).format(date);
}
function bucketLabel(level, ms, durationMs) {
  const date = new Date(ms);
  if (level === "day") {
    const to = new Date(ms + durationMs);
    const time = fmt({ hour: "2-digit", minute: "2-digit" });
    return `${time.format(date)}\u2013${time.format(to)}`;
  }
  if (level === "year") return fmt({ month: "long", year: "numeric" }).format(date);
  return fmt({ weekday: "long", day: "numeric", month: "long" }).format(date);
}

// energy-card/src/analysis.js
var CURRENT_LABEL = {
  day: "today",
  week: "this_week",
  month: "this_month",
  year: "this_year"
};
var AVERAGE_LABEL = {
  day: "average_per_hour",
  week: "average_per_day",
  month: "average_per_day",
  year: "average_per_month"
};
var AnalysisView = class {
  constructor() {
    this.el = document.createElement("div");
    this.el.className = "analysis";
    this._hass = null;
    this._config = {};
    this._entities = { power: null, energy: null };
    this._level = DEFAULT_LEVEL;
    this._defaultLevel = void 0;
    this._anchor = Date.now();
    this._buckets = [];
    this._compare = null;
    this._range = null;
    this._completed = Infinity;
    this._selection = -1;
    this._token = 0;
    this._active = false;
    this._detach = null;
    this._mode = "energy";
    this._costSource = void 0;
    this._costs = null;
    this._compareCosts = null;
    this._render();
  }
  /* ------------------------------------------------------------------ *
   * Aufbau
   * ------------------------------------------------------------------ */
  _render() {
    this.el.innerHTML = `
      <div class="levels"></div>
      <div class="period-nav">
        <button class="nav prev" type="button" aria-label="${t("previous_period")}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg>
        </button>
        <div class="period-title">
          <div class="period-label"></div>
          <div class="period-sub"></div>
        </div>
        <button class="nav next" type="button" aria-label="${t("next_period")}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 7.4 10 6l6 6-6 6-1.4-1.4 4.6-4.6z"/></svg>
        </button>
      </div>
      <div class="summary">
        <div class="summary-head">
          <div class="summary-value">\u2013</div>
          <div class="value-mode" hidden>
            <button type="button" data-mode="energy" class="active">kWh</button>
            <button type="button" data-mode="cost"></button>
          </div>
        </div>
        <div class="summary-sub"></div>
        <div class="summary-delta"></div>
      </div>
      <div class="bars-wrap">
        <div class="loading-bar"></div>
        <div class="empty"></div>
      </div>
      <button class="to-current" type="button">${t("to_current")}</button>
      <div class="pattern" hidden>
        <div class="pattern-head">
          <div class="pattern-title">
            <span class="pattern-name">${t("level_pattern")}</span>
            <span class="pattern-sub"></span>
          </div>
          <div class="pattern-readout">
            <span class="pattern-value"></span>
            <span class="pattern-when"></span>
          </div>
        </div>
        <div class="heatmap-wrap"></div>
      </div>
      <div class="baseload" hidden>
        <span class="baseload-label"></span>
        <span class="baseload-value"></span>
      </div>
    `;
    this._levelsEl = this.el.querySelector(".levels");
    this._labelEl = this.el.querySelector(".period-label");
    this._subEl = this.el.querySelector(".period-sub");
    this._valueEl = this.el.querySelector(".summary-value");
    this._summarySubEl = this.el.querySelector(".summary-sub");
    this._deltaEl = this.el.querySelector(".summary-delta");
    this._wrap = this.el.querySelector(".bars-wrap");
    this._loading = this.el.querySelector(".loading-bar");
    this._empty = this.el.querySelector(".empty");
    this._toCurrent = this.el.querySelector(".to-current");
    this._prev = this.el.querySelector(".nav.prev");
    this._next = this.el.querySelector(".nav.next");
    this._modeEl = this.el.querySelector(".value-mode");
    this._baseloadEl = this.el.querySelector(".baseload");
    for (const button of this._modeEl.querySelectorAll("button")) {
      button.addEventListener("click", () => this._setMode(button.dataset.mode));
    }
    this._prev.addEventListener("click", () => this._page(-1));
    this._next.addEventListener("click", () => this._page(1));
    this._toCurrent.addEventListener("click", () => {
      this._anchor = Date.now();
      this._load();
    });
    this._bars = new Bars({
      unit: "kWh",
      formatTick: (value, max) => formatKwh(value, max),
      tickLabel: (ms) => bucketTick(this._level, ms)
    });
    this._wrap.appendChild(this._bars.svg);
    this._patternEl = this.el.querySelector(".pattern");
    this._heatWrap = this.el.querySelector(".heatmap-wrap");
    this._heatmap = new Heatmap({
      dayLabel: (weekday) => {
        const date = new Date(2026, 0, 4 + weekday);
        return new Intl.DateTimeFormat(getLocale(), { weekday: "short" }).format(date);
      }
    });
    this._heatWrap.appendChild(this._heatmap.svg);
    this._renderLevels();
    this._bindSurface();
  }
  _renderLevels() {
    const levels = this._config.analysis_levels?.length ? LEVELS.filter((l) => this._config.analysis_levels.includes(l)) : LEVELS;
    this._levelsEl.innerHTML = "";
    for (const level of levels) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = t(`level_${level}`);
      button.dataset.level = level;
      button.classList.toggle("active", level === this._level);
      button.addEventListener("click", () => this._setLevel(level));
      this._levelsEl.appendChild(button);
    }
    if (!levels.includes(this._level)) this._level = levels[0] || "month";
  }
  _bindSurface() {
    this._detach?.();
    this._resizeObserver?.disconnect();
    this._resizeObserver = new ResizeObserver(() => this.layout());
    this._resizeObserver.observe(this._wrap);
    this._resizeObserver.observe(this._heatWrap);
    this._detach = attachBarInteractions(this._wrap, this._bars, {
      onSelect: (index) => this._select(index),
      onPage: (delta) => this._page(delta)
    });
    this._onCellMove = (event) => this._selectCell(event);
    this._onCellLeave = () => this._selectCell(null);
    this._heatWrap.addEventListener("pointermove", this._onCellMove);
    this._heatWrap.addEventListener("pointerdown", this._onCellMove);
    this._heatWrap.addEventListener("pointerleave", this._onCellLeave);
  }
  _selectCell(event) {
    if (!event) {
      this._heatmap.setSelection(-1);
      this._heatmap.render();
      this._renderPeak();
      return;
    }
    const rect = this._heatWrap.getBoundingClientRect();
    const scale = rect.width ? this._heatmap.width / rect.width : 1;
    const index = this._heatmap.indexAt(
      (event.clientX - rect.left) * scale,
      (event.clientY - rect.top) * scale
    );
    if (index < 0) return;
    this._heatmap.setSelection(index);
    this._heatmap.render();
    this._setPatternReadout(this._cells?.[index]?.value ?? Number.NaN, this._cellLabel(index));
  }
  /* ------------------------------------------------------------------ *
   * Schnittstelle zur Karte
   * ------------------------------------------------------------------ */
  setConfig(config) {
    const previousDefault = this._defaultLevel;
    this._config = config || {};
    this._defaultLevel = LEVELS.includes(this._config.default_level) ? this._config.default_level : DEFAULT_LEVEL;
    if (previousDefault === void 0 || this._defaultLevel !== previousDefault) {
      this._level = this._defaultLevel;
      this._anchor = Date.now();
    }
    this._costPromise = null;
    this._costSource = void 0;
    this._renderLevels();
    if (this._active) this._load();
  }
  /**
   * Beim ersten `hass` stehen die Entities noch nicht fest — die Karte löst sie
   * erst danach auf. Ein Abruf lohnt deshalb nicht am ersten Aufruf, sondern
   * sobald sich die Entities gesetzt oder geändert haben.
   */
  setHass(hass, entities) {
    const before = `${this._entities.power}|${this._entities.energy}`;
    this._hass = hass;
    if (entities) this._entities = entities;
    const after = `${this._entities.power}|${this._entities.energy}`;
    if (this._active && (before !== after || !this._range)) this._load();
  }
  setThresholds(thresholds) {
    this._bars.setThresholds(thresholds);
    this._bars.render();
  }
  /** Wird beim Wechsel auf den Reiter gerufen. */
  activate() {
    if (this._active) return;
    this._active = true;
    this._relabel();
    this.layout();
    this._load();
  }
  deactivate() {
    this._active = false;
  }
  destroy() {
    this._detach?.();
    this._resizeObserver?.disconnect();
    this._wrap.removeEventListener("pointermove", this._onCellMove);
    this._wrap.removeEventListener("pointerdown", this._onCellMove);
    this._wrap.removeEventListener("pointerleave", this._onCellLeave);
  }
  /** Texte nach einem Sprachwechsel austauschen. */
  _relabel() {
    this._toCurrent.textContent = t("to_current");
    this._prev.setAttribute("aria-label", t("previous_period"));
    this._next.setAttribute("aria-label", t("next_period"));
    this._renderLevels();
    this._renderHeader();
    this._bars.render();
  }
  layout() {
    const width = this._wrap.clientWidth;
    if (width) {
      const wide = width >= 620;
      const desired = Math.round(
        Math.max(180, Math.min(wide ? 340 : 260, width * (wide ? 0.3 : 0.5)))
      );
      this._wrap.style.setProperty("--ec-chart-basis", `${desired}px`);
      const height = Math.round(this._wrap.clientHeight) || desired;
      this._bars.setSize(width, height);
      this._bars.render();
    }
    const heatWidth = this._heatWrap?.clientWidth;
    if (heatWidth) {
      const cell = Math.max(9, Math.min(26, (heatWidth - 40) / 24));
      const heatHeight = Math.round(7 * cell + 38);
      this._heatWrap.style.height = `${heatHeight}px`;
      this._heatmap.setSize(heatWidth, heatHeight);
      this._heatmap.render();
    }
  }
  /* ------------------------------------------------------------------ *
   * Navigation
   * ------------------------------------------------------------------ */
  _setLevel(level) {
    if (level === this._level) return;
    this._level = level;
    this._anchor = Date.now();
    this._renderLevels();
    this._load();
  }
  _page(delta) {
    const options = { firstWeekday: firstWeekdayIndex(this._hass) };
    const next = shiftPeriod(this._level, this._anchor, delta, options);
    const range = periodRange(this._level, next, options);
    if (delta > 0 && range.startMs > Date.now()) return;
    this._anchor = next;
    this._load();
  }
  _select(index) {
    this._selection = index;
    this._bars.setSelection(index);
    this._bars.render();
    this._renderSummary();
  }
  /* ------------------------------------------------------------------ *
   * Daten
   * ------------------------------------------------------------------ */
  async _load() {
    const hass = this._hass;
    if (!hass || !this._active) return;
    if (!this._entities.power && !this._entities.energy) return;
    const token = ++this._token;
    this._loading.classList.add("visible");
    this._loadPattern();
    const options = { firstWeekday: firstWeekdayIndex(this._hass) };
    const range = periodRange(this._level, this._anchor, options);
    const starts = bucketStarts(this._level, range.startMs, range.endMs);
    this._range = range;
    this._selection = -1;
    this._bars.setSelection(-1);
    this._renderHeader();
    const args = {
      energyEntityId: this._entities.energy,
      powerEntityId: this._entities.power,
      period: range.period,
      starts
    };
    try {
      const current2 = await fetchBuckets(hass, {
        ...args,
        startMs: range.startMs,
        endMs: range.endMs
      });
      if (token !== this._token) return;
      this._buckets = current2.buckets.map((b) => ({ t: b.t, kwh: b.kwh, cost: null }));
      this._completed = isCurrentPeriod(range.startMs, range.endMs) ? completedBuckets(starts, range.endMs) : starts.length;
      this._applyToChart();
      this._renderSummary();
      await this._loadCosts(token, range);
      if (this._config.compare !== false) {
        await this._loadCompare(token, options);
      } else {
        this._compare = null;
        this._applyToChart();
      }
      await this._loadBaseload();
    } catch (err) {
      if (token === this._token) {
        this._buckets = [];
        this._compare = null;
        this._applyToChart();
        this._renderSummary();
      }
    } finally {
      if (token === this._token) this._loading.classList.remove("visible");
    }
  }
  /**
   * Das Wochenmuster: eine Abfrage über die letzten Wochen in Stundenauflösung,
   * clientseitig auf 7 × 24 Felder gefaltet.
   *
   * Es hängt nicht am gewählten Zeitraum und wird deshalb nur einmal geholt —
   * beim Blättern durch die Monate bliebe es ohnehin dasselbe Bild. Nach einer
   * halben Stunde wird nachgeladen, damit es über den Tag hinweg nicht altert.
   */
  async _loadPattern() {
    if (this._config.show_pattern === false) {
      this._patternEl.hidden = true;
      return;
    }
    if (this._patternLoading) return;
    if (this._patternAt && Date.now() - this._patternAt < 30 * 6e4) return;
    this._patternLoading = true;
    const weeks = Number(this._config.pattern_weeks) || 4;
    const firstWeekday = firstWeekdayIndex(this._hass);
    const range = patternRange(weeks, firstWeekday);
    this._patternEl.querySelector(".pattern-sub").textContent = t("pattern_weeks", { weeks });
    try {
      const starts = [];
      for (let t2 = range.startMs; t2 < range.endMs; t2 += 36e5) starts.push(t2);
      const { buckets } = await fetchBuckets(this._hass, {
        energyEntityId: this._entities.energy,
        powerEntityId: this._entities.power,
        startMs: range.startMs,
        endMs: range.endMs,
        period: "hour",
        starts
      });
      this._cells = foldToWeek(buckets, firstWeekday);
      this._patternAt = Date.now();
      const hasData = this._cells.some((c) => Number.isFinite(c.value));
      this._patternEl.hidden = !hasData;
      if (!hasData) return;
      this._heatmap.setData(this._cells, { firstWeekday });
      this.layout();
      this._renderPeak();
    } catch (err) {
      this._patternEl.hidden = true;
    } finally {
      this._patternLoading = false;
    }
  }
  /**
   * Ruhezustand der Ablesezeile: die stärkste Stunde der Woche.
   *
   * Die Frage „wann verbrauche ich am meisten" ist genau die, wegen der man auf
   * das Raster schaut — sie soll nicht erst durch Antippen beantwortet werden.
   */
  _renderPeak() {
    this._peak = -1;
    let best = -Infinity;
    this._cells?.forEach((cell, i) => {
      if (Number.isFinite(cell.value) && cell.value > best) {
        best = cell.value;
        this._peak = i;
      }
    });
    if (this._peak < 0) {
      this._setPatternReadout(null, t("pattern_hint"));
      return;
    }
    this._setPatternReadout(best, t("pattern_peak", { when: this._cellLabel(this._peak) }));
  }
  _setPatternReadout(value, when) {
    const valueEl = this._patternEl.querySelector(".pattern-value");
    if (Number.isFinite(value)) {
      const energy = formatEnergy(value);
      valueEl.innerHTML = `${energy.value}<span class="unit">${energy.unit}</span>`;
    } else {
      valueEl.textContent = value === null ? "" : "\u2013";
    }
    this._patternEl.querySelector(".pattern-when").textContent = when;
  }
  _cellLabel(index) {
    const day = this._heatmap.options.dayLabel(
      (firstWeekdayIndex(this._hass) + Math.floor(index / 24)) % 7
    );
    const hour = index % 24;
    const pad = (n) => String(n).padStart(2, "0");
    return t("pattern_cell", { day, from: pad(hour), to: pad((hour + 1) % 24) });
  }
  /**
   * Die Grundlast: was das Haus zieht, während niemand etwas tut.
   *
   * Gerechnet als Median der Tagesminima der letzten Woche, hochgerechnet auf
   * Tag und Monat. Erfahrungsgemäss der überraschendste Posten einer
   * Stromrechnung — 40 W Dauerlast sind knapp 1 kWh am Tag, also gut ein
   * Zehntel eines sparsamen Haushalts, ohne dass je ein Schalter betätigt
   * wurde. Die Zahl steht deshalb unter jeder Ebene, nicht in einer eigenen
   * Ansicht, die man erst suchen müsste.
   */
  async _loadBaseload() {
    if (this._config.show_baseload === false) return;
    const token = this._token;
    const result = await fetchBaseload(this._hass, this._entities.power);
    if (token !== this._token) return;
    this._baseloadEl.hidden = !result;
    if (!result) return;
    const kwh = formatEnergy(result.kwhPerDay);
    const parts = [
      t("baseload_detail", {
        watt: `${formatWatt(result.watt)} W`,
        kwh: `${kwh.value} ${kwh.unit}`
      })
    ];
    const source = await this._ensureCostSource();
    const price = source ? await currentPrice(this._hass, source) ?? this._derivedPrice() : null;
    if (Number.isFinite(price)) {
      parts.push(
        t("baseload_month", {
          value: formatMoneyPlain(result.kwhPerDay * 30 * price, source.currency)
        })
      );
    }
    this._baseloadEl.querySelector(".baseload-label").textContent = t("baseload");
    this._baseloadEl.querySelector(".baseload-value").textContent = parts.join(" \xB7 ");
  }
  /**
   * Arbeitspreis, aus der laufenden Ansicht zurückgerechnet. Eine
   * Kostenstatistik kennt nur Beträge, keinen Preis — für die Grundlast in Euro
   * braucht es aber einen.
   */
  _derivedPrice() {
    let kwh = 0;
    let cost = 0;
    for (const bucket of this._buckets) {
      if (!Number.isFinite(bucket.kwh) || !Number.isFinite(bucket.cost)) continue;
      kwh += bucket.kwh;
      cost += bucket.cost;
    }
    if (kwh > 0) this._lastPrice = cost / kwh;
    return this._lastPrice ?? null;
  }
  /**
   * Die Preisquelle wird einmal je Sitzung gesucht, nicht bei jedem Blättern.
   * Gemerkt wird das Versprechen: ein zweiter Aufrufer, der während der Suche
   * hereinkommt, wartet mit, statt auf einen Zwischenstand hereinzufallen.
   */
  _ensureCostSource() {
    this._costPromise ??= resolveCostSource(
      this._hass,
      this._config,
      this._entities.energy
    ).then((source) => {
      this._costSource = source;
      return source;
    });
    return this._costPromise;
  }
  async _loadCosts(token, range) {
    const source = await this._ensureCostSource();
    if (token !== this._token) return;
    this._renderModeSwitch(source);
    if (!source) {
      this._costs = null;
      return;
    }
    const costs = await fetchBucketCosts(this._hass, source, {
      buckets: this._buckets,
      startMs: range.startMs,
      endMs: range.endMs,
      period: range.period
    });
    if (token !== this._token) return;
    this._costs = costs;
    if (costs) {
      this._buckets.forEach((bucket, i) => {
        bucket.cost = Number.isFinite(costs[i]) ? costs[i] : null;
      });
    }
    this._applyToChart();
    this._renderSummary();
  }
  _renderModeSwitch(source) {
    this._modeEl.hidden = !source;
    if (!source) {
      if (this._mode === "cost") this._mode = "energy";
      return;
    }
    const symbol = formatMoney(0, source.currency).unit || source.currency;
    this._modeEl.querySelector('[data-mode="cost"]').textContent = symbol;
    for (const button of this._modeEl.querySelectorAll("button")) {
      button.classList.toggle("active", button.dataset.mode === this._mode);
    }
  }
  _setMode(mode) {
    if (mode === this._mode) return;
    this._mode = mode;
    for (const button of this._modeEl.querySelectorAll("button")) {
      button.classList.toggle("active", button.dataset.mode === mode);
    }
    this._bars.options.unit = mode === "cost" ? formatMoney(0, this._costSource?.currency).unit : "kWh";
    this._applyToChart();
    this._renderSummary();
  }
  /** Der Wert eines Balkens im gerade gewählten Modus. */
  _valueOf(bucket) {
    if (!bucket) return null;
    return this._mode === "cost" ? bucket.cost : bucket.kwh;
  }
  /** Zahl und Einheit für die Anzeige, je nach Modus. */
  _format(value) {
    if (this._mode !== "cost") return formatEnergy(value);
    const money = formatMoney(value, this._costSource?.currency);
    return { value: money.value, unit: money.unit, prefix: money.prefix };
  }
  _formatPlain(value) {
    if (this._mode !== "cost") {
      const energy = formatEnergy(value);
      return `${energy.value} ${energy.unit}`;
    }
    return formatMoneyPlain(value, this._costSource?.currency);
  }
  async _loadCompare(token, options) {
    const previous = shiftPeriod(this._level, this._anchor, -1, options);
    const range = periodRange(this._level, previous, options);
    const starts = bucketStarts(this._level, range.startMs, range.endMs);
    const result = await fetchBuckets(this._hass, {
      energyEntityId: this._entities.energy,
      powerEntityId: this._entities.power,
      startMs: range.startMs,
      endMs: range.endMs,
      period: range.period,
      starts
    });
    if (token !== this._token) return;
    const values = result.buckets.map((b) => ({ t: b.t, kwh: b.kwh, cost: null }));
    this._compare = values.some((b) => Number.isFinite(b.kwh)) ? values : null;
    this._compareLabel = this._previousLabel(range);
    this._applyToChart();
    this._renderSummary();
    if (!this._compare) return;
    const source = await this._ensureCostSource();
    if (!source || token !== this._token) return;
    const costs = await fetchBucketCosts(this._hass, source, {
      buckets: values,
      startMs: range.startMs,
      endMs: range.endMs,
      period: range.period
    });
    if (token !== this._token || !costs) return;
    values.forEach((bucket, i) => {
      bucket.cost = Number.isFinite(costs[i]) ? costs[i] : null;
    });
    this._applyToChart();
    this._renderSummary();
  }
  /**
   * Wie die Vorperiode heisst. Steht man in der Gegenwart, ist „gestern"
   * verständlicher als „Donnerstag, 13. August" — blättert man dagegen im
   * August herum, wäre genau dieses Wort falsch.
   */
  _previousLabel(range) {
    if (this._range && isCurrentPeriod(this._range.startMs, this._range.endMs)) {
      const relative = { day: "yesterday", week: "last_week", month: "last_month", year: "last_year" };
      return t(relative[range.level]);
    }
    return t(`compare_at_${range.level}`, {
      label: periodLabel(range.level, range.startMs, range.endMs)
    });
  }
  _applyToChart() {
    const project = (list) => list?.map((b) => ({ t: b.t, value: this._valueOf(b) })) ?? null;
    this._bars.setData(project(this._buckets), {
      compare: this._config.compare === false ? null : project(this._compare),
      level: this._level,
      completed: this._completed
    });
    this._bars.render();
    const hasData = this._buckets.some((b) => Number.isFinite(b.kwh));
    this._empty.textContent = hasData ? this._gapHint() : t("no_period_data");
    this._empty.classList.toggle("visible", !hasData);
  }
  /**
   * Hinweis, wenn die Daten erst mitten in der Periode einsetzen. Bei einem
   * frisch aufgesetzten Zähler ist die halbleere Jahresansicht der Normalfall
   * und kein Fehler — das soll die Karte auch sagen.
   */
  _gapHint() {
    const first = this._buckets.findIndex((b) => Number.isFinite(b.kwh));
    if (first <= 0) return "";
    const date = new Intl.DateTimeFormat(getLocale(), {
      day: "numeric",
      month: "long",
      ...this._level === "year" ? { day: void 0 } : {}
    }).format(new Date(this._buckets[first].t));
    return t("data_from", { date });
  }
  /* ------------------------------------------------------------------ *
   * Anzeige
   * ------------------------------------------------------------------ */
  _renderHeader() {
    if (!this._range) return;
    const { level, startMs, endMs } = this._range;
    this._labelEl.textContent = periodLabel(level, startMs, endMs);
    const current2 = isCurrentPeriod(startMs, endMs);
    this._subEl.textContent = current2 ? t(CURRENT_LABEL[level]) : "";
    this._subEl.classList.toggle("visible", current2);
    this._toCurrent.classList.toggle("visible", !current2);
    this._next.disabled = current2;
  }
  _sum(list, limit = Infinity) {
    let sum = 0;
    let seen = false;
    for (let i = 0; i < Math.min(list.length, limit); i++) {
      const value = this._valueOf(list[i]);
      if (Number.isFinite(value)) {
        sum += value;
        seen = true;
      }
    }
    return seen ? sum : null;
  }
  _renderSummary() {
    if (this._selection >= 0 && this._buckets[this._selection]) {
      const bucket = this._buckets[this._selection];
      const next = this._buckets[this._selection + 1]?.t ?? this._range?.endMs ?? bucket.t;
      this._setValue(this._valueOf(bucket));
      this._summarySubEl.textContent = this._selectionSub(bucket, next - bucket.t);
      this._deltaEl.textContent = "";
      this._deltaEl.className = "summary-delta";
      return;
    }
    const total = this._sum(this._buckets);
    this._setValue(total);
    this._summarySubEl.textContent = this._averageText();
    this._renderDelta(total);
  }
  /**
   * Unter einem gewählten Balken steht sein Zeitraum — und, sofern bekannt, der
   * Wert in der jeweils anderen Einheit. Wer auf Kosten schaut, will trotzdem
   * wissen, wie viele Kilowattstunden dahinterstecken.
   */
  _selectionSub(bucket, durationMs) {
    const label = bucketLabel(this._level, bucket.t, durationMs);
    const other = this._mode === "cost" ? bucket.kwh : bucket.cost;
    if (!Number.isFinite(other)) return label;
    const text = this._mode === "cost" ? `${formatEnergy(other).value} ${formatEnergy(other).unit}` : formatMoneyPlain(other, this._costSource?.currency);
    return `${label} \xB7 ${text}`;
  }
  _setValue(value) {
    if (!Number.isFinite(value)) {
      this._valueEl.innerHTML = "\u2013";
      return;
    }
    const { value: number, unit, prefix } = this._format(value);
    const symbol = unit ? `<span class="unit${prefix ? " prefix" : ""}">${unit}</span>` : "";
    this._valueEl.innerHTML = prefix ? `${symbol}${number}` : `${number}${symbol}`;
  }
  /**
   * Mittelwert und Hochrechnung.
   *
   * Beide rechnen nur auf **abgeschlossenen** Balken. Die laufende Stunde bzw.
   * der laufende Tag ist zwangsläufig noch nicht voll; ihn mitzumitteln würde
   * den Schnitt drücken und die Hochrechnung systematisch zu niedrig ausfallen
   * lassen — je früher am Tag, desto stärker.
   */
  _averageText() {
    const counted = Math.min(this._completed, this._buckets.length);
    const done = this._buckets.slice(0, counted).map((b) => this._valueOf(b)).filter((v) => Number.isFinite(v));
    if (!done.length) return "";
    const mean = done.reduce((sum, v) => sum + v, 0) / done.length;
    const parts = [t(AVERAGE_LABEL[this._level], { value: this._formatPlain(mean) })];
    if (counted < this._buckets.length && done.length >= 2) {
      parts.push(t("projection", { value: this._formatPlain(mean * this._buckets.length) }));
    }
    return parts.join(" \xB7 ");
  }
  /**
   * Vergleich mit der Vorperiode.
   *
   * Zwei Vorkehrungen, ohne die die Zahl täuscht:
   *
   * Bei einer laufenden Periode wird nur so weit verglichen, wie sie
   * fortgeschritten ist — am 15. August gegen den 1.–15. Juli. Gegen den ganzen
   * Juli gerechnet stünde dort zwangsläufig „−50 %", und das sagt nichts über
   * den Verbrauch, sondern nur über das Datum.
   *
   * Und gezählt werden nur Balken, für die **beide** Perioden Daten haben. Bei
   * einem Zähler, der erst seit ein paar Monaten läuft, ist die Vorperiode
   * halb leer; ohne diese Regel stünde dort „+900 % gegenüber dem Vorjahr",
   * obwohl schlicht die Vergleichsdaten fehlen. Deckt der Vergleich weniger als
   * die Hälfte ab, entfällt er ganz.
   */
  _renderDelta(total) {
    const compare = this._compare;
    this._deltaEl.className = "summary-delta";
    this._deltaEl.textContent = "";
    if (!compare || !Number.isFinite(total)) return;
    const partial = this._completed < this._buckets.length;
    const limit = partial ? this._completed : this._buckets.length;
    let mine = 0;
    let theirs = 0;
    let shared = 0;
    let mineTotal = 0;
    for (let i = 0; i < limit; i++) {
      const a = this._valueOf(this._buckets[i]);
      const b = this._valueOf(compare[i]);
      if (Number.isFinite(a)) mineTotal++;
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      mine += a;
      theirs += b;
      shared++;
    }
    if (shared < 2 || theirs <= 0) return;
    if (shared < mineTotal * 0.5) return;
    const ratio = (mine - theirs) / theirs;
    const percent = Math.round(Math.abs(ratio) * 100);
    const span = this._compareLabel || "";
    let text;
    if (percent < 1) {
      text = t("compare_same", { span });
    } else {
      text = t(ratio > 0 ? "compare_more" : "compare_less", { value: `${percent} %`, span });
      this._deltaEl.classList.add(ratio > 0 ? "up" : "down");
    }
    this._deltaEl.textContent = partial ? `${text} (${t("compare_partial")})` : text;
  }
};

// energy-card/src/discovery.js
var POWER_UNITS = /* @__PURE__ */ new Set(["W", "kW", "MW", "mW"]);
var ENERGY_UNITS = /* @__PURE__ */ new Set(["Wh", "kWh", "MWh"]);
var NAME_HINTS = [
  [/pulse/i, 60],
  [/tibber/i, 50],
  [/haus|house|home|gesamt|total|grid|netz/i, 20]
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
function discoverPowerEntity(hass) {
  const list = candidates(hass, { deviceClass: "power", units: POWER_UNITS });
  if (!list.length) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const item of list) {
    let score = scoreName(item.entityId, item.attrs.friendly_name);
    if (item.attrs.state_class === "measurement") score += 25;
    const value = Number(item.state.state);
    if (Number.isFinite(value)) score += Math.min(10, Math.log10(Math.max(1, value)) * 4);
    if (score > bestScore) {
      bestScore = score;
      best = item.entityId;
    }
  }
  return best;
}
function discoverEnergyEntity(hass, powerEntityId) {
  const list = candidates(hass, { deviceClass: "energy", units: ENERGY_UNITS });
  if (!list.length) return null;
  const stem = (powerEntityId || "").replace(/^sensor\./, "").replace(/(^|_)(power|leistung|verbrauch)(_|$)/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
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
  return bestScore >= 0 ? best : null;
}
function resolveEntities(hass, config) {
  const power = config.power_entity || discoverPowerEntity(hass);
  const energy = config.energy_today_entity ?? (config.energy_today_entity === null ? null : discoverEnergyEntity(hass, power));
  return { power, energy };
}

// energy-card/src/card.js
var RING_RADIUS = 15;
var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
var STATS_REFRESH_MS = 5 * 6e4;
var BREAKPOINTS = { narrow: 380, wide: 680, xwide: 1e3 };
var WINDOW_STATS_THROTTLE_MS = 1e4;
var ICONS = {
  flash: "M11,15H6L13,1V9H18L11,23V15Z",
  up: "M16,6L18.29,8.29L13.41,13.17L9.41,9.17L2,16.59L3.41,18L9.41,12L13.41,16L19.71,9.71L22,12V6H16Z",
  down: "M16,18L18.29,15.71L13.41,10.83L9.41,14.83L2,7.41L3.41,6L9.41,12L13.41,8L19.71,14.29L22,12V18H16Z"
};
var icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
function fireEvent(node, type, detail) {
  node.dispatchEvent(
    new CustomEvent(type, { detail, bubbles: true, composed: true })
  );
}
var EnergyCard = class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._entities = { power: null, energy: null };
    this._view = "live";
    this._analysis = null;
    this._rangeKey = DEFAULT_START_RANGE;
    this._window = null;
    this._followLive = true;
    this._series = { points: [], resolution: null };
    this._scrubPoint = null;
    this._dayStats = { max: null, min: null, energyToday: null, typical: null };
    this._costSource = void 0;
    this._costStats = { window: null, today: null, month: null, monthKwh: null };
    this._costToken = 0;
    this._windowCostToken = 0;
    this._windowStats = { max: null, min: null, energy: null, count: 0 };
    this._windowStatsAt = 0;
    this._energyToken = 0;
    this._loadToken = 0;
    this._built = false;
    this._isLight = false;
    this._detachInteractions = null;
    this._unsubscribeLive = null;
    this._lastLiveState = null;
    this._lastThemeStamp = null;
    this._lastStatsFetch = 0;
  }
  /* ------------------------------------------------------------------ *
   * Lovelace-Schnittstelle
   * ------------------------------------------------------------------ */
  static getConfigElement() {
    return document.createElement("energy-card-editor");
  }
  static getStubConfig(hass) {
    const { power, energy } = resolveEntities(hass || {}, {});
    return {
      type: "custom:energy-card",
      title: "Pulse",
      ...power ? { power_entity: power } : {},
      ...energy ? { energy_today_entity: energy } : {}
    };
  }
  setConfig(config) {
    const ranges = Array.isArray(config.ranges) && config.ranges.length ? sortRangeKeys(config.ranges.filter((key) => RANGES.some((r) => r.key === key))) : DEFAULT_RANGE_KEYS;
    if (!ranges.length) {
      throw new Error("`ranges` enth\xE4lt keinen g\xFCltigen Zeitraum");
    }
    const hasCustomThresholds = Array.isArray(config.thresholds) && config.thresholds.length > 0;
    const scope = config.stats_scope === "today" ? "today" : "range";
    const view = ["live", "analysis", "tabs"].includes(config.view) ? config.view : "live";
    let defaultRange = DEFAULT_START_RANGE;
    if (ranges.includes(config.default_range)) defaultRange = config.default_range;
    else if (!ranges.includes(defaultRange)) defaultRange = ranges[0];
    const previousDefault = this._config?.default_range;
    this._config = {
      title: "Pulse",
      show_stats: true,
      show_today_tiles: false,
      show_cost_tiles: false,
      show_minmax_band: true,
      gauge_max: "auto",
      interactions: {},
      ...config,
      view,
      ranges,
      default_range: defaultRange,
      stats_scope: scope,
      thresholds: normalizeThresholds(config.thresholds),
      hasCustomThresholds
    };
    this._view = view === "analysis" ? "analysis" : "live";
    if (!this._built || !ranges.includes(this._rangeKey) || defaultRange !== previousDefault) {
      this._rangeKey = defaultRange;
    }
    this._entities = { power: null, energy: null };
    this._window = null;
    this._costPromise = null;
    this._costSource = void 0;
    if (this._built) {
      this._analysis?.setConfig(this._config);
      this._renderStatic();
      this._resolveEntities();
      this._lastLiveState = null;
      this._renderHeadline();
      this._updateRing();
      this._updateLiveIndicator();
      this._applyRange(this._rangeKey);
    }
  }
  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    setLocale(hass?.locale?.language);
    const language = setLanguage(hass?.locale?.language);
    if (!this._config) return;
    if (!this._built) this._build();
    const stamp = `${language}|${hass?.themes?.theme}|${hass?.themes?.darkMode}`;
    if (stamp !== this._lastThemeStamp) {
      this._lastThemeStamp = stamp;
      if (!first) this._relabel();
      this._syncTheme();
    }
    if (first || !this._entities.power) this._resolveEntities();
    if (first && this._entities.power) this._applyRange(this._rangeKey);
    this._analysis?.setHass(hass, this._entities);
    this._syncLiveState();
  }
  get hass() {
    return this._hass;
  }
  getCardSize() {
    if (this._config?.view === "analysis") return 9;
    if (this._config?.show_stats === false) return 7;
    let rows = 9;
    if (this._config?.show_today_tiles) rows += 3;
    if (this._config?.show_cost_tiles) rows += 3;
    return this._config?.view === "tabs" ? rows + 1 : rows;
  }
  /**
   * Belegt in der Abschnittsansicht immer die volle Breite, und die Höhe folgt
   * dem Inhalt: Das Chart skaliert mit der Kartenbreite, eine feste Zeilenzahl
   * würde die Karte auf breiten Dashboards abschneiden oder Leerraum lassen.
   */
  getGridOptions() {
    return { columns: "full", rows: "auto", min_columns: 6 };
  }
  /* ------------------------------------------------------------------ *
   * Aufbau
   * ------------------------------------------------------------------ */
  connectedCallback() {
    if (this._config && this._hass && !this._built) this._build();
    this._startTicker();
    this._watchColorScheme();
    this._syncTheme();
  }
  disconnectedCallback() {
    this._stopTicker();
    this._detachInteractions?.();
    this._detachInteractions = null;
    this._resizeObserver?.disconnect();
    this._cardObserver?.disconnect();
    this._analysis?.destroy();
    this._colorSchemeQuery?.removeEventListener("change", this._onColorScheme);
    this._teardownLive();
  }
  _build() {
    this._built = true;
    this.shadowRoot.innerHTML = `<style>${CARD_STYLES}</style>`;
    this._card = document.createElement("ha-card");
    this._card.className = "card";
    this.shadowRoot.appendChild(this._card);
    this._renderStatic();
    this._chart = new Chart({ thresholds: this._activeThresholds(), unit: "W" });
    this._chartWrap.appendChild(this._chart.svg);
    this._bindChartSurface();
    this._syncTheme();
    this._watchWidth();
    this._layout();
    this._startTicker();
    this._watchColorScheme();
  }
  _renderStatic() {
    if (!this._card) return;
    const config = this._config;
    this._card.innerHTML = `
      ${config.title ? `<div class="title">${escapeHtml(config.title)}</div>` : ""}
      ${this._tabsMarkup()}
      <div class="view live-view"${this._view === "live" ? "" : " hidden"}>
        <div class="header" part="header">
          <svg class="ring" viewBox="0 0 40 40" aria-hidden="true">
            <circle class="track" cx="20" cy="20" r="${RING_RADIUS}"></circle>
            <circle class="value-arc" cx="20" cy="20" r="${RING_RADIUS}"
                    stroke-dasharray="${RING_CIRCUMFERENCE.toFixed(2)}"
                    stroke-dashoffset="${RING_CIRCUMFERENCE.toFixed(2)}"></circle>
          </svg>
          <div class="headline">
            <div class="label">${t("right_now")}</div>
            <div class="value">\u2013<span class="unit">W</span></div>
          </div>
          <div class="live"><span class="dot"></span><span class="live-text">${t("live")}</span></div>
        </div>
        <div class="chart-wrap">
          <div class="loading-bar"></div>
          <div class="empty">${t("no_data")}</div>
        </div>
        <div class="ranges"></div>
        <button class="zoom-reset" type="button">${t("back_to_overview")}</button>
        ${this._statsMarkup()}
      </div>
      <div class="view analysis-host"${this._view === "analysis" ? "" : " hidden"}></div>
    `;
    this._liveView = this._card.querySelector(".live-view");
    this._analysisHost = this._card.querySelector(".analysis-host");
    this._mountAnalysis();
    this._bindTabs();
    this._ring = this._card.querySelector(".value-arc");
    this._label = this._card.querySelector(".headline .label");
    this._value = this._card.querySelector(".headline .value");
    this._liveEl = this._card.querySelector(".live");
    this._chartWrap = this._card.querySelector(".chart-wrap");
    this._loading = this._card.querySelector(".loading-bar");
    this._empty = this._card.querySelector(".empty");
    this._rangesEl = this._card.querySelector(".ranges");
    this._zoomReset = this._card.querySelector(".zoom-reset");
    this._card.querySelector(".header").addEventListener("click", () => {
      if (this._entities.power) {
        fireEvent(this, "hass-more-info", { entityId: this._entities.power });
      }
    });
    this._zoomReset.addEventListener("click", () => this._applyRange(this._rangeKey));
    this._renderRangeButtons();
    this._bindTiles();
    this._bindStatRowSync();
    this._renderStats();
    if (this._chart) {
      this._chartWrap.appendChild(this._chart.svg);
      this._bindChartSurface();
    }
  }
  _tabsMarkup() {
    if (this._config.view !== "tabs") return "";
    const tab = (key, label) => `<button type="button" data-view="${key}" class="${this._view === key ? "active" : ""}">${label}</button>`;
    return `<div class="tabs" role="tablist">
      ${tab("live", t("tab_live"))}${tab("analysis", t("tab_analysis"))}
    </div>`;
  }
  _bindTabs() {
    for (const button of this._card.querySelectorAll(".tabs button")) {
      button.addEventListener("click", () => this._setView(button.dataset.view));
    }
  }
  /**
   * Die Analyse-Ansicht überlebt jedes `_renderStatic()`: sie hängt nur an
   * ihrem Wirtselement und wird danach wieder eingesetzt. Ein Neuaufbau würde
   * geladene Daten und die Position im Kalender verlieren.
   */
  _mountAnalysis() {
    if (this._config.view === "live") return;
    if (!this._analysis) {
      this._analysis = new AnalysisView();
      this._analysis.setConfig(this._config);
      if (this._hass) this._analysis.setHass(this._hass, this._entities);
      this._analysis.setThresholds(this._activeThresholds());
    }
    this._analysisHost.appendChild(this._analysis.el);
    if (this._view === "analysis") this._analysis.activate();
  }
  /**
   * Wechselt den Reiter. Die Live-Ansicht bleibt im DOM, gibt aber ihr
   * Verlaufsabo und den Taktgeber ab — ein Abo weiterlaufen zu lassen, das
   * niemand sieht, kostet den Core bei jedem Messwert eine Nachricht.
   */
  _setView(name) {
    if (name === this._view || !["live", "analysis"].includes(name)) return;
    this._view = name;
    for (const button of this._card.querySelectorAll(".tabs button")) {
      button.classList.toggle("active", button.dataset.view === name);
    }
    this._liveView.hidden = name !== "live";
    this._analysisHost.hidden = name !== "analysis";
    if (name === "analysis") {
      this._stopTicker();
      this._teardownLive();
      this._analysis?.activate();
    } else {
      this._analysis?.deactivate();
      this._startTicker();
      this._reload({ force: true });
      this._layout();
    }
  }
  /**
   * Die Kachelreihen. Die obere folgt dem gewählten Zeitraum, die optionale
   * untere bleibt beim laufenden Tag — wer den Zeitraum wechselt, verliert den
   * Tagesbezug damit nicht aus den Augen.
   */
  _statsMarkup() {
    if (this._config.show_stats === false) return "";
    const tiles = `
      ${this._tileMarkup("used", ICONS.flash)}
      ${this._tileMarkup("max", ICONS.up)}
      ${this._tileMarkup("min", ICONS.down)}`;
    const today = this._config.show_today_tiles ? `<div class="stats stats-today" data-row="today">${tiles}</div>` : "";
    const cost = this._config.show_cost_tiles ? `<div class="stats stats-today" data-row="cost">
           ${this._tileMarkup("cost", ICONS.flash)}
           ${this._tileMarkup("cost_today", ICONS.flash)}
           ${this._tileMarkup("cost_month", ICONS.up)}
         </div>` : "";
    return `<div class="stats" data-row="primary">${tiles}</div>${today}${cost}`;
  }
  /**
   * Verbindet Gesten und Grössenüberwachung mit dem aktuellen Chart-Container.
   *
   * `_renderStatic()` baut den Kartenrumpf über `innerHTML` neu auf und ersetzt
   * dabei auch `.chart-wrap`. Ohne erneutes Binden hingen Zeigerereignisse und
   * ResizeObserver anschliessend an einem verwaisten Knoten — die Karte wäre
   * nach jeder Änderung im Karteneditor stumm und würde nicht mehr mitwachsen.
   */
  _bindChartSurface() {
    if (!this._chart || !this._chartWrap) return;
    this._detachInteractions?.();
    this._resizeObserver?.disconnect();
    this._resizeObserver = new ResizeObserver(() => this._layout());
    this._resizeObserver.observe(this._chartWrap);
    this._detachInteractions = attachInteractions(
      this._chartWrap,
      this._chart,
      {
        onScrub: (point) => this._onScrub(point),
        onViewport: (start, end, meta) => this._onViewport(start, end, meta),
        onReset: () => this._applyRange(this._rangeKey)
      },
      this._config.interactions
    );
    this._layout();
  }
  /** Texte nach einem Sprachwechsel austauschen, ohne alles neu aufzubauen. */
  _relabel() {
    if (!this._card) return;
    if (!this._scrubPoint) this._label.textContent = t("right_now");
    this._card.querySelector(".live-text").textContent = t("live");
    this._empty.textContent = t("no_data");
    this._zoomReset.textContent = t("back_to_overview");
    this._renderStats();
    this._renderRangeButtons();
    const tabs = this._card.querySelectorAll(".tabs button");
    if (tabs.length === 2) {
      tabs[0].textContent = t("tab_live");
      tabs[1].textContent = t("tab_analysis");
    }
    this._analysis?._relabel();
  }
  _tileMarkup(key, iconPath) {
    return `
      <div class="tile" data-tile="${key}">
        <div class="tile-head"><span></span>${icon(iconPath)}</div>
        <div class="tile-value">\u2013</div>
        <div class="tile-sub"></div>
      </div>`;
  }
  /**
   * Hält die Kachelreihen beim Wischen zusammen. Auf schmalen Karten laufen
   * sie waagerecht; ohne Kopplung stünde „Maximum 6 Std" über „Minimum heute"
   * und die Spalten meinten nicht mehr dasselbe.
   */
  _bindStatRowSync() {
    const rows = [...this._card.querySelectorAll(".stats")];
    if (rows.length < 2) return;
    let syncing = false;
    for (const row of rows) {
      row.addEventListener(
        "scroll",
        () => {
          if (syncing) return;
          syncing = true;
          for (const other of rows) {
            if (other !== row) other.scrollLeft = row.scrollLeft;
          }
          requestAnimationFrame(() => {
            syncing = false;
          });
        },
        { passive: true }
      );
    }
  }
  _bindTiles() {
    for (const tile of this._card.querySelectorAll(".tile")) {
      tile.addEventListener("click", (event) => {
        event.stopPropagation();
        const key = tile.dataset.tile;
        const entityId = key === "used" ? this._entities.energy || this._entities.power : this._entities.power;
        if (entityId) fireEvent(this, "hass-more-info", { entityId });
      });
    }
  }
  _renderRangeButtons() {
    this._rangesEl.innerHTML = "";
    for (const key of this._config.ranges) {
      const range = rangeByKey(key);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = t(range.labelKey);
      button.dataset.range = key;
      button.classList.toggle("active", key === this._rangeKey);
      button.addEventListener("click", () => this._applyRange(key));
      this._rangesEl.appendChild(button);
    }
  }
  /* ------------------------------------------------------------------ *
   * Thema und Grösse
   * ------------------------------------------------------------------ */
  /**
   * Erkennt das aktive Home-Assistant-Thema an der geerbten Textfarbe. Das ist
   * belastbarer als `prefers-color-scheme`: wer in HA ein helles Thema wählt,
   * während das Betriebssystem dunkel steht, bekommt sonst eine schwarze Karte
   * auf hellem Dashboard.
   */
  _detectLight() {
    const inherited = getComputedStyle(this).getPropertyValue("--primary-text-color").trim();
    if (inherited) return !isLightColor(inherited);
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
  }
  _syncTheme() {
    if (!this._card) return;
    const light = this._detectLight();
    if (light === this._isLight && this._card.classList.contains("light") === light) return;
    this._isLight = light;
    this._card.classList.toggle("light", light);
    this._chart?.setThresholds(this._activeThresholds());
    this._chart?.render();
    this._analysis?.setThresholds(this._activeThresholds());
    this._updateRing();
  }
  _watchColorScheme() {
    if (this._colorSchemeQuery || !window.matchMedia) return;
    this._colorSchemeQuery = window.matchMedia("(prefers-color-scheme: light)");
    this._onColorScheme = () => this._syncTheme();
    this._colorSchemeQuery.addEventListener("change", this._onColorScheme);
  }
  /** Eigene Schwellenfarben schlagen die themenabhängigen Vorgaben. */
  _activeThresholds() {
    if (this._config?.hasCustomThresholds) return this._config.thresholds;
    return this._isLight ? DEFAULT_THRESHOLDS_LIGHT : DEFAULT_THRESHOLDS;
  }
  /**
   * Breitenstufen der Karte. Bewusst getrennt von `_layout()`: das misst den
   * Chart-Container, und der ist null breit, solange sein Reiter verborgen ist
   * — die Analyse-Ansicht bekäme sonst nie ihre Breitenklassen.
   */
  _watchWidth() {
    this._cardObserver?.disconnect();
    this._cardObserver = new ResizeObserver(() => this._applyBreakpoints());
    this._cardObserver.observe(this._card);
    this._applyBreakpoints();
  }
  _applyBreakpoints() {
    const width = this._card?.clientWidth;
    if (!width) return;
    this._card.classList.toggle("is-narrow", width < BREAKPOINTS.narrow);
    this._card.classList.toggle("is-wide", width >= BREAKPOINTS.wide);
    this._card.classList.toggle("is-xwide", width >= BREAKPOINTS.xwide);
  }
  _layout() {
    if (!this._chart || !this._chartWrap) return;
    const width = this._chartWrap.clientWidth;
    if (!width) return;
    const cardWidth = this._card.clientWidth || width;
    const wide = cardWidth >= BREAKPOINTS.wide;
    const ratio = wide ? 0.34 : 0.52;
    const cap = wide ? 380 : 300;
    const desired = Math.round(Math.max(190, Math.min(cap, width * ratio)));
    this._chartWrap.style.setProperty("--ec-chart-basis", `${desired}px`);
    const height = Math.round(this._chartWrap.clientHeight) || desired;
    this._chart.setSize(width, height);
    this._chart.render();
  }
  /* ------------------------------------------------------------------ *
   * Entities und Zeitfenster
   * ------------------------------------------------------------------ */
  _resolveEntities() {
    if (!this._hass || !this._config) return;
    const resolved = resolveEntities(this._hass, this._config);
    const changed = resolved.power !== this._entities.power || resolved.energy !== this._entities.energy;
    this._entities = resolved;
    if (!resolved.power) {
      this._showError(t("no_power_entity"));
    } else if (changed) {
      this._clearError();
      this._chart?.setThresholds(this._activeThresholds());
    }
    if (changed) {
      this._costPromise = null;
      this._costSource = void 0;
      this._analysis?.setHass(this._hass, resolved);
    }
  }
  _applyRange(key) {
    if (!this._config.ranges.includes(key)) key = this._config.ranges[0];
    this._rangeKey = key;
    for (const button of this._rangesEl?.querySelectorAll("button") || []) {
      button.classList.toggle("active", button.dataset.range === key);
    }
    const windowMs = rangeByKey(key).windowMs;
    const now = Date.now();
    this._window = { startMs: now - windowMs, endMs: now };
    this._followLive = true;
    this._zoomReset?.classList.remove("visible");
    this._scrubPoint = null;
    this._chart?.hideCursor();
    this._reload({ force: true });
    this._startTicker();
  }
  _onViewport(startMs, endMs, { settled }) {
    this._window = { startMs, endMs };
    this._followLive = false;
    this._zoomReset?.classList.add("visible");
    this._chart.setWindow(startMs, endMs, { liveEnd: endMs >= Date.now() - 6e4 });
    this._chart.render();
    this._updateLiveIndicator();
    if (!settled) return;
    this._updateWindowStats({ force: true });
    const current2 = this._series.resolution;
    const next = pickResolution(endMs - startMs);
    const outOfRange = !this._series.points.length || startMs < this._series.points[0].t - 1e3 || endMs > this._series.points.at(-1).t + 6e4;
    if (!current2 || current2.source !== next.source || current2.period !== next.period || outOfRange) {
      this._reload({ force: false });
    }
  }
  /* ------------------------------------------------------------------ *
   * Daten
   * ------------------------------------------------------------------ */
  async _reload({ force }) {
    const hass = this._hass;
    const entityId = this._entities.power;
    if (!hass || !entityId || !this._window) return;
    if (this._view !== "live") return;
    const token = ++this._loadToken;
    this._setLoading(true);
    this._teardownLive();
    const span = this._window.endMs - this._window.startMs;
    const resolution = pickResolution(span);
    const startMs = this._window.startMs - span * 0.25;
    const endMs = Math.min(Date.now(), this._window.endMs + span * 0.25);
    try {
      const result = await fetchSeries(hass, entityId, startMs, endMs, resolution);
      if (token !== this._loadToken) return;
      this._series = result;
      this._applySeries();
      if (result.resolution.live) {
        this._setupLive(startMs);
      }
    } catch (err) {
      if (token === this._loadToken) {
        this._series = { points: [], resolution: null };
        this._applySeries();
      }
    } finally {
      if (token === this._loadToken) this._setLoading(false);
    }
    if (force || Date.now() - this._lastStatsFetch > STATS_REFRESH_MS) {
      this._loadDayStats();
    }
  }
  _applySeries() {
    const showBand = this._config.show_minmax_band !== false && this._series.resolution?.source === "statistics";
    this._chart.setSeries(this._series.points, { showBand });
    this._chart.setWindow(this._window.startMs, this._window.endMs, {
      liveEnd: this._followLive || this._window.endMs >= Date.now() - 6e4
    });
    this._chart.render();
    this._empty?.classList.toggle("visible", this._series.points.length < 2);
    this._updateRing();
    this._updateLiveIndicator();
    this._updateWindowStats({ force: true });
  }
  async _setupLive(startMs) {
    const hass = this._hass;
    const entityId = this._entities.power;
    const token = this._loadToken;
    this._unsubscribeLive = await subscribeHistory(hass, entityId, startMs, (points) => {
      if (token !== this._loadToken) return;
      this._mergePoints(points);
    });
    if (token !== this._loadToken) this._teardownLive();
  }
  _teardownLive() {
    const unsubscribe = this._unsubscribeLive;
    this._unsubscribeLive = null;
    if (typeof unsubscribe === "function") {
      try {
        unsubscribe();
      } catch (err) {
      }
    } else if (unsubscribe && typeof unsubscribe.then === "function") {
      unsubscribe.then((fn) => fn?.()).catch(() => {
      });
    }
  }
  /** Neue Live-Punkte einsortieren und den Verlauf vorne beschneiden. */
  _mergePoints(incoming) {
    const points = this._series.points;
    const last = points.length ? points.at(-1).t : -Infinity;
    const fresh = incoming.filter((p) => p.t > last);
    if (!fresh.length) return;
    points.push(...fresh);
    const keepFrom = Date.now() - 6 * 36e5;
    if (points.length > 4e3 && points[0].t < keepFrom) {
      const cut = points.findIndex((p) => p.t >= keepFrom);
      if (cut > 0) points.splice(0, cut);
    }
    if (this._followLive) this._advanceWindow();
    this._chart.render();
    this._updateRing();
    this._updateWindowStats();
  }
  async _loadDayStats() {
    const hass = this._hass;
    const entityId = this._entities.power;
    if (!hass || !entityId || this._config.show_stats === false) return;
    this._lastStatsFetch = Date.now();
    const [extremes, energyToday] = await Promise.all([
      fetchTodayExtremes(hass, entityId).catch(() => ({ max: null, min: null, typical: null })),
      fetchEnergyToday(hass, entityId, this._entities.energy).catch(() => null)
    ]);
    this._dayStats = { ...extremes, energyToday };
    this._renderStats();
    this._updateRing();
    this._loadMonthCosts();
  }
  /**
   * Die Preisquelle wird einmal gesucht und dann behalten.
   *
   * Gemerkt wird das **Versprechen**, nicht das Ergebnis. Mit einem Merker auf
   * dem Ergebnis sähe ein zweiter Aufrufer, der währenddessen hereinkommt, den
   * Zwischenstand „nichts gefunden" und gäbe auf — welche Kachel leer bleibt,
   * entschiede dann der Zufall des Wettlaufs.
   */
  _ensureCostSource() {
    this._costPromise ??= resolveCostSource(
      this._hass,
      this._config,
      this._entities.energy
    ).then((source) => {
      this._costSource = source;
      return source;
    });
    return this._costPromise;
  }
  /**
   * Kosten des laufenden Monats, aufgeschlüsselt nach Tagen.
   *
   * Aus einer einzigen Abfrage fallen alle drei Kachelwerte an: der heutige
   * Betrag ist der letzte Tagesblock, die Prognose das Mittel der
   * **abgeschlossenen** Tage mal der Länge des Monats. Den angebrochenen Tag
   * mitzumitteln würde die Prognose morgens früh systematisch zu niedrig
   * ausfallen lassen.
   */
  async _loadMonthCosts() {
    if (!this._config.show_cost_tiles || !this._hass) return;
    const source = await this._ensureCostSource();
    if (!source) return;
    const token = ++this._costToken;
    const range = periodRange("month", Date.now());
    const starts = bucketStarts("month", range.startMs, range.endMs);
    const { buckets } = await fetchBuckets(this._hass, {
      energyEntityId: this._entities.energy,
      powerEntityId: this._entities.power,
      startMs: range.startMs,
      endMs: range.endMs,
      period: range.period,
      starts
    });
    if (token !== this._costToken) return;
    const costs = await fetchBucketCosts(this._hass, source, {
      buckets,
      startMs: range.startMs,
      endMs: range.endMs,
      period: range.period
    });
    if (token !== this._costToken || !costs) return;
    const done = completedBuckets(starts, range.endMs);
    const finishedCosts = costs.slice(0, done).filter((v) => Number.isFinite(v));
    const finishedKwh = buckets.slice(0, done).map((b) => b.kwh).filter((v) => Number.isFinite(v));
    const project = (list) => list.length >= 2 ? list.reduce((sum, v) => sum + v, 0) / list.length * starts.length : null;
    this._costStats = {
      ...this._costStats,
      today: Number.isFinite(costs[done]) ? costs[done] : null,
      month: project(finishedCosts),
      monthKwh: project(finishedKwh)
    };
    this._renderStats();
    this._loadWindowCost();
  }
  /**
   * Was die Kilowattstunde heute im Schnitt gekostet hat.
   *
   * Nur nötig, wenn die Preisquelle eine Kostenstatistik ist: die kennt keinen
   * Preis, sondern nur Beträge. Für Fenster, die für Statistikblöcke zu kurz
   * sind, lässt sich daraus ein brauchbarer Arbeitspreis zurückrechnen.
   */
  _effectivePrice() {
    const cost = this._costStats.today;
    const kwh = this._dayStats.energyToday;
    if (!Number.isFinite(cost) || !Number.isFinite(kwh) || kwh <= 0) return null;
    return cost / kwh;
  }
  /** Kosten des sichtbaren Fensters — folgt Zeitraumwahl, Zoom und Pan. */
  async _loadWindowCost() {
    if (!this._config.show_cost_tiles || !this._hass || !this._window) return;
    const source = await this._ensureCostSource();
    if (!source) return;
    const token = ++this._windowCostToken;
    const value = await fetchCostForPeriod(this._hass, source, {
      startMs: this._window.startMs,
      endMs: this._window.endMs,
      kwh: this._windowStats.energy,
      effectivePrice: this._effectivePrice()
    });
    if (token !== this._windowCostToken) return;
    this._costStats = { ...this._costStats, window: value };
    this._renderStats();
  }
  /* ------------------------------------------------------------------ *
   * Anzeige
   * ------------------------------------------------------------------ */
  _currentPower() {
    const state = this._hass?.states?.[this._entities.power];
    if (!state) return null;
    const value = Number(state.state);
    if (!Number.isFinite(value)) return null;
    return value * powerFactor(entityUnit(this._hass, this._entities.power));
  }
  _syncLiveState() {
    const state = this._hass?.states?.[this._entities.power];
    if (!state) return;
    if (state.last_updated === this._lastLiveState) return;
    this._lastLiveState = state.last_updated;
    if (!this._scrubPoint) this._renderHeadline();
    this._updateRing();
  }
  _onScrub(point) {
    this._scrubPoint = point;
    this._renderHeadline();
    this._updateRing();
    this._updateLiveIndicator();
  }
  _renderHeadline() {
    if (!this._value) return;
    if (this._scrubPoint) {
      const windowMs = this._window ? this._window.endMs - this._window.startMs : 36e5;
      this._label.textContent = formatMoment(this._scrubPoint.t, windowMs);
      this._setValue(this._scrubPoint.v);
      return;
    }
    this._label.textContent = t("right_now");
    const current2 = this._currentPower();
    if (current2 == null) {
      this._value.innerHTML = `\u2013<span class="unit">W</span>`;
      return;
    }
    this._setValue(current2);
  }
  _setValue(watt) {
    this._value.innerHTML = `${formatWatt(watt)}<span class="unit">W</span>`;
  }
  /**
   * Zeigt an, dass die Karte am aktuellen Rand der Zeitachse klebt. Der Punkt
   * am Kurvenende pulsiert nur mit, wenn die Werte auch wirklich als Strom
   * hereinkommen — bei Statistikansichten wäre ein Pulsieren gelogen, dort
   * aktualisiert sich der Verlauf nur alle paar Minuten.
   */
  _updateLiveIndicator() {
    const following = this._followLive && !this._scrubPoint;
    this._liveEl?.classList.toggle("visible", following);
    const streaming = following && this._series.resolution?.live === true;
    this._chart?.setLive(streaming);
  }
  /**
   * Bezugswert für den Ring: das 95. Perzentil des heutigen Verlaufs, nicht
   * das absolute Tagesmaximum — sonst würde eine einzige Wasserkocher-Spitze
   * den Ring für den Rest des Tages zum Stummel machen. Läuft gerade etwas
   * Grösseres, zieht der aktuelle Wert die Obergrenze mit hoch, sodass der
   * Ring bei Volllast geschlossen ist wie in der Vorlage.
   */
  _gaugeMax() {
    const configured = Number(this._config.gauge_max);
    if (Number.isFinite(configured) && configured > 0) return configured;
    const current2 = this._currentPower() ?? 0;
    const typical = this._dayStats.typical;
    const candidates2 = [typical, current2].filter((v) => Number.isFinite(v) && v > 0);
    return candidates2.length ? Math.max(...candidates2) : 1e3;
  }
  _updateRing() {
    if (!this._ring) return;
    const value = this._scrubPoint ? this._scrubPoint.v : this._currentPower();
    const color = colorForValue(value ?? 0, this._activeThresholds());
    const ratio = value == null ? 0 : Math.max(0.04, Math.min(1, value / this._gaugeMax()));
    this._ring.setAttribute("stroke", color);
    this._ring.setAttribute(
      "stroke-dashoffset",
      (RING_CIRCUMFERENCE * (1 - ratio)).toFixed(2)
    );
    this._card?.style.setProperty("--ec-live-color", color);
  }
  /**
   * Worauf sich die obere Kachelreihe bezieht.
   *
   * Grundsätzlich auf den gewählten Zeitraum — wer 5 Min oder 6 Std anzeigt,
   * will die Spitze dieser Spanne sehen und nicht die des ganzen Tages. Sobald
   * jemand zoomt oder verschiebt, gewinnt der sichtbare Ausschnitt. Den
   * Tagesbezug gibt es weiterhin, entweder für die ganze Reihe
   * (`stats_scope: today`) oder als zweite Reihe darunter.
   */
  _statsScope() {
    if (this._config.stats_scope === "today") return "today";
    if (!this._followLive) return "view";
    return "range";
  }
  /**
   * Kennzahlen des sichtbaren Fensters. Läuft auf den bereits geladenen
   * Punkten, kostet also keinen Abruf und folgt Zoom und Pan unmittelbar.
   * Der genauere Zählerwert wird nur bei echten Wechseln nachgeholt.
   */
  _updateWindowStats({ force = false } = {}) {
    if (!this._window) return;
    if (!force && Date.now() - this._windowStatsAt < WINDOW_STATS_THROTTLE_MS) return;
    this._windowStatsAt = Date.now();
    const buckets = this._series.resolution?.source === "statistics";
    this._windowStats = computeWindowStats(
      this._series.points,
      this._window.startMs,
      this._window.endMs,
      { buckets }
    );
    this._renderStats();
    if (force) {
      this._refreshWindowEnergy();
      this._loadWindowCost();
    }
  }
  /** Verbrauch im Fenster aus den Zählerstatistiken — genauer als die
   *  Integration des Leistungsverlaufs, sofern ein Energiesensor existiert. */
  async _refreshWindowEnergy() {
    const energyEntity = this._entities.energy;
    if (!energyEntity || !this._hass || !this._window) return;
    if (this._statsScope() === "today") return;
    const { startMs, endMs } = this._window;
    if (endMs - startMs < ENERGY_STATS_MIN_MS) return;
    const token = ++this._energyToken;
    const value = await fetchEnergyForPeriod(this._hass, energyEntity, startMs, endMs);
    if (token !== this._energyToken || value == null) return;
    this._windowStats = { ...this._windowStats, energy: value };
    this._renderStats();
    this._loadWindowCost();
  }
  _renderStats() {
    if (this._config.show_stats === false || !this._card) return;
    this._renderStatRow("primary", this._statsScope());
    this._renderStatRow("today", "today");
    this._renderCostRow();
  }
  /**
   * Die Kostenreihe. Sie folgt demselben Bezug wie die obere Reihe, damit
   * „Verbrauch 6 Std" und „Kosten 6 Std" untereinander stehen und dasselbe
   * Fenster meinen.
   */
  _renderCostRow() {
    const container = this._card.querySelector('.stats[data-row="cost"]');
    if (!container) return;
    const scope = this._statsScope();
    const vars = scope === "range" ? { span: t(rangeByKey(this._rangeKey).labelKey) } : void 0;
    const currency = this._costSource?.currency;
    const money = (value) => {
      if (!Number.isFinite(value)) return "\u2013";
      const { value: number, unit, prefix } = formatMoney(value, currency);
      const symbol = unit ? `<span class="unit${prefix ? " prefix" : ""}">${unit}</span>` : "";
      return prefix ? `${symbol}${number}` : `${number}${symbol}`;
    };
    const set = (key, label, value, sub) => {
      const tile = container.querySelector(`.tile[data-tile="${key}"]`);
      if (!tile) return;
      tile.querySelector(".tile-head span").textContent = label;
      tile.querySelector(".tile-value").innerHTML = value;
      tile.querySelector(".tile-sub").textContent = sub || "";
    };
    const stats = this._costStats;
    set("cost", t(`cost_${scope}`, vars), money(scope === "today" ? stats.today : stats.window), "");
    set("cost_today", t("cost_today"), money(stats.today), "");
    const projectedKwh = Number.isFinite(stats.monthKwh) ? `\u2248 ${formatEnergy(stats.monthKwh).value} ${formatEnergy(stats.monthKwh).unit}` : "";
    set("cost_month", t("cost_month"), money(stats.month), projectedKwh);
  }
  /** Füllt eine Kachelreihe mit den Zahlen ihres Bezugs. */
  _renderStatRow(row, scope) {
    const container = this._card.querySelector(`.stats[data-row="${row}"]`);
    if (!container) return;
    const vars = scope === "range" ? { span: t(rangeByKey(this._rangeKey).labelKey) } : void 0;
    const { max, min, energy } = scope === "today" ? { ...this._dayStats, energy: this._dayStats.energyToday } : this._windowStats;
    const stampSpan = scope === "today" || !this._window ? 0 : this._window.endMs - this._window.startMs;
    const set = (key, value, sub) => {
      const tile = container.querySelector(`.tile[data-tile="${key}"]`);
      if (!tile) return;
      tile.querySelector(".tile-head span").textContent = t(`${key}_${scope}`, vars);
      tile.querySelector(".tile-value").innerHTML = value;
      tile.querySelector(".tile-sub").textContent = sub || "";
    };
    const used = energy == null ? null : formatEnergy(energy);
    set("used", used ? `${used.value}<span class="unit">${used.unit}</span>` : "\u2013", "");
    set(
      "max",
      max ? `${formatWatt(max.value)}<span class="unit">W</span>` : "\u2013",
      max ? formatMoment(max.t, stampSpan) : ""
    );
    set(
      "min",
      min ? `${formatWatt(min.value)}<span class="unit">W</span>` : "\u2013",
      min ? formatMoment(min.t, stampSpan) : ""
    );
  }
  _setLoading(active) {
    this._loading?.classList.toggle("visible", !!active);
  }
  _showError(message) {
    if (!this._card) return;
    let node = this._card.querySelector(".error");
    if (!node) {
      node = document.createElement("div");
      node.className = "error";
      this._card.prepend(node);
    }
    node.textContent = message;
  }
  _clearError() {
    this._card?.querySelector(".error")?.remove();
  }
  /* ------------------------------------------------------------------ *
   * Uhrwerk: schiebt das Fenster mit, solange nicht gezoomt wird
   * ------------------------------------------------------------------ */
  _startTicker() {
    this._stopTicker();
    if (!this._window) return;
    const span = this._window.endMs - this._window.startMs;
    let interval = 6e4;
    if (span <= 15 * 6e4) interval = 1e3;
    else if (span <= 3 * 36e5) interval = 5e3;
    this._ticker = setInterval(() => {
      if (!this._followLive || !this.isConnected) return;
      this._advanceWindow();
      this._chart.render();
      const stale = this._series.resolution?.source === "statistics";
      if (stale && Date.now() - this._lastStatsFetch > STATS_REFRESH_MS) {
        this._reload({ force: true });
      }
    }, interval);
  }
  _advanceWindow() {
    const span = this._window.endMs - this._window.startMs;
    const end = Date.now();
    this._window = { startMs: end - span, endMs: end };
    this._chart.setWindow(this._window.startMs, this._window.endMs, { liveEnd: true });
  }
  _stopTicker() {
    clearInterval(this._ticker);
    this._ticker = null;
  }
};
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
}

// energy-card/src/editor.js
var buildSchema = () => [
  { name: "title", selector: { text: {} } },
  {
    name: "view",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "live", label: t("view_live") },
          { value: "tabs", label: t("view_tabs") },
          { value: "analysis", label: t("view_analysis") }
        ]
      }
    }
  },
  {
    name: "power_entity",
    selector: { entity: { filter: { domain: "sensor", device_class: "power" } } }
  },
  {
    name: "energy_today_entity",
    selector: { entity: { filter: { domain: "sensor", device_class: "energy" } } }
  },
  {
    name: "ranges",
    selector: {
      select: {
        multiple: true,
        mode: "list",
        options: RANGES.map((range) => ({ value: range.key, label: t(range.labelKey) }))
      }
    }
  },
  {
    name: "default_range",
    selector: {
      select: {
        mode: "dropdown",
        options: RANGES.map((range) => ({ value: range.key, label: t(range.labelKey) }))
      }
    }
  },
  {
    name: "default_level",
    selector: {
      select: {
        mode: "dropdown",
        options: LEVELS.map((level) => ({ value: level, label: t(`level_${level}`) }))
      }
    }
  },
  {
    name: "gauge_max",
    selector: { number: { min: 0, step: 100, mode: "box", unit_of_measurement: "W" } }
  },
  {
    name: "stats_scope",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "range", label: t("scope_range") },
          { value: "today", label: t("scope_today") }
        ]
      }
    }
  },
  {
    name: "cost_entity",
    selector: { entity: { filter: { domain: "sensor", device_class: "monetary" } } }
  },
  {
    name: "price",
    selector: { number: { min: 0, step: 1e-3, mode: "box" } }
  },
  {
    type: "grid",
    schema: [
      { name: "show_stats", selector: { boolean: {} } },
      { name: "show_today_tiles", selector: { boolean: {} } },
      { name: "show_cost_tiles", selector: { boolean: {} } },
      { name: "show_minmax_band", selector: { boolean: {} } },
      { name: "compare", selector: { boolean: {} } },
      { name: "show_pattern", selector: { boolean: {} } },
      { name: "show_baseload", selector: { boolean: {} } }
    ]
  }
];
var labelFor = (name) => t(`editor_${name}`);
var EnergyCardEditor = class extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this._form = null;
  }
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    setLanguage(hass?.locale?.language);
    if (this._form) {
      this._form.hass = hass;
      this._form.schema = buildSchema();
    }
  }
  connectedCallback() {
    window.loadCardHelpers?.().catch(() => {
    });
    this._render();
  }
  _render() {
    if (!this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (schema) => labelFor(schema.name);
      this._form.addEventListener("value-changed", (event) => {
        event.stopPropagation();
        const config = { ...event.detail.value };
        for (const [key, value] of Object.entries(config)) {
          if (value === "" || value == null) delete config[key];
        }
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: { type: "custom:energy-card", ...config } },
            bubbles: true,
            composed: true
          })
        );
      });
      this.appendChild(this._form);
    }
    const { type, ...data } = this._config;
    this._form.schema = buildSchema();
    this._form.data = data;
    if (this._hass) this._form.hass = this._hass;
  }
};

// energy-card/energy-card.js
var VERSION = "1.0.0";
if (!customElements.get("energy-card")) {
  customElements.define("energy-card", EnergyCard);
}
if (!customElements.get("energy-card-editor")) {
  customElements.define("energy-card-editor", EnergyCardEditor);
}
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "energy-card")) {
  window.customCards.push({
    type: "energy-card",
    name: "Energy Card",
    description: "Live-Leistung und Verlauf im Look der Tibber-App",
    preview: true,
    documentationURL: "https://github.com/c0ball/energy-dashboard"
  });
}
console.info(
  `%c ENERGY-CARD %c ${VERSION} `,
  "color: #0B0B0C; background: #3ED2AC; font-weight: 700; border-radius: 3px 0 0 3px;",
  "color: #3ED2AC; background: #1B1C1E; border-radius: 0 3px 3px 0;"
);
export {
  EnergyCard,
  EnergyCardEditor,
  VERSION
};
