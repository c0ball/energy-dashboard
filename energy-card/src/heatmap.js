/**
 * Wochen-Heatmap: 7 Wochentage × 24 Stunden.
 *
 * Balken zeigen, *wie viel* verbraucht wurde — dieses Raster zeigt, *wann*.
 * Über mehrere Wochen gemittelt treten Gewohnheiten hervor, die in keiner
 * Summe auftauchen: der Waschtag am Samstagvormittag, das Kochfenster zwischen
 * sechs und acht, die Stunde, in der jeden Werktag jemand duscht. Genau die
 * Muster sind das, was sich ändern lässt.
 */

import { colorForValue } from "./theme.js";
import { el, syncNodes } from "./svg.js";

const PAD = { top: 18, right: 10, bottom: 20, left: 30 };

export class Heatmap {
  constructor(options = {}) {
    this.options = options;
    this.cells = []; // 7 × 24, Index = tag * 24 + stunde
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
      x: PAD.left,
      y: PAD.top,
      width: Math.max(0, this.width - PAD.left - PAD.right),
      height: Math.max(0, this.height - PAD.top - PAD.bottom),
    };
  }

  /** Zeile und Spalte an einer Pixelposition, oder -1. */
  indexAt(px, py) {
    const { x, y, width, height } = this.plot;
    if (px < x || px > x + width || py < y || py > y + height) return -1;
    const hour = Math.min(23, Math.floor(((px - x) / width) * 24));
    const row = Math.min(6, Math.floor(((py - y) / height) * 7));
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
            { value: scale, color: loud },
          ]) : "var(--ec-band)",
          // Die Helligkeit trägt die Menge, der Farbton die Intensität —
          // zusammen bleibt auch ein schwacher Wert vom leeren Feld
          // unterscheidbar.
          opacity: known ? (0.18 + 0.82 * Math.min(1, value / scale)).toFixed(3) : "0.05",
          selected: index === this.selection,
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
        middle: true,
      });
    }

    // Nicht alle 24 Stunden beschriften — auf einem Handy wäre das ein Brei
    const every = cellW < 22 ? 6 : 3;
    for (let hour = 0; hour < 24; hour += every) {
      labels.push({
        x: x + hour * cellW + cellW / 2,
        y: y + height + 14,
        text: String(hour),
        anchor: "middle",
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
}

/**
 * Fasst Stundenwerte zu 7 × 24 Feldern zusammen.
 *
 * Gemittelt wird über die Vorkommen, nicht summiert: bei vier Wochen Datenlage
 * käme sonst ein Wochentag, der fünfmal vorkam, automatisch höher heraus als
 * einer mit vier Vorkommen — ein Artefakt des Zeitfensters, kein Verhalten.
 */
export function foldToWeek(buckets, firstWeekday = 1) {
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
