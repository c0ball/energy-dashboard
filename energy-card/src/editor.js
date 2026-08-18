/**
 * Visueller Karteneditor.
 *
 * Baut auf `ha-form` auf: die Selektoren bringen ihre eigenen Bedienelemente
 * mit, damit hier weder Entity-Picker noch Übersetzungen nachgebaut werden
 * müssen.
 */

import { RANGES } from "./data.js";
import { LEVELS } from "./periods.js";
import { setLanguage, t } from "./i18n.js";

const buildSchema = () => [
  { name: "title", selector: { text: {} } },
  {
    name: "view",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "live", label: t("view_live") },
          { value: "tabs", label: t("view_tabs") },
          { value: "analysis", label: t("view_analysis") },
        ],
      },
    },
  },
  {
    name: "power_entity",
    selector: { entity: { filter: { domain: "sensor", device_class: "power" } } },
  },
  {
    name: "energy_today_entity",
    selector: { entity: { filter: { domain: "sensor", device_class: "energy" } } },
  },
  {
    name: "ranges",
    selector: {
      select: {
        multiple: true,
        mode: "list",
        options: RANGES.map((range) => ({ value: range.key, label: t(range.labelKey) })),
      },
    },
  },
  {
    name: "default_range",
    selector: {
      select: {
        mode: "dropdown",
        options: RANGES.map((range) => ({ value: range.key, label: t(range.labelKey) })),
      },
    },
  },
  {
    name: "default_level",
    selector: {
      select: {
        mode: "dropdown",
        options: LEVELS.map((level) => ({ value: level, label: t(`level_${level}`) })),
      },
    },
  },
  {
    name: "gauge_max",
    selector: { number: { min: 0, step: 100, mode: "box", unit_of_measurement: "W" } },
  },
  {
    name: "stats_scope",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "range", label: t("scope_range") },
          { value: "today", label: t("scope_today") },
        ],
      },
    },
  },
  {
    name: "cost_entity",
    selector: { entity: { filter: { domain: "sensor", device_class: "monetary" } } },
  },
  {
    name: "price",
    selector: { number: { min: 0, step: 0.001, mode: "box" } },
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
      { name: "show_baseload", selector: { boolean: {} } },
    ],
  },
];

const labelFor = (name) => t(`editor_${name}`);

export class EnergyCardEditor extends HTMLElement {
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
    // Stellt sicher, dass die HA-Formularelemente geladen sind, falls der
    // Editor als erstes Bedienelement der Sitzung geöffnet wird.
    window.loadCardHelpers?.().catch(() => {});
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
        // Leere Felder gehören nicht in die gespeicherte Konfiguration
        for (const [key, value] of Object.entries(config)) {
          if (value === "" || value == null) delete config[key];
        }
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: { type: "custom:energy-card", ...config } },
            bubbles: true,
            composed: true,
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
}
