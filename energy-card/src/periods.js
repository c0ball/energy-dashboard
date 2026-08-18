/**
 * Kalenderrechnung für die Analyse-Ansicht.
 *
 * Alle Grenzen entstehen über lokale `Date`-Arithmetik (`setDate`, `setMonth`,
 * `setHours`), niemals über das Addieren von 86 400 000 ms. Der Unterschied ist
 * nicht akademisch: am Tag der Zeitumstellung hat der Tag 23 oder 25 Stunden,
 * und ein Monat hat zwischen 28 und 31 Tagen. Wer mit Konstanten rechnet, liegt
 * zweimal im Jahr daneben und merkt es erst, wenn die Balken nicht mehr zum
 * Datum passen.
 */

import { getLocale } from "./format.js";

const HOUR = 3_600_000;

export const LEVELS = ["day", "week", "month", "year"];

/**
 * Womit die Analyse aufmacht, solange nichts anderes eingestellt ist. Der Monat
 * ist der Zeitraum, in dem eine Stromrechnung denkt — und lang genug, dass
 * einzelne Ausreisser die Aussage nicht mehr tragen.
 */
export const DEFAULT_LEVEL = "month";

/**
 * Die Musteransicht ist keine Periode, sondern ein Blick auf mehrere: sie
 * faltet die letzten Wochen auf einen Wochenrhythmus zusammen. Sie steht
 * deshalb neben `LEVELS`, nicht darin — Blättern und Vorperiodenvergleich
 * ergeben für sie keinen Sinn.
 */
export const PATTERN_LEVEL = "pattern";
export const ALL_LEVELS = [...LEVELS, PATTERN_LEVEL];

/** Zeitfenster der Musteransicht: die letzten `weeks` vollen Wochen plus heute. */
export function patternRange(weeks, firstWeekday = 1, nowMs = Date.now()) {
  const end = new Date(nowMs);
  end.setHours(end.getHours() + 1, 0, 0, 0);

  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  const shift = (start.getDay() - firstWeekday + 7) % 7;
  start.setDate(start.getDate() - shift - weeks * 7);

  return { startMs: start.getTime(), endMs: end.getTime(), period: "hour" };
}

/** Statistik-Periode und damit die Bedeutung eines Balkens je Ebene. */
export const LEVEL_PERIOD = {
  day: "hour",
  week: "day",
  month: "day",
  year: "month",
};

const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Erster Wochentag: bevorzugt die Home-Assistant-Einstellung, sonst die
 * Landesgewohnheit aus `Intl`. Rückfall ist Montag — die Karte läuft in erster
 * Linie im deutschsprachigen Raum.
 */
export function firstWeekdayIndex(hass) {
  const setting = hass?.locale?.first_weekday;
  if (setting && setting !== "language" && setting in WEEKDAY_INDEX) {
    return WEEKDAY_INDEX[setting];
  }
  try {
    // Intl zählt 1 = Montag … 7 = Sonntag; `% 7` bringt den Sonntag auf 0.
    const info = new Intl.Locale(hass?.locale?.language || "de").weekInfo;
    if (info?.firstDay) return info.firstDay % 7;
  } catch (err) {
    /* Browser ohne weekInfo — dann gilt der Rückfall */
  }
  return 1;
}

/* ------------------------------------------------------------------ *
 * Grenzen
 * ------------------------------------------------------------------ */

const startOfDay = (ms) => {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Anfang und Ende einer Periode um einen beliebigen Zeitpunkt herum.
 * `endMs` ist der Beginn der Folgeperiode, gehört also nicht mehr dazu.
 */
export function periodRange(level, anchorMs, { firstWeekday = 1 } = {}) {
  const start = startOfDay(anchorMs);

  if (level === "week") {
    const shift = (start.getDay() - firstWeekday + 7) % 7;
    start.setDate(start.getDate() - shift);
  } else if (level === "month") {
    start.setDate(1);
  } else if (level === "year") {
    start.setMonth(0, 1);
  }

  const end = new Date(start);
  if (level === "day") end.setDate(end.getDate() + 1);
  else if (level === "week") end.setDate(end.getDate() + 7);
  else if (level === "month") end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  // Ein Monatswechsel kann die Uhrzeit über die Zeitumstellung verschieben
  end.setHours(0, 0, 0, 0);

  return {
    level,
    startMs: start.getTime(),
    endMs: end.getTime(),
    period: LEVEL_PERIOD[level],
  };
}

/** Verschiebt den Bezugszeitpunkt um `delta` Perioden. */
export function shiftPeriod(level, anchorMs, delta, options = {}) {
  const { startMs } = periodRange(level, anchorMs, options);
  const date = new Date(startMs);

  if (level === "day") date.setDate(date.getDate() + delta);
  else if (level === "week") date.setDate(date.getDate() + delta * 7);
  else if (level === "month") date.setMonth(date.getMonth() + delta);
  else date.setFullYear(date.getFullYear() + delta);

  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Die Anfänge aller Balken einer Periode.
 *
 * Bewusst lokal erzeugt statt aus der Antwort des Recorders abgeleitet: nur so
 * bleiben Lücken sichtbar (ein Tag ohne Daten ist ein fehlender Balken, keine
 * verschobene Achse) und nur so stimmt die Anzahl an den Umstellungstagen.
 */
export function bucketStarts(level, startMs, endMs) {
  const out = [];

  if (level === "day") {
    // Innerhalb eines Tages sind die Stundenblöcke des Recorders echte
    // Stunden — der Umstellungstag ergibt so von selbst 23 oder 25 Stück.
    for (let t = startMs; t < endMs; t += HOUR) out.push(t);
    return out;
  }

  const cursor = new Date(startMs);
  while (cursor.getTime() < endMs) {
    out.push(cursor.getTime());
    if (level === "year") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return out;
}

/** Dauer eines Balkens in Millisekunden — an Umstellungstagen keine Konstante. */
export function bucketDuration(starts, index, endMs) {
  const next = index + 1 < starts.length ? starts[index + 1] : endMs;
  return Math.max(0, next - starts[index]);
}

export function isCurrentPeriod(startMs, endMs, nowMs = Date.now()) {
  return nowMs >= startMs && nowMs < endMs;
}

/** Wie viele Balken einer laufenden Periode bereits abgeschlossen sind. */
export function completedBuckets(starts, endMs, nowMs = Date.now()) {
  if (nowMs >= endMs) return starts.length;
  let count = 0;
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : endMs;
    if (end <= nowMs) count++;
    else break;
  }
  return count;
}

/* ------------------------------------------------------------------ *
 * Beschriftungen
 * ------------------------------------------------------------------ */

const fmt = (options) => new Intl.DateTimeFormat(getLocale(), options);

/** Überschrift der Periode, etwa „August 2026" oder „11.–17. August 2026". */
export function periodLabel(level, startMs, endMs) {
  const start = new Date(startMs);

  if (level === "year") return String(start.getFullYear());
  if (level === "month") return fmt({ month: "long", year: "numeric" }).format(start);
  if (level === "day") {
    return fmt({ weekday: "long", day: "numeric", month: "long" }).format(start);
  }

  // Woche: der letzte Tag gehört noch dazu, `endMs` ist bereits der nächste
  const last = new Date(endMs - 1);
  const sameMonth = start.getMonth() === last.getMonth();
  const from = fmt(sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })
    .format(start);
  const to = fmt({ day: "numeric", month: "long", year: "numeric" }).format(last);
  return `${from}.–${to}`;
}

/** Kurzform für die Achse unter den Balken. */
export function bucketTick(level, ms) {
  const date = new Date(ms);
  if (level === "day") return String(date.getHours());
  if (level === "week") return fmt({ weekday: "short" }).format(date);
  if (level === "month") return String(date.getDate());
  return fmt({ month: "short" }).format(date);
}

/** Ausgeschriebene Form für die Kopfzeile, wenn ein Balken gewählt ist. */
export function bucketLabel(level, ms, durationMs) {
  const date = new Date(ms);
  if (level === "day") {
    const to = new Date(ms + durationMs);
    const time = fmt({ hour: "2-digit", minute: "2-digit" });
    return `${time.format(date)}–${time.format(to)}`;
  }
  if (level === "year") return fmt({ month: "long", year: "numeric" }).format(date);
  return fmt({ weekday: "long", day: "numeric", month: "long" }).format(date);
}
