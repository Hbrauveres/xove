/**
 * The wordmark's hover animation (spec 0111, FR-4a), as a function of time:
 * 1. the corners slide in horizontally, erasing the letters, and meet around the O;
 * 2. the top and bottom corners settle where the icon has them;
 * 3. the dot blinks twice, like a surprised eye: shut fast, open a little slower, and the
 *    second time it springs slightly wide before settling;
 * 4. everything goes back.
 * `slide` and `settle` run 0–1; `eye` scales the dot (sy near 0 is shut).
 */

export type Frame = { slide: number; settle: number; eye: { sx: number; sy: number } };

const SLIDE = 600, SETTLE = 380, PAUSE = 160, HOLD = 320;
const CLOSE_1 = 80, OPEN_1 = 130, BETWEEN = 70, CLOSE_2 = 70, OPEN_2 = 240, CALM = 260;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
// Past 1, then back: a small spring.
const easeBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

const SHUT = 0.06, WIDE = 1.08;

type Step = { ms: number; at: (t: number) => Frame };
const still = (slide: number, settle: number): Frame => ({ slide, settle, eye: { sx: 1, sy: 1 } });
const eye = (sx: number, sy: number): Frame => ({ slide: 1, settle: 1, eye: { sx, sy } });

const STEPS: Step[] = [
  { ms: SLIDE, at: (t) => still(ease(t), 0) },
  { ms: SETTLE, at: (t) => still(1, ease(t)) },
  { ms: PAUSE, at: () => still(1, 1) },
  { ms: CLOSE_1, at: (t) => eye(1 + (WIDE - 1) * easeIn(t), 1 - (1 - SHUT) * easeIn(t)) },
  { ms: OPEN_1, at: (t) => eye(WIDE - (WIDE - 1) * easeOut(t), SHUT + (1 - SHUT) * easeOut(t)) },
  { ms: BETWEEN, at: () => still(1, 1) },
  { ms: CLOSE_2, at: (t) => eye(1 + (WIDE - 1) * easeIn(t), 1 - (1 - SHUT) * easeIn(t)) },
  {
    ms: OPEN_2,
    at: (t) => {
      const k = easeBack(t);
      return eye(WIDE - (WIDE - 1) * k + 0.1 * Math.max(0, t - 0.6), SHUT + (1 - SHUT) * k);
    },
  },
  {
    ms: CALM,
    at: (t) => {
      const k = easeOut(t);
      // From where the spring left it (a touch wide) back to round.
      return eye(1 + 0.04 * (1 - k), 1);
    },
  },
  { ms: HOLD, at: () => still(1, 1) },
  { ms: SETTLE, at: (t) => still(1, 1 - ease(t)) },
  { ms: SLIDE, at: (t) => still(1 - ease(t), 0) },
];

export const TOTAL_MS = STEPS.reduce((sum, s) => sum + s.ms, 0);

const round = (f: Frame): Frame => ({
  slide: +f.slide.toFixed(4),
  settle: +f.settle.toFixed(4),
  eye: { sx: +f.eye.sx.toFixed(4), sy: +f.eye.sy.toFixed(4) },
});

export function frameAt(ms: number): Frame {
  if (ms <= 0 || ms >= TOTAL_MS) return still(0, 0);
  let start = 0;
  for (const step of STEPS) {
    if (ms < start + step.ms) return round(step.at((ms - start) / step.ms));
    start += step.ms;
  }
  return still(0, 0);
}
