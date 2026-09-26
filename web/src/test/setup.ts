import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { rooms } from "./fakeLiveKit";

// No WebRTC in jsdom: every test gets the fake LiveKit instead of the real package.
vi.mock("livekit-client", () => import("./fakeLiveKit"));

afterEach(() => {
  cleanup();
  rooms.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

// jsdom lacks these browser APIs.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
