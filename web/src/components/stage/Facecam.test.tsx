import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeTrack } from "../../test/fakeLiveKit";
import { Facecam, type FacecamPlace } from "./Facecam";

// Spec 0060, FR-9 and AC-6: the small window over the big player.

/** The player is 1000×500 px; the facecam 240×135 px (24% of its width). */
function sizes() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const facecam = this.getAttribute("data-facecam") !== null;
    const width = facecam ? 240 : 1000;
    const height = facecam ? 135 : 500;
    return { x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height, toJSON: () => ({}) } as DOMRect;
  });
}

function renderFacecam(overrides: Partial<React.ComponentProps<typeof Facecam>> = {}) {
  const props = {
    video: new FakeTrack(),
    label: "Bruno's camera",
    place: { x: 0.7, y: 0.6 } as FacecamPlace,
    collapsed: false,
    onSwap: vi.fn(),
    onMove: vi.fn(),
    onCollapse: vi.fn(),
    ...overrides,
  };
  render(
    <div>
      <Facecam {...props} />
    </div>,
  );
  return props;
}

afterEach(() => vi.restoreAllMocks());

describe("the facecam", () => {
  it("plays the small video, where it was put", () => {
    const track = new FakeTrack();
    renderFacecam({ video: track });

    const video = screen.getByLabelText("Bruno's camera");
    expect(track.attached).toContain(video);
    const box = video.closest("[data-facecam]") as HTMLElement;
    expect(box.style.left).toBe("70%");
    expect(box.style.top).toBe("60%");
  });

  it("swaps the views with its button, which says so on hover", async () => {
    const props = renderFacecam();

    const swap = screen.getByRole("button", { name: "Swap views" });
    expect(swap).toHaveAttribute("title", "Swap views");
    await userEvent.setup().click(swap);

    expect(props.onSwap).toHaveBeenCalledTimes(1);
  });

  it("doesn't swap when the facecam itself is clicked or dragged", async () => {
    sizes();
    const props = renderFacecam();

    await userEvent.setup().click(screen.getByLabelText("Bruno's camera"));

    expect(props.onSwap).not.toHaveBeenCalled();
  });

  it("is dragged anywhere over the player, but never out of it", () => {
    sizes();
    const props = renderFacecam({ place: { x: 0.1, y: 0.1 } });
    const box = screen.getByLabelText("Bruno's camera").closest("[data-facecam]")!;

    fireEvent.pointerDown(box, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(box, { clientX: 300, clientY: 150, pointerId: 1 });
    expect(props.onMove).toHaveBeenLastCalledWith({ x: 0.3, y: 0.2 });

    fireEvent.pointerMove(box, { clientX: 5000, clientY: -800, pointerId: 1 });
    expect(props.onMove).toHaveBeenLastCalledWith({ x: 0.76, y: 0 });

    fireEvent.pointerUp(box, { pointerId: 1 });
    fireEvent.pointerMove(box, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(props.onMove).toHaveBeenCalledTimes(2);
  });

  it("moves with the arrow keys too", () => {
    sizes();
    const props = renderFacecam({ place: { x: 0.5, y: 0.5 } });
    const box = screen.getByLabelText("Bruno's camera").closest("[data-facecam]")!;

    fireEvent.keyDown(box, { key: "ArrowLeft" });
    expect(props.onMove).toHaveBeenLastCalledWith({ x: 0.45, y: 0.5 });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(props.onMove).toHaveBeenLastCalledWith({ x: 0.5, y: 0.55 });
  });

  it("collapses to a tab, and the tab expands it", async () => {
    const props = renderFacecam();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Hide facecam" }));
    expect(props.onCollapse).toHaveBeenLastCalledWith(true);
  });

  it("shows only the tab while collapsed", async () => {
    const props = renderFacecam({ collapsed: true });

    expect(screen.queryByLabelText("Bruno's camera")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Show facecam" }));
    expect(props.onCollapse).toHaveBeenLastCalledWith(false);
  });
});
