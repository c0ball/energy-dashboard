/**
 * Das SVG-Chart.
 *
 * Bewusst von Hand gezeichnet statt über eine Chart-Bibliothek: der
 * Tibber-Look lebt von einem vertikalen Farbverlauf, der an absolute
 * Wattwerte gekoppelt ist und Linie wie Fläche gemeinsam einfärbt. Das
 * bekommt man mit fremden Bibliotheken nur über Umwege — und beim Scrubben
 * wollen wir ohnehin einzelne Attribute anfassen statt neu zu rendern.
 *
 * Gerechnet wird in Pixelkoordinaten (kein `preserveAspectRatio`-Strecken),
 * damit Strichstärken bei jeder Kartenbreite gleich bleiben.
 */

import { buildGradientStops, colorForValue, withAlpha } from "./theme.js";
import { lowerBound } from "./data.js";
import { el, SVG_NS, syncNodes } from "./svg.js";
import { yTicks } from "./scale.js";

// Oben bleibt Platz für die Einheit über dem höchsten Achsenwert
const PAD = { top: 26, right: 48, bottom: 26, left: 2 };

let gradientSeq = 0;

const pad2 = (n) => String(n).padStart(2, "0");
const clockLabel = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/**
 * Zeitachse: Schrittweite und Beschriftung richten sich nach der Fensterbreite,
 * damit bei 5 Minuten Minuten und bei 30 Tagen Datumsangaben stehen.
 */
export function xTicks(startMs, endMs, maxTicks = 5) {
  const span = endMs - startMs;
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  const candidates = [
    MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
    HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
    DAY, 2 * DAY, 7 * DAY, 14 * DAY,
  ];
  const step = candidates.find((c) => span / c <= maxTicks) ?? candidates.at(-1);

  const format =
    step >= DAY
      ? (date) =>
          span > 20 * DAY
            ? `${date.getDate()}.${date.getMonth() + 1}.`
            : WEEKDAYS[date.getDay()]
      : clockLabel;

  // An lokalen Mitternächten bzw. vollen Einheiten ausrichten
  const first = new Date(startMs);
  if (step >= DAY) first.setHours(0, 0, 0, 0);
  else first.setSeconds(0, 0);
  let t = Math.ceil(first.getTime() / step) * step;
  // Zeitzonenversatz mitnehmen, damit „12:00" auch wirklich 12:00 ist
  const offset = new Date(t).getTimezoneOffset() * MINUTE;
  t = Math.ceil((startMs - offset) / step) * step + offset;

  const ticks = [];
  for (; t <= endMs; t += step) {
    if (t >= startMs) ticks.push({ t, label: format(new Date(t)) });
  }
  return ticks;
}

/* ------------------------------------------------------------------ *
 * Chart
 * ------------------------------------------------------------------ */

export class Chart {
  constructor(options = {}) {
    this.options = options;
    this.points = [];
    this.startMs = Date.now() - 3_600_000;
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
      preserveAspectRatio: "none",
    });

    const defs = el("defs");

    this.strokeGradient = el("linearGradient", {
      id: `${uid}-stroke`,
      gradientUnits: "userSpaceOnUse",
    });
    this.fillGradient = el("linearGradient", {
      id: `${uid}-fill`,
      gradientUnits: "userSpaceOnUse",
    });
    this.bandGradient = el("linearGradient", {
      id: `${uid}-band`,
      gradientUnits: "userSpaceOnUse",
    });

    const glow = el("filter", {
      id: `${uid}-glow`,
      x: "-120%",
      y: "-120%",
      width: "340%",
      height: "340%",
    });
    glow.appendChild(el("feGaussianBlur", { stdDeviation: "4", result: "blur" }));
    const merge = el("feMerge");
    merge.appendChild(el("feMergeNode", { in: "blur" }));
    merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
    glow.appendChild(merge);

    // Beschneidet Fläche und Linie beim Pannen sauber am Plotrand
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
      stroke: "none",
    });
    this.areaPath = el("path", {
      class: "area",
      fill: `url(#${uid}-fill)`,
      stroke: "none",
    });
    this.linePath = el("path", {
      class: "line",
      fill: "none",
      stroke: `url(#${uid}-stroke)`,
      "stroke-width": "2.4",
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    });
    this.plotGroup.append(this.bandPath, this.areaPath, this.linePath);

    // Ruhender Hof, darüber ein auslaufender Puls, darauf der Kern: so bleibt
    // das Kurvenende auch zwischen zwei Pulsschlägen deutlich sichtbar.
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
      height: Math.max(0, this.height - PAD.top - PAD.bottom),
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

  scaleX(t) {
    const { x, width } = this.plot;
    const span = this.endMs - this.startMs || 1;
    return x + ((t - this.startMs) / span) * width;
  }

  scaleY(v) {
    const { y, height } = this.plot;
    const max = this.scaleMax || 1;
    return y + height - (Math.max(0, v) / max) * height;
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

    // Auf breiten Karten wächst alles andere mit — Linie und Endpunkt würden
    // sonst auf einem Desktop-Dashboard zu Fadenkreuzen verkümmern.
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
      gradient.setAttribute("y1", y + height); // unten = 0 W
      gradient.setAttribute("y2", y); // oben = scaleMax
      gradient.textContent = "";
      for (const stop of stops) {
        gradient.appendChild(
          el("stop", {
            offset: stop.offset,
            "stop-color": stop.color,
            "stop-opacity": alphaFor(stop.offset),
          })
        );
      }
    };

    apply(this.strokeGradient, () => 1);
    // Die Fläche wird nach oben hin kräftiger — wie in der Vorlage, wo der
    // orange Bereich deutlicher steht als der ruhige grüne Sockel.
    apply(this.fillGradient, (offset) => 0.22 + offset * 0.18);

    // Das Min/Max-Band bleibt bewusst farblos: mit der Watt-Färbung überlagern
    // sich bei Stundenwerten dutzende schmale Spitzen zu einem grauen Brei und
    // nehmen der eigentlichen Kurve die Aussage.
    //
    // Nach oben blendet es aus, weil die Achse nur der Kurve folgt und das Band
    // über den Plotrand hinausragt. Am schwächsten ist es dort, wo es
    // beschnitten wird — so wirkt die Clip-Kante wie ein Auslaufen statt wie
    // ein Abriss. Jenseits des letzten Stops setzt SVG dessen Farbe fort
    // (`pad`), der Bereich oberhalb der Achse erbt die geringe Deckkraft also
    // von selbst.
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

    // So viele Zeitmarken, wie ohne Gedränge nebeneinander passen — nach oben
    // gedeckelt, sonst reiht ein Desktop-Dashboard zwölf Uhrzeiten aneinander.
    const maxTicks = Math.max(3, Math.min(8, Math.round(width / 58)));
    const xLabels = xTicks(this.startMs, this.endMs, maxTicks).map((tick) => ({
      x: this.scaleX(tick.t),
      y: this.height - 8,
      text: tick.label,
      anchor: "middle",
    }));

    // Einheit über dem obersten Wert, wie in der App
    const axisItems = [
      { x: this.width - 6, y: y - 13, text: this.options.unit || "W", anchor: "end", dim: true },
      ...labels,
      // Randnahe Zeitmarken bleiben stehen — in der Vorlage steht die erste
      // Uhrzeit ganz links am Kartenrand —, rutschen dort aber auf links- bzw.
      // rechtsbündig, damit sie nicht aus der Karte laufen
      ...xLabels
        .filter((l) => l.x >= x - 14 && l.x <= x + width + 14)
        .map((l) => {
          if (l.x < x + 24) return { ...l, x: x, anchor: "start" };
          if (l.x > x + width - 24) return { ...l, x: x + width, anchor: "end" };
          return l;
        }),
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

    // Bewusst reine Liniensegmente: die Vorlage zeigt scharfe Kanten und
    // Spitzen, jede Glättung würde ein Einschaltmoment verschlucken.
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
    const t = this.startMs + ((clamped - x) / width) * span;

    const i = lowerBound(points, t);
    if (i <= 0) return 0;
    if (i >= points.length) return points.length - 1;
    return Math.abs(points[i].t - t) < Math.abs(points[i - 1].t - t) ? i : i - 1;
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
}

/* ------------------------------------------------------------------ *
 * Kleinkram
 * ------------------------------------------------------------------ */

function formatTick(value) {
  // Erst ab fünfstelligen Werten abkürzen — die Vorlage schreibt „750" aus
  if (value >= 10000) {
    const kilo = value / 1000;
    return `${kilo % 1 === 0 ? kilo : kilo.toFixed(1)}k`;
  }
  return String(Math.round(value));
}
