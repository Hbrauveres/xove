import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLS, ROWS } from "../../media/ambilight";
import { Ambilight, SAMPLE_MS, SLOW_SAMPLE_MS } from "./Ambilight";

/** jsdom has no canvas: a 2D context that counts what the ambilight asks of it. */
let reads = 0;
let lastRead: [number, number] = [0, 0];
let readError: Error | null = null;
function fakeContext(this: HTMLCanvasElement) {
  return {
    canvas: this,
    filter: "none",
    fillStyle: "",
    clearRect: () => {},
    fillRect: () => {},
    drawImage: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    getImageData: (_x: number, _y: number, w = COLS, h = ROWS) => {
      if (readError) throw readError;
      reads++;
      lastRead = [w, h];
      return { data: new Uint8ClampedArray(w * h * 4).fill(120) };
    },
  };
}

function playingVideo(playing = true) {
  const video = document.createElement("video");
  Object.defineProperty(video, "paused", { configurable: true, get: () => !playing });
  Object.defineProperty(video, "readyState", { configurable: true, get: () => 4 });
  return video;
}

let hidden = false;
beforeEach(() => {
  reads = 0;
  readError = null;
  hidden = false;
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(fakeContext as never);
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("ambilight (spec 0104)", () => {
  it("reads the playing video about 12 times a second", () => {
    render(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.9 }} />);

    advance(1000);

    expect(SAMPLE_MS).toBeLessThanOrEqual(90);
    expect(reads).toBeGreaterThanOrEqual(11);
    expect(reads).toBeLessThanOrEqual(13);
  });

  it("reads nothing while the tab is hidden, and starts again when it's back", () => {
    render(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.9 }} />);
    hidden = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    advance(1000);
    const whileHidden = reads;

    hidden = false;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    advance(1000);

    expect(whileHidden).toBeLessThanOrEqual(1);
    expect(reads - whileHidden).toBeGreaterThanOrEqual(11);
  });

  it("reads nothing, and fades the light out, when the video is paused; no light without a video", () => {
    const { container, rerender } = render(
      <Ambilight video={playingVideo(false)} prefs={{ on: true, brightness: 0.9 }} />,
    );
    advance(1000);
    expect(reads).toBe(0);
    expect(container.querySelector("canvas")).toHaveStyle({ opacity: "0" });

    rerender(<Ambilight video={null} prefs={{ on: true, brightness: 0.9 }} />);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("stops reading when a playing video is paused", () => {
    const video = document.createElement("video");
    let playing = true;
    Object.defineProperty(video, "paused", { configurable: true, get: () => !playing });
    Object.defineProperty(video, "readyState", { configurable: true, get: () => 4 });
    const { container } = render(<Ambilight video={video} prefs={{ on: true, brightness: 0.9 }} />);
    advance(500);
    const before = reads;

    playing = false;
    act(() => {
      video.dispatchEvent(new Event("pause"));
    });
    advance(1000);

    expect(before).toBeGreaterThan(0);
    expect(reads).toBe(before);
    expect(container.querySelector("canvas")).toHaveStyle({ opacity: "0" });
  });

  it("reads nothing, and fades out, when switched off", () => {
    const { container } = render(<Ambilight video={playingVideo()} prefs={{ on: false, brightness: 0.9 }} />);
    advance(1000);

    expect(reads).toBe(0);
    expect(container.querySelector("canvas")).toHaveStyle({ opacity: "0" });
  });

  it("shows the light at the chosen brightness", () => {
    const { container, rerender } = render(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.4 }} />);
    advance(200);
    expect(container.querySelector("canvas")).toHaveStyle({ opacity: "0.4" });

    rerender(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 1 }} />);
    expect(container.querySelector("canvas")).toHaveStyle({ opacity: "1" });
  });

  it("reads slowly when the system asks for reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({ matches: query.includes("reduce"), addEventListener() {}, removeEventListener() {} }) as never,
    );
    render(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.9 }} />);

    advance(1000);

    expect(SLOW_SAMPLE_MS).toBeGreaterThanOrEqual(400);
    expect(reads).toBeLessThanOrEqual(3);
  });

  it("turns itself off quietly when the browser won't let the video be read", () => {
    readError = new DOMException("Tainted", "SecurityError");
    const { container } = render(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.9 }} />);

    advance(1000);
    readError = null;
    advance(1000);

    expect(reads).toBe(0);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("follows the stage's shape: a portrait stage is read 36 across and 64 down (spec 0107)", () => {
    const { container } = render(
      <Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.9 }} shape={9 / 16} />,
    );
    advance(SAMPLE_MS);

    expect(lastRead).toEqual([36, 64]);
    const light = container.querySelector("canvas")!;
    expect([light.width, light.height]).toEqual([36 + 32, 64 + 32]);
    expect(light.style.left).toBe(`${(-16 / 36) * 100}%`);
  });
});
