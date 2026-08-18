/**
 * Gemeinsame SVG-Helfer.
 *
 * Linienchart und Balkenchart zeichnen beide von Hand; diese beiden Funktionen
 * sind alles, was sie sich teilen. Sie stehen hier statt in einem der Charts,
 * damit keiner der beiden vom anderen abhängt.
 */

export const SVG_NS = "http://www.w3.org/2000/svg";

export const el = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
};

/**
 * Hält die Kindknoten einer Gruppe deckungsgleich mit einer Liste, ohne bei
 * jedem Frame das halbe DOM neu zu bauen — beim Scrubben laufen diese Aufrufe
 * pro Bild durch.
 */
export function syncNodes(group, items, tagName, update) {
  const nodes = group.childNodes;
  while (nodes.length > items.length) group.lastChild.remove();
  while (nodes.length < items.length) group.appendChild(el(tagName));
  items.forEach((item, i) => update(nodes[i], item));
}

/**
 * Pfad eines Balkens mit oben abgerundeten Ecken.
 *
 * `rx` auf einem `<rect>` rundet alle vier Ecken; Balken sollen unten aber auf
 * der Grundlinie aufsitzen. Der Radius wird zusätzlich auf die halbe Breite und
 * die Balkenhöhe begrenzt, sonst überschlägt sich die Kurve bei flachen Balken.
 */
export function barPath(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  const right = x + width;
  const bottom = y + height;
  if (r <= 0) return `M${x} ${y}H${right}V${bottom}H${x}Z`;
  return (
    `M${x} ${bottom}` +
    `V${y + r}` +
    `A${r} ${r} 0 0 1 ${x + r} ${y}` +
    `H${right - r}` +
    `A${r} ${r} 0 0 1 ${right} ${y + r}` +
    `V${bottom}` +
    `Z`
  );
}
