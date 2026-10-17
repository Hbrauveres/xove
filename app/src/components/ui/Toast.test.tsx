import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast";
import { clearToast, showToast, TOAST_MS } from "./toast";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => clearToast());
  vi.useRealTimers();
});

const pill = () => screen.getByRole("status");

describe("the toast (design decision 10)", () => {
  it("is an empty live region until there's something to say", () => {
    render(<Toast />);
    expect(pill()).toBeEmptyDOMElement();
    expect(pill()).toHaveAttribute("aria-live", "polite");
    expect(pill()).not.toHaveAttribute("data-show");
  });

  it("says a message with its icon, and fades out by itself after 3 s", () => {
    render(<Toast />);
    act(() => showToast("This browser can't share a screen", <svg data-icon="screen-off" />));
    expect(pill()).toHaveTextContent("This browser can't share a screen");
    expect(pill()).toHaveAttribute("data-show");
    expect(pill().querySelector('svg[data-icon="screen-off"]')).not.toBeNull();

    act(() => vi.advanceTimersByTime(TOAST_MS - 1));
    expect(pill()).toHaveAttribute("data-show");
    act(() => vi.advanceTimersByTime(1));
    expect(pill()).not.toHaveAttribute("data-show");
    // Drawn while it fades, then gone.
    expect(pill()).toHaveTextContent("This browser can't share a screen");
    act(() => vi.advanceTimersByTime(300));
    expect(pill()).toBeEmptyDOMElement();
  });

  it("shows one at a time: a new message replaces it and starts the 3 s over", () => {
    render(<Toast />);
    act(() => showToast("First"));
    act(() => vi.advanceTimersByTime(2000));
    act(() => showToast("Second"));
    expect(pill()).toHaveTextContent("Second");
    expect(pill()).not.toHaveTextContent("First");
    act(() => vi.advanceTimersByTime(2000));
    expect(pill()).toHaveAttribute("data-show");
    act(() => vi.advanceTimersByTime(1000));
    expect(pill()).not.toHaveAttribute("data-show");
  });
});
