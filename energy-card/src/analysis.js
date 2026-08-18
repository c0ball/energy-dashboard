/**
 * Die Analyse-Ansicht: Verbrauch als Balken, blätterbar über Tage, Wochen,
 * Monate und Jahre.
 *
 * Sie beantwortet eine andere Frage als der Live-Screen. Dort geht es um „was
 * läuft gerade", hier um „wohin entwickelt sich das". Deshalb steht nicht der
 * Momentanwert oben, sondern die Summe des Zeitraums — und daneben, ob sie
 * gegenüber dem Zeitraum davor gestiegen oder gefallen ist. Eine Zahl ohne
 * Bezug sagt wenig; erst der Vergleich macht sie zu einer Aussage.
 */

import { Bars } from "./bars.js";
import { attachBarInteractions } from "./interactions.js";
import { fetchBaseload, fetchBuckets } from "./data.js";
import { currentPrice, fetchBucketCosts, resolveCostSource } from "./cost.js";
import {
  formatEnergy,
  formatKwh,
  formatMoney,
  formatMoneyPlain,
  formatWatt,
  getLocale,
} from "./format.js";
import { t } from "./i18n.js";
import { Heatmap, foldToWeek } from "./heatmap.js";
import {
  DEFAULT_LEVEL,
  LEVELS,
  bucketLabel,
  bucketStarts,
  bucketTick,
  completedBuckets,
  firstWeekdayIndex,
  isCurrentPeriod,
  patternRange,
  periodLabel,
  periodRange,
  shiftPeriod,
} from "./periods.js";

const CURRENT_LABEL = {
  day: "today",
  week: "this_week",
  month: "this_month",
  year: "this_year",
};

const AVERAGE_LABEL = {
  day: "average_per_hour",
  week: "average_per_day",
  month: "average_per_day",
  year: "average_per_month",
};

export class AnalysisView {
  constructor() {
    this.el = document.createElement("div");
    this.el.className = "analysis";

    this._hass = null;
    this._config = {};
    this._entities = { power: null, energy: null };
    this._level = DEFAULT_LEVEL;
    this._defaultLevel = undefined;
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
    this._costSource = undefined; // undefined = noch nicht gesucht
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
          <div class="summary-value">–</div>
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
      tickLabel: (ms) => bucketTick(this._level, ms),
    });
    this._wrap.appendChild(this._bars.svg);

    this._patternEl = this.el.querySelector(".pattern");
    this._heatWrap = this.el.querySelector(".heatmap-wrap");

    this._heatmap = new Heatmap({
      dayLabel: (weekday) => {
        // 4.1.2026 war ein Sonntag — als Aufhänger für die Wochentagsnamen
        const date = new Date(2026, 0, 4 + weekday);
        return new Intl.DateTimeFormat(getLocale(), { weekday: "short" }).format(date);
      },
    });
    this._heatWrap.appendChild(this._heatmap.svg);

    this._renderLevels();
    this._bindSurface();
  }

  _renderLevels() {
    // Das Muster ist keine eigene Ebene mehr: es steht dauerhaft unter den
    // Balken. Es beantwortet eine andere Frage („wann") als die Ebenen („wie
    // viel") — beides nebeneinander zu sehen, ist der eigentliche Gewinn.
    const levels = this._config.analysis_levels?.length
      ? LEVELS.filter((l) => this._config.analysis_levels.includes(l))
      : LEVELS;

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
      onPage: (delta) => this._page(delta),
    });

    // Das Raster hat seine eigene Auswahl: dort zählt auch die senkrechte
    // Position, die Balkenlogik kennt nur die waagerechte.
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
    this._defaultLevel = LEVELS.includes(this._config.default_level)
      ? this._config.default_level
      : DEFAULT_LEVEL;

    // Wie beim Zeitraum der Live-Ansicht: die Vorgabe greift beim Aufbau und
    // wenn sie selbst geändert wurde. Wer gerade im Juli blättert, soll durch
    // eine unbeteiligte Einstellung nicht in den laufenden Monat zurückspringen.
    if (previousDefault === undefined || this._defaultLevel !== previousDefault) {
      this._level = this._defaultLevel;
      this._anchor = Date.now();
    }

    this._costPromise = null;
    this._costSource = undefined;
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

    // Das Raster bekommt eine eigene Höhe aus seiner Breite: 7 × 24 Felder
    // sollen quadratisch bleiben, sonst werden aus Stunden Streifen.
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
    // Beim Wechsel der Ebene zurück in die Gegenwart: von „März 2025" in die
    // Wochenansicht zu springen und dort in der Vergangenheit zu landen wäre
    // schwer nachzuvollziehen.
    this._anchor = Date.now();
    this._renderLevels();
    this._load();
  }

  _page(delta) {
    const options = { firstWeekday: firstWeekdayIndex(this._hass) };
    const next = shiftPeriod(this._level, this._anchor, delta, options);
    // Nicht in die Zukunft blättern — dort gibt es nichts zu sehen
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

    // Das Muster hängt nicht am gewählten Zeitraum — es läuft nebenher und
    // wird beim Blättern nicht neu geholt.
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
      starts,
    };

    try {
      const current = await fetchBuckets(hass, {
        ...args,
        startMs: range.startMs,
        endMs: range.endMs,
      });
      if (token !== this._token) return;

      this._buckets = current.buckets.map((b) => ({ t: b.t, kwh: b.kwh, cost: null }));
      this._completed = isCurrentPeriod(range.startMs, range.endMs)
        ? completedBuckets(starts, range.endMs)
        : starts.length;

      this._applyToChart();
      this._renderSummary();

      // Kosten und Vorperiode kommen nach: die Balken sollen stehen, sobald
      // der Verbrauch da ist, statt auf zwei weitere Abfragen zu warten.
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
    if (this._patternAt && Date.now() - this._patternAt < 30 * 60_000) return;

    this._patternLoading = true;
    const weeks = Number(this._config.pattern_weeks) || 4;
    const firstWeekday = firstWeekdayIndex(this._hass);
    const range = patternRange(weeks, firstWeekday);

    this._patternEl.querySelector(".pattern-sub").textContent = t("pattern_weeks", { weeks });

    try {
      const starts = [];
      for (let t = range.startMs; t < range.endMs; t += 3_600_000) starts.push(t);

      const { buckets } = await fetchBuckets(this._hass, {
        energyEntityId: this._entities.energy,
        powerEntityId: this._entities.power,
        startMs: range.startMs,
        endMs: range.endMs,
        period: "hour",
        starts,
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
      valueEl.textContent = value === null ? "" : "–";
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
        kwh: `${kwh.value} ${kwh.unit}`,
      }),
    ];

    const source = await this._ensureCostSource();
    const price = source
      ? ((await currentPrice(this._hass, source)) ?? this._derivedPrice())
      : null;
    if (Number.isFinite(price)) {
      parts.push(
        t("baseload_month", {
          value: formatMoneyPlain(result.kwhPerDay * 30 * price, source.currency),
        })
      );
    }

    this._baseloadEl.querySelector(".baseload-label").textContent = t("baseload");
    this._baseloadEl.querySelector(".baseload-value").textContent = parts.join(" · ");
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
    // Der zuletzt bekannte Preis bleibt gültig: die Musteransicht lädt keine
    // Kosten, soll die Grundlast aber trotzdem in Euro nennen können.
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
      period: range.period,
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
      // Ohne Preisquelle gibt es nichts umzuschalten — und ein leerer Schalter
      // wäre ein Versprechen, das die Karte nicht halten kann.
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
    this._bars.options.unit =
      mode === "cost" ? formatMoney(0, this._costSource?.currency).unit : "kWh";
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
      starts,
    });
    if (token !== this._token) return;

    const values = result.buckets.map((b) => ({ t: b.t, kwh: b.kwh, cost: null }));
    // Der Vergleich verschwindet, wenn die Vorperiode nichts hergibt — ein
    // „−100 %" wäre schlicht gelogen, wenn dort nur noch keine Daten liegen.
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
      period: range.period,
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
    // Ohne Präposition ergäbe „9 % mehr als Juli 2026" kein sauberes Deutsch —
    // die Fügung gehört deshalb in die Übersetzung, nicht in den Code.
    return t(`compare_at_${range.level}`, {
      label: periodLabel(range.level, range.startMs, range.endMs),
    });
  }

  _applyToChart() {
    const project = (list) =>
      list?.map((b) => ({ t: b.t, value: this._valueOf(b) })) ?? null;

    this._bars.setData(project(this._buckets), {
      compare: this._config.compare === false ? null : project(this._compare),
      level: this._level,
      completed: this._completed,
    });
    this._bars.render();

    // Die Leermeldung hängt am Verbrauch, nicht am gewählten Modus: fehlende
    // Kosten bei vorhandenem Verbrauch sind kein leerer Zeitraum, sondern eine
    // fehlende Preisquelle.
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
      ...(this._level === "year" ? { day: undefined } : {}),
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

    const current = isCurrentPeriod(startMs, endMs);
    this._subEl.textContent = current ? t(CURRENT_LABEL[level]) : "";
    this._subEl.classList.toggle("visible", current);
    this._toCurrent.classList.toggle("visible", !current);
    this._next.disabled = current;
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
    // Ist ein Balken gewählt, tritt die Periodensumme zurück und der Balken
    // spricht — dieselbe Umschaltung wie beim Scrubben in der Live-Ansicht.
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

    const text =
      this._mode === "cost"
        ? `${formatEnergy(other).value} ${formatEnergy(other).unit}`
        : formatMoneyPlain(other, this._costSource?.currency);
    return `${label} · ${text}`;
  }

  _setValue(value) {
    if (!Number.isFinite(value)) {
      this._valueEl.innerHTML = "–";
      return;
    }
    const { value: number, unit, prefix } = this._format(value);
    // Steht das Zeichen vorn („€29.34"), muss der Abstand auf die andere Seite
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
    const done = this._buckets
      .slice(0, counted)
      .map((b) => this._valueOf(b))
      .filter((v) => Number.isFinite(v));
    if (!done.length) return "";

    const mean = done.reduce((sum, v) => sum + v, 0) / done.length;
    const parts = [t(AVERAGE_LABEL[this._level], { value: this._formatPlain(mean) })];

    // Hochrechnung nur, solange die Periode läuft und genug davon vorbei ist —
    // aus zwei Stunden auf einen Monat zu schliessen wäre Kaffeesatz.
    if (counted < this._buckets.length && done.length >= 2) {
      parts.push(t("projection", { value: this._formatPlain(mean * this._buckets.length) }));
    }

    return parts.join(" · ");
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
}
