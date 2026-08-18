/**
 * Achsenteilung — von Linien- und Balkenchart gemeinsam genutzt.
 *
 * Der Zweck ist bei beiden derselbe: die oberste Gitterlinie soll beschriftet
 * am Rand liegen statt irgendwo im Nirgendwo. In der Vorlage endet die Skala
 * bei einer Spitze von rund 80 W genau auf 100.
 */

/** Rundet auf eine „schöne" Schrittweite (1, 2, 2.5, 5, 10 × Zehnerpotenz). */
export function niceStep(rough) {
  const exponent = Math.floor(Math.log10(rough));
  const magnitude = 10 ** exponent;
  const fraction = rough / magnitude;
  let nice;
  if (fraction <= 1) nice = 1;
  else if (fraction <= 2) nice = 2;
  else if (fraction <= 2.5) nice = 2.5;
  else if (fraction <= 5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

export function yTicks(scaleMax, target = 4) {
  if (!(scaleMax > 0)) return { step: 1, ticks: [0] };
  const step = niceStep(scaleMax / target);
  const ticks = [];
  for (let v = 0; v <= scaleMax + 1e-6; v += step) ticks.push(Number(v.toFixed(6)));
  return { step, ticks };
}
