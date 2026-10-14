/** The broadcast colour bars of an empty stage, left to right. */
export const BARS = ["#e7ebf1", "#e0b341", "#3fbf7f", "#6fc3df", "#b47ad1", "#ef4b4b", "#4c6fe0"] as const;

let picture: HTMLCanvasElement | undefined;

/**
 * The bars as a small still picture, for the ambilight to light (spec 0158). Made once; null
 * where the page has no canvas.
 */
export function barsPicture(): HTMLCanvasElement | null {
  if (picture) return picture;
  const canvas = document.createElement("canvas");
  canvas.width = BARS.length * 16;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  BARS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * 16, 0, 16, canvas.height);
  });
  return (picture = canvas);
}
