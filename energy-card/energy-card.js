/**
 * energy-card
 *
 * Der Pulse-Screen der Tibber-App als Lovelace-Karte — mit den Zeiträumen,
 * die die App ohne Stromvertrag nicht hergibt.
 *
 * Installation über HACS oder von Hand — siehe README.
 *
 * Diese Datei ist der Einstiegspunkt für beides: in der Entwicklung lädt der
 * Browser von hier aus die Module unter `src/` einzeln nach, für ein Release
 * bündelt `npm run build` denselben Baum zu `dist/energy-card.js`.
 */

import { EnergyCard } from "./src/card.js";
import { EnergyCardEditor } from "./src/editor.js";

// Muss zum Release-Tag und zu package.json passen — der Release-Lauf prüft das
const VERSION = "1.2.0";

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
    documentationURL: "https://github.com/c0ball/energy-dashboard",
  });
}

console.info(
  `%c ENERGY-CARD %c ${VERSION} `,
  "color: #0B0B0C; background: #3ED2AC; font-weight: 700; border-radius: 3px 0 0 3px;",
  "color: #3ED2AC; background: #1B1C1E; border-radius: 0 3px 3px 0;"
);

export { EnergyCard, EnergyCardEditor, VERSION };
