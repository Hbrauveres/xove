/**
 * Xovê's mark (spec 0111): [XOVE] in a viewfinder, the O a record button, the top-right
 * corner red. Pure geometry on one grid (cap height 100, stroke 10), ported from
 * specs/0111-brand-mark/design.html, so the components and the favicon draw the same shapes.
 * No TypeScript-only syntax: scripts/brand-icons.mjs runs it with Node's type stripping.
 */

export const CAP = 100;
export const STROKE = 10;
/** How far the viewfinder sits from the letters, across and up and down. */
const PAD = 28;
/** Each corner's arm, in the wordmark and in the icon. */
const ARM = 24;
const ICON_ARM = 26;
/** The letters' widths, and the space between them. */
const WIDTH = { X: 88, O: 100, V: 90, E: 68 } as const;
const GAP = 20;
/** The record dot's radius in an O 100 across. */
const DOT_R = 29.4;

/** The icon's frame around its O, from each frame line to the O's edge. */
export const ICON_SPACING = { left: 15, right: 14, top: 18, bottom: 18 } as const;

export type Point = readonly [number, number];
/** A stroke: a line or a polyline, its ends square to itself. */
export type Stroke = { points: Point[]; cap: "butt"; join: "miter" };
/** A letter's strokes; `clip` cuts them flat at the cap height (the V's tips). */
export type Letter = { letter: "X" | "O" | "V" | "E"; left: number; strokes: Stroke[]; clip?: { x: number; width: number } };
export type Corner = { at: "top-left" | "bottom-left" | "bottom-right" | "top-right"; points: Point[]; red: boolean; width: number };
export type Box = { x: number; y: number; width: number; height: number };

const stroke = (...points: Point[]): Stroke => ({ points, cap: "butt", join: "miter" });

function corners(left: number, right: number, top: number, bottom: number, arm: number): Corner[] {
  const c = (at: Corner["at"], x: number, y: number, dx: number, dy: number): Corner => ({
    at,
    points: [
      [x + dx * arm, y],
      [x, y],
      [x, y + dy * arm],
    ],
    red: at === "top-right",
    width: STROKE,
  });
  return [c("top-left", left, top, 1, 1), c("bottom-left", left, bottom, 1, -1), c("bottom-right", right, bottom, -1, -1), c("top-right", right, top, -1, 1)];
}

function letterX(x0: number): Letter {
  // Square ends whose outer corners touch the cap line and the X's sides.
  const phi = Math.atan2(CAP, WIDTH.X);
  const dx = (STROKE / 2) * Math.sin(phi), dy = (STROKE / 2) * Math.cos(phi);
  return {
    letter: "X",
    left: x0,
    strokes: [stroke([x0 + dx, dy], [x0 + WIDTH.X - dx, CAP - dy]), stroke([x0 + dx, CAP - dy], [x0 + WIDTH.X - dx, dy])],
  };
}

function letterV(x0: number): Letter {
  return {
    letter: "V",
    left: x0,
    strokes: [stroke([x0 - 2, -30], [x0 + WIDTH.V / 2, CAP + 12], [x0 + WIDTH.V + 2, -30])],
    clip: { x: x0, width: WIDTH.V },
  };
}

function letterE(x0: number): Letter {
  const i = STROKE / 2;
  return {
    letter: "E",
    left: x0,
    strokes: [stroke([x0 + WIDTH.E, i], [x0 + i, i], [x0 + i, CAP - i], [x0 + WIDTH.E, CAP - i]), stroke([x0 + i, CAP / 2], [x0 + WIDTH.E - 7, CAP / 2])],
  };
}

const ring = (cx: number, cy: number) => ({ cx, cy, r: 50 - STROKE / 2, width: STROKE });
const dot = (cx: number, cy: number) => ({ cx, cy, r: DOT_R });

export function wordMark() {
  const left = STROKE / 2, top = -PAD, bottom = CAP + PAD;
  let x = left + PAD;
  const xLetter = letterX(x);
  x += WIDTH.X + GAP;
  const oLeft = x;
  const oLetter: Letter = { letter: "O", left: x, strokes: [] };
  x += WIDTH.O + GAP;
  const vLetter = letterV(x);
  x += WIDTH.V + GAP;
  const eLetter = letterE(x);
  x += WIDTH.E;
  const right = x + PAD;
  const viewBox: Box = { x: 0, y: top - STROKE / 2, width: right + STROKE / 2, height: bottom - top + STROKE };
  return {
    viewBox,
    frame: { left, right, top, bottom },
    corners: corners(left, right, top, bottom, ARM),
    letters: [xLetter, oLetter, vLetter, eLetter],
    ring: ring(oLeft + 50, CAP / 2),
    dot: dot(oLeft + 50, CAP / 2),
    /** Where each side moves when the animation closes on the O: the icon's spacing (FR-4a). */
    closed: {
      dx: { left: oLeft - ICON_SPACING.left - left, right: oLeft + WIDTH.O + ICON_SPACING.right - right },
      dy: { top: -ICON_SPACING.top - top, bottom: CAP + ICON_SPACING.bottom - bottom },
    },
  };
}

export function iconMark() {
  const left = STROKE / 2, top = 0;
  const oLeft = left + ICON_SPACING.left, oTop = top + ICON_SPACING.top;
  const right = oLeft + 100 + ICON_SPACING.right, bottom = oTop + 100 + ICON_SPACING.bottom;
  const viewBox: Box = { x: 0, y: top - STROKE / 2, width: right + STROKE / 2, height: bottom - top + STROKE };
  return {
    viewBox,
    frame: { left, right, top, bottom },
    corners: corners(left, right, top, bottom, ICON_ARM),
    ring: ring(oLeft + 50, oTop + 50),
    dot: dot(oLeft + 50, oTop + 50),
  };
}

export type WordMark = ReturnType<typeof wordMark>;
export type IconMark = ReturnType<typeof iconMark>;

/** Points as an SVG `points` attribute. */
export const pointsAttr = (points: readonly Point[]) => points.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(" ");
