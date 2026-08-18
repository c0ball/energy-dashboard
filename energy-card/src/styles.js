import {
  DEFAULT_THRESHOLDS,
  DEFAULT_THRESHOLDS_LIGHT,
  LIGHT_TOKENS,
  TOKENS,
} from "./theme.js";

/**
 * Breitenstufen werden über Klassen an `.card` gesteuert, nicht über
 * Media-Queries: in Home Assistant sitzt die Karte in einer Spalte, deren
 * Breite mit dem Fenster wenig zu tun hat. Ein ResizeObserver in card.js
 * setzt `is-narrow` / `is-wide` / `is-xwide`.
 *
 * Das helle Thema hängt an `.card.light` — welches Thema gilt, misst die
 * Karte an der vom Dashboard geerbten Textfarbe.
 */
export const CARD_STYLES = `
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

    /* Spaltenaufbau, damit das Chart überschüssige Höhe aufnehmen kann.
       height statt min-height: nur mit fester Höhe entsteht in der
       Panel-Ansicht auch Schrumpfdruck, sodass das Chart bei knapper Höhe
       kleiner wird, statt die Karte unten hinauslaufen zu lassen. Wo der
       Behälter keine Höhe vorgibt, löst der Prozentwert ohnehin zu auto auf. */
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
  }

  /* Alles ausser dem Chart behält seine natürliche Höhe */
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
  /* Der Ring läuft aus dem Punkt heraus, statt den Punkt selbst zu skalieren —
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

  /* Endpunkt der Kurve atmet im Takt mit. Nur der Pulsring wird animiert —
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
    /* Grundhöhe kommt aus der Breite (in card.js gesetzt); bleibt darüber
       hinaus Platz, wächst das Chart hinein statt Leerraum zu lassen. */
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
     mit der Fläche, über der er sitzt. */
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

  /* Der Abstand nach unten ist bewusst grosszügig: die Reiterleiste ist eine
     Navigationsebene, der Kopf darunter der Inhalt. Kleben beide aneinander,
     liest sich „Jetzt gerade" wie eine Unterzeile des Reiters. */
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

  /* Die inaktive Ansicht bleibt im DOM: Zurückschalten ist dann sofort da,
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
  /* Mehr verbraucht ist nicht „schlecht", aber es soll auffallen — deshalb
     die Signalfarbe der Kurve statt eines eigenen Rot-Grün-Paars. */
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
  /* Vorperiode und Hochrechnung sind beide „nicht jetzt gemessen" und teilen
     sich deshalb die zurückgenommene Darstellung. */
  svg.bars .ghost { fill: var(--ec-band); opacity: 0.11; }
  svg.bars .bar-future { opacity: 0.22; }
  /* Das Wochenmuster steht dauerhaft unter den Balken: es beantwortet „wann"
     statt „wie viel", und beides nebeneinander zu sehen ist der eigentliche
     Gewinn. Deshalb ein ruhiger Trenner statt einer zweiten Überschrift. */
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

  /* Die Grundlast steht ruhig unter dem Chart — sie ändert sich kaum und soll
     nicht mit den Zahlen des gewählten Zeitraums konkurrieren. */
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

  /* Die Spaltenbreite richtet sich nach der längsten Überschrift, und die ist
     im Deutschen „Verbrauch Ausschnitt" — bei 150px wurde das Symbol aus der
     Kachel gedrängt. Englisch käme mit deutlich weniger aus; eine Breite je
     Sprache wäre aber nur schwer nachvollziehbar. */
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

  /* Ab Tablet-Breite passen alle drei Kacheln nebeneinander — dann kein
     Wischen mehr, sondern gleichmässig verteilt. */
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
     der Kachel heraus, statt selbst zu kürzen — unabhängig von der Sprache. */
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

  /* Die Tagesreihe ist eine Ergänzung, keine gleichrangige Zeile: etwas
     flacher und mit kleinerem Wert, damit der Blick beim Zeitraum bleibt.
     Die Regeln stehen bewusst nach den .is-wide-Blöcken — gleiche
     Spezifität, also entscheidet die Reihenfolge. */
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
