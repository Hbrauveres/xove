import { describe, expect, it } from "vitest";
import { COLS, FALLOFF, LED_COUNT, ROWS, SPREAD, easeColors, edgeColors, paintRing, ringPlacement } from "./ambilight";

/** A frame of the given size, every pixel the colour `at(x, y)` says. */
function frame(cols: number, rows: number, at: (x: number, y: number) => [number, number, number]) {
  const px = new Uint8ClampedArray(cols * rows * 4);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const [r, g, b] = at(x, y);
      px.set([r, g, b, 255], (y * cols + x) * 4);
    }
  }
  return px;
}

const led = (colors: Float32Array, i: number) => [...colors.slice(i * 3, i * 3 + 3)].map(Math.round);

describe("ambilight: the LEDs' colours (spec 0104)", () => {
  it("has 200 LEDs: 64 along the top and the bottom, 36 down each side", () => {
    expect([COLS, ROWS, LED_COUNT]).toEqual([64, 36, 200]);
  });

  it("takes each LED from its own edge, averaged with the pixel next to it inward", () => {
    // Top row red, second row black; bottom row blue; left column green; right column white.
    const px = frame(COLS, ROWS, (x, y) =>
      y === 0
        ? [200, 0, 0]
        : y === ROWS - 1
          ? [0, 0, 200]
          : x === 0
            ? [0, 200, 0]
            : x === COLS - 1
              ? [255, 255, 255]
              : [0, 0, 0],
    );

    const colors = edgeColors(px);

    expect(colors).toHaveLength(LED_COUNT * 3);
    expect(led(colors, 10)).toEqual([100, 0, 0]); // top: red with the black below it
    expect(led(colors, COLS + 10)).toEqual([0, 0, 100]); // bottom
    expect(led(colors, COLS * 2 + 10)).toEqual([0, 100, 0]); // left
    expect(led(colors, COLS * 2 + ROWS + 10)).toEqual([128, 128, 128]); // right
  });

  it("eases each LED towards its new colour, and jumps there the first time", () => {
    const current = new Float32Array([0, 0, 0]);
    easeColors(current, new Float32Array([100, 200, 50]), 0.3);
    expect([...current].map((v) => Math.round(v))).toEqual([30, 60, 15]);

    const first = new Float32Array([0, 0, 0]);
    easeColors(first, new Float32Array([100, 200, 50]), 1);
    expect([...first]).toEqual([100, 200, 50]);
  });
});

describe("ambilight: painting the ring (spec 0104)", () => {
  it("maps the canvas so its middle covers the stage exactly", () => {
    expect(ringPlacement()).toEqual({
      left: `${(-SPREAD / COLS) * 100}%`,
      width: `${((COLS + SPREAD * 2) / COLS) * 100}%`,
      top: `${(-SPREAD / ROWS) * 100}%`,
      height: `${((ROWS + SPREAD * 2) / ROWS) * 100}%`,
    });
  });

  it("paints one fading strip per LED, on a soft curve, then blurs it a little at that size", () => {
    const stops: [number, string][] = [];
    const rects: number[][] = [];
    const ctx = {
      filter: "none",
      canvas: { width: COLS + SPREAD * 2, height: ROWS + SPREAD * 2 },
      clearRect: () => {},
      createLinearGradient: () => ({ addColorStop: (at: number, color: string) => stops.push([at, color]) }),
      fillRect: (...r: number[]) => rects.push(r),
      drawImage: () => {},
      fillStyle: "" as unknown,
    };
    const colors = new Float32Array(LED_COUNT * 3).fill(80);

    const filters: string[] = [];
    const out = {
      ...ctx,
      set filter(f: string) {
        filters.push(f);
      },
      get filter() {
        return filters.at(-1) ?? "none";
      },
    };
    paintRing(out as unknown as CanvasRenderingContext2D, ctx as unknown as CanvasRenderingContext2D, colors);

    expect(rects).toHaveLength(LED_COUNT);
    expect(stops.slice(0, FALLOFF.length).map(([at, c]) => [at, c])).toEqual(
      FALLOFF.map(([at, alpha]) => [at, `rgba(80,80,80,${alpha})`]),
    );
    expect(filters).toContain("blur(3px)");
  });
});
