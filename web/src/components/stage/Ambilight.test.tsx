import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { glowLayout } from "../../media/ambilight";
import { Ambilight, SLOW_SAMPLE_MS } from "./Ambilight";

/**
 * jsdom has no canvas: a 2D context that records what the ambilight asks of it. `pictureDraws`
 * counts updates (each draws the video nine times); `getImageData` must never be called.
 */
let pictureDraws = 0;
let pixelReads = 0;
let blurs: string[] = [];
let composites: string[] = [];
let masks = 0;
function fakeContext(this: HTMLCanvasElement) {
  return {
    canvas: this,
    globalAlpha: 1,
    _filter: "none",
    set filter(f: string) {
      this._filter = f;
      if (f.startsWith("blur")) blurs.push(f);
    },
    get filter() {
      return this._filter;
    },
    set globalCompositeOperation(op: string) {
      composites.push(op);
    },
    clearRect: () => {},
    drawImage: (source: unknown) => {
      if (source instanceof HTMLVideoElement) pictureDraws++;
    },
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {
      masks++;
    },
    getImageData: () => {
      pixelReads++;
      return { data: new Uint8ClampedArray(4) };
    },
  };
}

function playingVideo(playing = true) {
  const video = document.createElement("video");
  Object.defineProperty(video, "paused", { configurable: true, get: () => !playing });
  Object.defineProperty(video, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(video, "videoWidth", { configurable: true, get: () => 1920 });
  Object.defineProperty(video, "videoHeight", { configurable: true, get: () => 1080 });
  return video;
}

/** Updates so far: each one draws the picture nine times. */
const updates = () => pictureDraws / 9;

let hidden = false;
beforeEach(() => {
  pictureDraws = pixelReads = masks = 0;
  blurs = [];
  composites = [];
  hidden = false;
  vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
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

describe("ambilight drawn by the graphics pipeline (specs 0104 and 0118)", () => {
  it("updates once per screen refresh while the video plays, about 60 times a second", () => {
    render(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.9 }} />);
    advance(1000);
    expect(updates()).toBeGreaterThanOrEqual(55);
    expect(updates()).toBeLessThanOrEqual(63);
  });

  it("never reads the picture's pixels: it only draws, so any stream gets its light", () => {
    render(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.9 }} />);
    advance(500);
    expect(pixelReads).toBe(0);
    expect(updates()).toBeGreaterThan(0);
  });

  it("blurs the edges once per update, then cuts them with the fade mask made once", () => {
    render(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.9 }} />);
    advance(200);
    expect(masks).toBe(1);
    expect(blurs.length).toBeGreaterThanOrEqual(updates());
    expect(composites).toContain("destination-in");
  });

  it("draws nothing while the tab is hidden, and starts again when it's back", () => {
    render(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.9 }} />);
    hidden = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const before = updates();
    advance(1000);
    expect(updates() - before).toBeLessThanOrEqual(1);

    hidden = false;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    advance(1000);
    expect(updates() - before).toBeGreaterThanOrEqual(50);
  });

  it("draws nothing, and fades the light out, when the video is paused; no light without a video", () => {
    const { container, rerender } = render(
      <Ambilight video={playingVideo(false)} prefs={{ on: true, brightness: 0.9 }} />,
    );
    advance(1000);
    expect(updates()).toBe(0);
    expect(container.querySelector("canvas")).toHaveStyle({ opacity: "0" });

    rerender(<Ambilight video={null} prefs={{ on: true, brightness: 0.9 }} />);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("stops drawing when a playing video is paused", () => {
    const video = playingVideo();
    let playing = true;
    Object.defineProperty(video, "paused", { configurable: true, get: () => !playing });
    const { container } = render(<Ambilight video={video} prefs={{ on: true, brightness: 0.9 }} />);
    advance(500);
    const before = updates();

    playing = false;
    act(() => {
      video.dispatchEvent(new Event("pause"));
    });
    advance(1000);

    expect(before).toBeGreaterThan(0);
    expect(updates()).toBe(before);
    expect(container.querySelector("canvas")).toHaveStyle({ opacity: "0" });
  });

  it("draws nothing, and fades out, when switched off", () => {
    const { container } = render(<Ambilight video={playingVideo()} prefs={{ on: false, brightness: 0.9 }} />);
    advance(1000);
    expect(updates()).toBe(0);
    expect(container.querySelector("canvas")).toHaveStyle({ opacity: "0" });
  });

  it("shows the light at the chosen brightness", () => {
    const { container, rerender } = render(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.4 }} />);
    advance(200);
    expect(container.querySelector("canvas")).toHaveStyle({ opacity: "0.4" });

    rerender(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 1 }} />);
    expect(container.querySelector("canvas")).toHaveStyle({ opacity: "1" });
  });

  it("updates slowly when the system asks for reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) => ({ matches: query.includes("reduce"), addEventListener() {}, removeEventListener() {} }) as never,
    );
    render(<Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.9 }} />);
    advance(1000);
    expect(SLOW_SAMPLE_MS).toBeGreaterThanOrEqual(400);
    expect(updates()).toBeLessThanOrEqual(3);
  });

  it("sizes and places its canvas from the stage's shape, the margin included (specs 0107 and 0118)", () => {
    const { container } = render(
      <Ambilight video={playingVideo()} prefs={{ on: true, brightness: 0.9 }} shape={9 / 16} />,
    );
    const l = glowLayout(36, 64);
    const light = container.querySelector("canvas")!;
    expect([light.width, light.height]).toEqual([l.width, l.height]);
    expect(light.style.left).toBe(l.placement.left);
  });
});
