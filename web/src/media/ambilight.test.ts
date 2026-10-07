import { describe, expect, it } from "vitest";
import { MARGIN, SPREAD, easeFor, edgeDraws, falloff, fadeMask, glowLayout, gridFor } from "./ambilight";

describe("ambilight: the grid follows the stage's shape (spec 0107)", () => {
  it("is 64×36 at 16:9, as before", () => {
    expect(gridFor(16 / 9)).toEqual({ cols: 64, rows: 36 });
  });

  it("turns for a portrait picture: 36 across, 64 down", () => {
    expect(gridFor(9 / 16)).toEqual({ cols: 36, rows: 64 });
  });

  it("keeps the cells square, 36 along the shorter side", () => {
    expect(gridFor(21 / 9)).toEqual({ cols: 84, rows: 36 });
    expect(gridFor(1)).toEqual({ cols: 36, rows: 36 });
  });

  it("never goes past 96 cells along the longer side", () => {
    expect(gridFor(4)).toEqual({ cols: 96, rows: 36 });
    expect(gridFor(1 / 4)).toEqual({ cols: 36, rows: 96 });
  });

  it("places the canvas so the glow reaches as far on every side", () => {
    const { cols, rows } = gridFor(9 / 16);
    const { placement } = glowLayout(cols, rows);
    // The reach and the margin beyond each edge; the cells are square, so the same distance in pixels.
    expect(parseFloat(placement.left)).toBeCloseTo((-(SPREAD + MARGIN) / 36) * 100);
    expect(parseFloat(placement.top)).toBeCloseTo((-(SPREAD + MARGIN) / 64) * 100);
  });
});

describe("ambilight drawn by the graphics pipeline (spec 0118)", () => {
  const L = glowLayout(64, 36);
  const at = (x: number, y: number) => y * L.width + x;

  it("lays the glow out at 2 px a cell: the 16-cell reach, then a 3-cell margin, round the stage", () => {
    expect([L.width, L.height]).toEqual([(64 + 38) * 2, (36 + 38) * 2]);
    expect(L.stage).toEqual({ x: 38, y: 38, w: 128, h: 72 });
    expect(L.placement.left).toBe(`${(-19 / 64) * 100}%`);
    expect(L.placement.height).toBe(`${(74 / 36) * 100}%`);
  });

  it("draws the picture in nine pieces that tile the canvas, corners from the picture's corners", () => {
    const draws = edgeDraws(L, 1920, 1080);
    expect(draws).toHaveLength(9);
    // Every canvas pixel is drawn exactly once: no gap, no dent at the corners.
    const hits = new Uint8Array(L.width * L.height);
    for (const { dst: [dx, dy, dw, dh] } of draws) {
      for (let y = dy; y < dy + dh; y++) for (let x = dx; x < dx + dw; x++) hits[at(x, y)]++;
    }
    expect(hits.every((n) => n === 1)).toBe(true);
    const corner = (name: string) => draws.find((d) => d.at === name)!.src.slice(0, 2);
    expect(corner("top-left")).toEqual([0, 0]);
    expect(corner("bottom-right")).toEqual([1920 - 6, 1080 - 6]);
    expect(draws.find((d) => d.at === "stage")!.src).toEqual([0, 0, 1920, 1080]);
  });

  it("fades to exactly nothing at the reach, with nothing past it to cut, and lights everything under the stage", () => {
    const m = fadeMask(L);
    const { x, y, w, h } = L.stage;
    for (let px = 0; px < L.width; px++) expect(m[at(px, 0)] + m[at(px, L.height - 1)]).toBe(0);
    for (let py = 0; py < L.height; py++) expect(m[at(0, py)] + m[at(L.width - 1, py)]).toBe(0);
    expect(m[at(x + w / 2, y + h / 2)]).toBe(255);
    // 16 cells out (32 px) from the right edge: gone.
    expect(m[at(x + w + 32, y + h / 2)]).toBe(0);
  });

  it("fades smoothly outward: never brighter further out, and no big steps", () => {
    const m = fadeMask(L);
    const { x, y, w, h } = L.stage, row = y + h / 2;
    let last = 255;
    for (let px = x + w; px < L.width; px++) {
      const a = m[at(px, row)];
      expect(a).toBeLessThanOrEqual(last + 1); // the grain may lift a level
      expect(last - a).toBeLessThanOrEqual(30);
      last = a;
    }
  });

  it("wraps round the corners: as bright diagonally out from a corner as straight out from a side", () => {
    const m = fadeMask(L);
    const { x, y } = L.stage, d = 10;
    const straight = m[at(x - d, y + 30)];
    const diagonal = m[at(x - Math.round(d / Math.SQRT2), y - Math.round(d / Math.SQRT2))];
    expect(Math.abs(straight - diagonal)).toBeLessThanOrEqual(4);
    expect(diagonal).toBeGreaterThan(0);
  });

  it("uses the same grain every time, so the dark shades don't shimmer", () => {
    expect(fadeMask(L)).toEqual(fadeMask(L));
  });

  it("falls off strong near the frame, with a long tail, to exactly zero", () => {
    expect(falloff(0)).toBe(1);
    expect(falloff(1)).toBe(0);
    expect(falloff(0.5)).toBeGreaterThan(falloff(0.6));
    expect(falloff(0.95)).toBeGreaterThan(0);
  });

  it("eases by time, not by frame, never below the 8-bit floor", () => {
    expect(easeFor(1000 / 60, 120)).toBeCloseTo(1 - Math.exp(-1000 / 60 / 120), 5);
    expect(easeFor(1000 / 30, 120)).toBeCloseTo(1 - Math.exp(-1000 / 30 / 120), 5);
    expect(easeFor(2, 120)).toBe(0.12);
    expect(easeFor(16, 0)).toBe(1);
  });
});
