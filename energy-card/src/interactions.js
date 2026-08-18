/**
 * Zeigefinger-Logik für das Chart.
 *
 * Die Gestenverteilung folgt dem Vorbild: ein Finger scrubbt (das ist die
 * Geste, die man von der Tibber-App kennt), zwei Finger zoomen und
 * verschieben. Damit kollidiert nichts, und vertikales Wischen bleibt dank
 * `touch-action: pan-y` beim Dashboard.
 */

const MIN_WINDOW_MS = 30_000;
const MAX_WINDOW_MS = 90 * 24 * 3_600_000;
const SCRUB_RELEASE_MS = 2200;

/**
 * Gesten für das Balkenchart.
 *
 * Bewusst **ohne** Blättern per Einfinger-Wisch: waagerechtes Ziehen liest hier
 * Werte ab, genau wie in der Live-Ansicht. Würde derselbe Wisch je nach Tempo
 * mal lesen und mal blättern, wäre keine der beiden Gesten verlässlich. Die
 * Rollenverteilung bleibt deshalb dieselbe wie im Rest der Karte: ein Finger
 * liest, zwei Finger navigieren — dazu die Pfeile, die immer sichtbar sind.
 */
export function attachBarInteractions(surface, bars, handlers, options = {}) {
  const pointers = new Map();
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
        // Nach links wischen heisst vorwärts in der Zeit, wie beim Blättern
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

export function attachInteractions(surface, chart, handlers, options = {}) {
  const pointers = new Map();
  let mode = null; // "scrub" | "gesture"
  let gestureStart = null;
  let releaseTimer = null;
  let frame = null;
  let pendingScrubX = null;
  let lastScrubIndex = -1;

  const enabled = {
    scrub: options.scrub !== false,
    zoom: options.zoom !== false,
    pan: options.pan !== false,
  };

  const localX = (event) => {
    const rect = surface.getBoundingClientRect();
    const scale = rect.width ? chart.width / rect.width : 1;
    return (event.clientX - rect.left) * scale;
  };

  /* ---------------- Scrub ---------------- */

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
      // Kurzer Impuls beim Einrasten, sofern das Gerät ihn kennt
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

  /* ---------------- Zoom & Pan ---------------- */

  const applyWindow = (startMs, endMs, settled) => {
    let span = Math.max(MIN_WINDOW_MS, Math.min(MAX_WINDOW_MS, endMs - startMs));
    let start = startMs;
    let end = start + span;

    // Nicht nennenswert in die Zukunft schauen
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

  /* ---------------- Pointer-Ereignisse ---------------- */

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
        endMs: chart.endMs,
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
        start -= ((center - gestureStart.center) / width) * nextSpan;
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
      const delta = ((event.deltaX || event.deltaY) / (width || 1)) * span;
      applyWindow(chart.startMs + delta, chart.endMs + delta, false);
    } else if (enabled.zoom) {
      event.preventDefault();
      // Zoomstärke proportional zur Radbewegung: ein Trackpad-Wisch bleibt
      // fein dosierbar, eine kräftige Radumdrehung zoomt spürbar.
      const factor = Math.max(0.2, Math.min(5, Math.exp(event.deltaY * 0.0018)));
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
