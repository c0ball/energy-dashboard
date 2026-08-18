/**
 * Das Balkenchart der Analyse-Ansicht.
 *
 * Eigenständig neben [chart.js](./chart.js), nicht als dessen Variante: ein
 * Balken ist ein Zeitraum mit einer Summe, ein Kurvenpunkt ein Augenblick mit
 * einem Momentanwert. Fast jede Entscheidung — Achsenteilung, Auswahl,
 * fehlende Werte — fällt deshalb anders aus. Gemeinsam sind nur die
 * SVG-Helfer und die Farbmathematik.
 */

import { buildGradientStops, colorForValue } from "./theme.js";
import { barPath, el, syncNodes } from "./svg.js";
import { yTicks } from "./scale.js";

const PAD = { top: 26, right: 48, bottom: 24, left: 2 };
const MAX_RADIUS = 5;

let gradientSeq = 0;

export class Bars {
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
    const uid = `teb${++gradientSeq}`;
    this.uid = uid;

    const svg = el("svg", { class: "bars", preserveAspectRatio: "none" });

    const defs = el("defs");
    this.fillGradient = el("linearGradient", {
      id: `${uid}-fill`,
      gradientUnits: "userSpaceOnUse",
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
    const done = this.buckets
      .slice(0, Math.min(this.completed, this.buckets.length))
      .map((b) => b.value)
      .filter((v) => Number.isFinite(v));
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
    return y + height - (Math.max(0, v) / (this.scaleMax || 1)) * height;
  }

  /** Waagerechte Aufteilung: ein Fach je Balken, darin der Balken mit Luft. */
  slot(index) {
    const { x, width } = this.plot;
    const count = Math.max(1, this.buckets.length);
    const pitch = width / count;
    // Auf schmalen Karten mit 31 Balken bleibt sonst mehr Fuge als Balken
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
    const scale = average && average > 0
      ? buildGradientStops(
          [
            { value: 0, color: calm },
            { value: average, color: calm },
            { value: average * 2, color: loud },
          ],
          this.scaleMax
        )
      : [{ offset: 0, color: calm }, { offset: 1, color: calm }];

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
      // Die Nachkommastellen richten sich nach der ganzen Achse, nicht nach dem
      // einzelnen Wert — sonst stünde „0,00" unter „300".
      labels.push({ y: ty, text: format(tick, this.scaleMax), anchor: "end", x: this.width - 6 });
    }

    syncNodes(this.gridGroup, lines, "line", (node, item) => {
      node.setAttribute("x1", x);
      node.setAttribute("x2", x + width + 8);
      node.setAttribute("y1", item.y);
      node.setAttribute("y2", item.y);
    });

    // Nur so viele Beschriftungen, wie ohne Gedränge nebeneinander passen:
    // 31 Tagesnummern in einer Handybreite wären ein grauer Streifen.
    const every = Math.max(1, Math.ceil(this.buckets.length / Math.max(2, Math.floor(width / 34))));
    const xLabels = [];
    this.buckets.forEach((bucket, i) => {
      if (i % every !== 0) return;
      const slot = this.slot(i);
      xLabels.push({
        x: slot.x + slot.width / 2,
        y: this.height - 7,
        text: this.options.tickLabel?.(bucket.t, i) ?? "",
        anchor: "middle",
      });
    });

    syncNodes(
      this.axisGroup,
      [
        { x: this.width - 6, y: y - 13, text: this.options.unit || "", anchor: "end", dim: true },
        ...labels,
        ...xLabels,
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

      // Erst was nach dem laufenden Balken kommt, ist Hochrechnung: das Mittel
      // der abgeschlossenen, blass gezeichnet. Der laufende Balken selbst zählt
      // dazu — er trägt echte Messwerte, nur noch nicht die volle Stunde bzw.
      // den vollen Tag. Ihn zu verstecken hiesse, im Monatsblick zwei Wochen
      // vorhandener Daten zu unterschlagen.
      if (i > this.completed) {
        if (average == null || average <= 0) return;
        const top = this.scaleY(average);
        future.push({ d: barPath(slot.x, top, slot.width, baseline - top, MAX_RADIUS) });
        return;
      }

      if (!Number.isFinite(bucket.value) || bucket.value <= 0) return;
      const top = this.scaleY(bucket.value);
      bars.push({
        d: barPath(slot.x, top, slot.width, baseline - top, MAX_RADIUS),
        selected: i === this.selection,
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
      // Bei einer Auswahl treten die übrigen Balken zurück, statt dass der
      // gewählte aufleuchtet — sonst wirkt jede Berührung wie ein Alarm.
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
    return Math.min(count - 1, Math.floor(((px - x) / width) * count));
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
      { value: average * 2, color: stops[stops.length - 1]?.color || "#F06B1C" },
    ]);
  }
}
