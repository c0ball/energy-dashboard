/**
 * energy-card — der Pulse-Screen der Tibber-App als Lovelace-Karte.
 *
 * Bewusst ohne Lit: Home Assistant exportiert seine Lit-Instanz nicht
 * öffentlich, und beim Scrubben wollen wir ohnehin gezielt einzelne
 * SVG-Attribute anfassen statt einen Rendering-Zyklus anzuwerfen.
 */

import { CARD_STYLES } from "./styles.js";
import { Chart } from "./chart.js";
import { AnalysisView } from "./analysis.js";
import { attachInteractions } from "./interactions.js";
import { resolveEntities } from "./discovery.js";
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_THRESHOLDS_LIGHT,
  colorForValue,
  isLightColor,
  normalizeThresholds,
} from "./theme.js";
import { formatEnergy, formatMoment, formatMoney, formatWatt, setLocale } from "./format.js";
import { fetchBucketCosts, fetchCostForPeriod, resolveCostSource } from "./cost.js";
import { bucketStarts, completedBuckets, periodRange } from "./periods.js";
import { setLanguage, t } from "./i18n.js";
import {
  computeWindowStats,
  DEFAULT_RANGE_KEYS,
  DEFAULT_START_RANGE,
  ENERGY_STATS_MIN_MS,
  entityUnit,
  fetchBuckets,
  fetchEnergyForPeriod,
  fetchEnergyToday,
  fetchSeries,
  fetchTodayExtremes,
  pickResolution,
  powerFactor,
  RANGES,
  rangeByKey,
  sortRangeKeys,
  subscribeHistory,
} from "./data.js";

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const STATS_REFRESH_MS = 5 * 60_000;

const BREAKPOINTS = { narrow: 380, wide: 680, xwide: 1000 };

const WINDOW_STATS_THROTTLE_MS = 10_000;

const ICONS = {
  flash: "M11,15H6L13,1V9H18L11,23V15Z",
  up: "M16,6L18.29,8.29L13.41,13.17L9.41,9.17L2,16.59L3.41,18L9.41,12L13.41,16L19.71,9.71L22,12V6H16Z",
  down: "M16,18L18.29,15.71L13.41,10.83L9.41,14.83L2,7.41L3.41,6L9.41,12L13.41,8L19.71,14.29L22,12V18H16Z",
};

const icon = (path) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;

function fireEvent(node, type, detail) {
  node.dispatchEvent(
    new CustomEvent(type, { detail, bubbles: true, composed: true })
  );
}

export class EnergyCard extends HTMLElement {
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
    this._costSource = undefined; // undefined = noch nicht gesucht
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
      ...(power ? { power_entity: power } : {}),
      ...(energy ? { energy_today_entity: energy } : {}),
    };
  }

  setConfig(config) {
    // Immer aufsteigend sortiert: wer 6h und 12h nachträglich anhängt, soll
    // sie zwischen 1 Std und 24 Std finden und nicht am Ende der Leiste.
    const ranges = Array.isArray(config.ranges) && config.ranges.length
      ? sortRangeKeys(config.ranges.filter((key) => RANGES.some((r) => r.key === key)))
      : DEFAULT_RANGE_KEYS;

    if (!ranges.length) {
      throw new Error("`ranges` enthält keinen gültigen Zeitraum");
    }

    const hasCustomThresholds =
      Array.isArray(config.thresholds) && config.thresholds.length > 0;

    // „auto" war die frühere Voreinstellung: bis 24 Std der Tag, darüber der
    // Zeitraum. Seit die Kacheln durchgehend dem Zeitraum folgen und der Tag
    // eine eigene Reihe bekommen kann, hat die Unterscheidung keinen Zweck
    // mehr — bestehende Konfigurationen laufen ohne Änderung weiter.
    const scope = config.stats_scope === "today" ? "today" : "range";
    const view = ["live", "analysis", "tabs"].includes(config.view) ? config.view : "live";

    // Womit die Live-Ansicht aufmacht. Muss unter den sichtbaren Pillen sein —
    // ein Zeitraum, den man nicht wieder anwählen könnte, wäre eine Sackgasse.
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
      hasCustomThresholds,
    };

    // `tabs` startet auf dem Live-Screen; die festen Varianten haben keine Wahl
    this._view = view === "analysis" ? "analysis" : "live";
    // Die Vorgabe greift beim Aufbau, wenn der bisherige Zeitraum aus der
    // Leiste verschwunden ist — und wenn die Vorgabe selbst geändert wurde,
    // damit man ihre Wirkung im Karteneditor sofort sieht. Sonst bleibt die
    // Karte stehen, wo sie steht: eine Konfigurationsänderung soll niemanden
    // aus dem Zeitraum werfen, den er gerade betrachtet.
    if (!this._built || !ranges.includes(this._rangeKey) || defaultRange !== previousDefault) {
      this._rangeKey = defaultRange;
    }
    this._entities = { power: null, energy: null };
    this._window = null;
    // `price` und `cost_entity` können sich geändert haben — neu auflösen
    this._costPromise = null;
    this._costSource = undefined;

    if (this._built) {
      this._analysis?.setConfig(this._config);
      this._renderStatic();
      this._resolveEntities();
      // Der Rumpf wurde neu gezeichnet und trägt wieder Platzhalter. Die
      // Kopfzeile hängt sonst an `last_updated` fest und bliebe auf „–"
      // stehen, bis der Sensor das nächste Mal meldet.
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

    // Sprache oder Thema gewechselt? Dann die statischen Texte neu setzen.
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
    // Erst am DOM hängend liefert getComputedStyle die geerbten HA-Variablen —
    // vorher landet die Erkennung beim Systemvorgabe-Fallback.
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
            <div class="value">–<span class="unit">W</span></div>
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
    // Die Kacheln kommen ohne Beschriftung aus dem Markup — welcher Text dort
    // steht, hängt vom Bezug ab und wird deshalb an einer Stelle gesetzt.
    this._renderStats();

    if (this._chart) {
      this._chartWrap.appendChild(this._chart.svg);
      this._bindChartSurface();
    }
  }

  _tabsMarkup() {
    if (this._config.view !== "tabs") return "";
    const tab = (key, label) =>
      `<button type="button" data-view="${key}" class="${this._view === key ? "active" : ""}">${label}</button>`;
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

    const today = this._config.show_today_tiles
      ? `<div class="stats stats-today" data-row="today">${tiles}</div>`
      : "";

    const cost = this._config.show_cost_tiles
      ? `<div class="stats stats-today" data-row="cost">
           ${this._tileMarkup("cost", ICONS.flash)}
           ${this._tileMarkup("cost_today", ICONS.flash)}
           ${this._tileMarkup("cost_month", ICONS.up)}
         </div>`
      : "";

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
        onReset: () => this._applyRange(this._rangeKey),
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
        <div class="tile-value">–</div>
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
        const entityId =
          key === "used" ? this._entities.energy || this._entities.power : this._entities.power;
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
    const inherited = getComputedStyle(this)
      .getPropertyValue("--primary-text-color")
      .trim();
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

    // Auf breiten Karten darf das Chart höher werden, sonst wird es zum
    // gequetschten Band über die halbe Bildschirmbreite.
    const wide = cardWidth >= BREAKPOINTS.wide;
    const ratio = wide ? 0.34 : 0.52;
    const cap = wide ? 380 : 300;
    const desired = Math.round(Math.max(190, Math.min(cap, width * ratio)));

    // Die aus der Breite abgeleitete Höhe ist nur die Flex-Grundlage. Bekommt
    // die Karte mehr Platz als sie braucht — in der Panel-Ansicht füllt sie die
    // ganze Bildschirmhöhe —, wächst das Chart in den Rest hinein, statt
    // darunter Leerraum stehen zu lassen.
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
    const changed =
      resolved.power !== this._entities.power || resolved.energy !== this._entities.energy;
    this._entities = resolved;

    if (!resolved.power) {
      this._showError(t("no_power_entity"));
    } else if (changed) {
      this._clearError();
      this._chart?.setThresholds(this._activeThresholds());
    }

    if (changed) {
      // Ein anderer Energiesensor kann eine andere Preisquelle bedeuten
      this._costPromise = null;
      this._costSource = undefined;
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
    this._chart.setWindow(startMs, endMs, { liveEnd: endMs >= Date.now() - 60_000 });
    this._chart.render();
    this._updateLiveIndicator();

    if (!settled) return;

    // Die Kacheln zeigen nun den Ausschnitt — nachziehen, sobald die Geste steht
    this._updateWindowStats({ force: true });

    const current = this._series.resolution;
    const next = pickResolution(endMs - startMs);
    const outOfRange =
      !this._series.points.length ||
      startMs < this._series.points[0].t - 1000 ||
      endMs > this._series.points.at(-1).t + 60_000;

    if (!current || current.source !== next.source || current.period !== next.period || outOfRange) {
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
    // Ein verborgener Reiter braucht keine frischen Daten
    if (this._view !== "live") return;

    const token = ++this._loadToken;
    this._setLoading(true);
    this._teardownLive();

    // Etwas mehr laden als sichtbar ist, damit Pannen nicht sofort nachladen
    // muss. Über die Auflösung entscheidet trotzdem das sichtbare Fenster.
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
    const showBand =
      this._config.show_minmax_band !== false &&
      this._series.resolution?.source === "statistics";

    this._chart.setSeries(this._series.points, { showBand });
    this._chart.setWindow(this._window.startMs, this._window.endMs, {
      liveEnd: this._followLive || this._window.endMs >= Date.now() - 60_000,
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
        /* Verbindung war bereits fort */
      }
    } else if (unsubscribe && typeof unsubscribe.then === "function") {
      unsubscribe.then((fn) => fn?.()).catch(() => {});
    }
  }

  /** Neue Live-Punkte einsortieren und den Verlauf vorne beschneiden. */
  _mergePoints(incoming) {
    const points = this._series.points;
    const last = points.length ? points.at(-1).t : -Infinity;
    const fresh = incoming.filter((p) => p.t > last);
    if (!fresh.length) return;

    points.push(...fresh);

    const keepFrom = Date.now() - 6 * 3_600_000;
    if (points.length > 4000 && points[0].t < keepFrom) {
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
      fetchEnergyToday(hass, entityId, this._entities.energy).catch(() => null),
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
      starts,
    });
    if (token !== this._costToken) return;

    const costs = await fetchBucketCosts(this._hass, source, {
      buckets,
      startMs: range.startMs,
      endMs: range.endMs,
      period: range.period,
    });
    if (token !== this._costToken || !costs) return;

    const done = completedBuckets(starts, range.endMs);
    const finishedCosts = costs.slice(0, done).filter((v) => Number.isFinite(v));
    const finishedKwh = buckets
      .slice(0, done)
      .map((b) => b.kwh)
      .filter((v) => Number.isFinite(v));

    const project = (list) =>
      list.length >= 2
        ? (list.reduce((sum, v) => sum + v, 0) / list.length) * starts.length
        : null;

    this._costStats = {
      ...this._costStats,
      today: Number.isFinite(costs[done]) ? costs[done] : null,
      month: project(finishedCosts),
      monthKwh: project(finishedKwh),
    };
    this._renderStats();
    // Jetzt steht der Durchschnittspreis des Tages — damit lässt sich auch für
    // kurze Fenster ein Betrag angeben, für die die Blockstatistik zu grob ist.
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
      effectivePrice: this._effectivePrice(),
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
      const windowMs = this._window ? this._window.endMs - this._window.startMs : 3_600_000;
      this._label.textContent = formatMoment(this._scrubPoint.t, windowMs);
      this._setValue(this._scrubPoint.v);
      return;
    }

    this._label.textContent = t("right_now");
    const current = this._currentPower();
    if (current == null) {
      this._value.innerHTML = `–<span class="unit">W</span>`;
      return;
    }
    this._setValue(current);
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

    const current = this._currentPower() ?? 0;
    const typical = this._dayStats.typical;
    const candidates = [typical, current].filter((v) => Number.isFinite(v) && v > 0);
    return candidates.length ? Math.max(...candidates) : 1000;
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
    // Der Live-Punkt trägt dieselbe Farbe wie der aktuelle Messwert
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
    // Kurze Fenster verlieren durch die Blockgrenzen der Statistik mehr, als
    // sie an Zählergenauigkeit gewinnen — die Integration steht schon in der
    // Kachel und bleibt dort.
    if (endMs - startMs < ENERGY_STATS_MIN_MS) return;

    const token = ++this._energyToken;
    const value = await fetchEnergyForPeriod(this._hass, energyEntity, startMs, endMs);

    if (token !== this._energyToken || value == null) return;
    this._windowStats = { ...this._windowStats, energy: value };
    this._renderStats();
    // Bei festem Preis hängen die Kosten am Verbrauch — der ist jetzt genauer
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
    const vars = scope === "range" ? { span: t(rangeByKey(this._rangeKey).labelKey) } : undefined;
    const currency = this._costSource?.currency;

    const money = (value) => {
      if (!Number.isFinite(value)) return "–";
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

    const projectedKwh = Number.isFinite(stats.monthKwh)
      ? `≈ ${formatEnergy(stats.monthKwh).value} ${formatEnergy(stats.monthKwh).unit}`
      : "";
    set("cost_month", t("cost_month"), money(stats.month), projectedKwh);
  }

  /** Füllt eine Kachelreihe mit den Zahlen ihres Bezugs. */
  _renderStatRow(row, scope) {
    const container = this._card.querySelector(`.stats[data-row="${row}"]`);
    if (!container) return;

    const vars = scope === "range" ? { span: t(rangeByKey(this._rangeKey).labelKey) } : undefined;

    const { max, min, energy } =
      scope === "today"
        ? { ...this._dayStats, energy: this._dayStats.energyToday }
        : this._windowStats;

    // Bei Tagesbezug genügt die Uhrzeit; über mehrere Tage hinweg braucht es
    // das Datum dazu, sonst ist „18:20" nicht zuzuordnen.
    const stampSpan =
      scope === "today" || !this._window ? 0 : this._window.endMs - this._window.startMs;

    const set = (key, value, sub) => {
      const tile = container.querySelector(`.tile[data-tile="${key}"]`);
      if (!tile) return;
      tile.querySelector(".tile-head span").textContent = t(`${key}_${scope}`, vars);
      tile.querySelector(".tile-value").innerHTML = value;
      tile.querySelector(".tile-sub").textContent = sub || "";
    };

    const used = energy == null ? null : formatEnergy(energy);

    set("used", used ? `${used.value}<span class="unit">${used.unit}</span>` : "–", "");
    set(
      "max",
      max ? `${formatWatt(max.value)}<span class="unit">W</span>` : "–",
      max ? formatMoment(max.t, stampSpan) : ""
    );
    set(
      "min",
      min ? `${formatWatt(min.value)}<span class="unit">W</span>` : "–",
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
    let interval = 60_000;
    if (span <= 15 * 60_000) interval = 1000;
    else if (span <= 3 * 3_600_000) interval = 5000;

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
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])
  );
}
