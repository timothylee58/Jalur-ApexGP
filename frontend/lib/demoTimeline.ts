/**
 * Keyframe maths for /guide's animated rule examples. Every scene is a pure
 * function of one looping clock (seconds), so any moment of it can be
 * frozen, jumped to from the step buttons, or shown still under reduced
 * motion. Tested in demoTimeline.test.ts.
 */

export type Ease = (x: number) => number;

export const linear: Ease = (x) => x;
export const easeIn: Ease = (x) => x * x;
export const easeOut: Ease = (x) => 1 - (1 - x) * (1 - x);
export const easeInOut: Ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/**
 * Value at time `t` along keyframes (times[i], values[i]), held flat before
 * the first and after the last. `eases` shapes each segment — one easing for
 * all of them, or one per segment (segment i runs from key i to key i + 1).
 */
export function keyframes(t: number, times: number[], values: number[], eases: Ease | Ease[] = linear): number {
  if (t <= times[0]) return values[0];
  const last = times.length - 1;
  if (t >= times[last]) return values[last];
  let i = 0;
  while (i < last - 1 && t >= times[i + 1]) i += 1;
  const span = times[i + 1] - times[i];
  const f = span > 0 ? (t - times[i]) / span : 1;
  const ease = Array.isArray(eases) ? (eases[i] ?? linear) : eases;
  return values[i] + (values[i + 1] - values[i]) * ease(f);
}

/** Index of the step under way at `t`: the last start at or before it. */
export function stepAt(t: number, starts: number[]): number {
  let step = 0;
  starts.forEach((start, i) => {
    if (t >= start) step = i;
  });
  return step;
}

/** Opacity for something shown from `a` to `b`, fading in and out over
 * `fade` seconds either side — 0 outside the window, 1 inside it. */
export function windowed(t: number, a: number, b: number, fade = 0.25): number {
  if (t < a - fade || t > b + fade) return 0;
  if (t < a) return (t - (a - fade)) / fade;
  if (t > b) return 1 - (t - b) / fade;
  return 1;
}
