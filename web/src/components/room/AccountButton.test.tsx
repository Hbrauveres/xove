import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAmbilight } from "../../media/preferences";
import type { ConnectionState, Friend } from "../../types";
import { AccountButton } from "./AccountButton";
import { FooterItems } from "./RoomFooter";

const me: Friend = { id: "me", name: "Henrique", hue: 36, online: true };

function setup(props: Partial<Parameters<typeof AccountButton>[0]> = {}) {
  const onSignOut = vi.fn();
  const onAmbilightChange = vi.fn();
  const view = render(
    <MemoryRouter>
      <AccountButton
        me={me}
        isAdmin
        connection={"connected" as ConnectionState}
        ambilight={{ on: true, brightness: 0.9 }}
        onAmbilightChange={onAmbilightChange}
        onSignOut={onSignOut}
        {...props}
      />
    </MemoryRouter>,
  );
  return { user: userEvent.setup(), onSignOut, onAmbilightChange, view };
}

afterEach(() => localStorage.clear());

describe("account button (spec 0104)", () => {
  it("is my avatar with a dot that follows the connection", () => {
    const { view } = setup();
    expect(screen.getByRole("button", { name: "Henrique: account, connected" })).toBeInTheDocument();
    view.unmount();
    setup({ connection: "reconnecting" });
    expect(screen.getByRole("button", { name: "Henrique: account, reconnecting" })).toBeInTheDocument();
  });

  it("opens my name, role and connection, the ambilight, Admin and Sign out", async () => {
    const { user, onSignOut } = setup();
    await user.click(screen.getByRole("button", { name: /account/ }));

    const panel = screen.getByRole("dialog", { name: "Account" });
    expect(within(panel).getByText("Henrique")).toBeInTheDocument();
    expect(within(panel).getByText("Admin", { selector: "small" })).toBeInTheDocument();
    expect(within(panel).getByText("Connected")).toBeInTheDocument();
    expect(within(panel).getByRole("switch", { name: "Ambilight" })).toBeChecked();
    expect(within(panel).getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");

    await user.click(within(panel).getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it("shows Admin only to admins, and Member as the role otherwise", async () => {
    const { user } = setup({ isAdmin: false });
    await user.click(screen.getByRole("button", { name: /account/ }));

    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  it("switches the ambilight and sets its brightness, at once and for next time", async () => {
    const { user, onAmbilightChange } = setup();
    await user.click(screen.getByRole("button", { name: /account/ }));

    await user.click(screen.getByRole("switch", { name: "Ambilight" }));
    expect(onAmbilightChange).toHaveBeenLastCalledWith({ on: false, brightness: 0.9 });
    expect(loadAmbilight()).toEqual({ on: false, brightness: 0.9 });
    // Space toggles it too, from the keyboard (the test's prefs stay on, so it asks for off again).
    const calls = onAmbilightChange.mock.calls.length;
    screen.getByRole("switch", { name: "Ambilight" }).focus();
    await user.keyboard(" ");
    expect(onAmbilightChange).toHaveBeenCalledTimes(calls + 1);

    fireEvent.change(screen.getByRole("slider", { name: "Ambilight brightness" }), { target: { value: "0.85" } });
    expect(onAmbilightChange).toHaveBeenLastCalledWith({ on: true, brightness: 0.85 });
    expect(loadAmbilight().brightness).toBe(0.85);
  });
});

describe("account button on the phone (spec 0158)", () => {
  it("ends with the footer's items when given them", async () => {
    const { user } = setup({ footer: <FooterItems /> });
    await user.click(screen.getByRole("button", { name: /account/ }));
    const menu = screen.getByRole("dialog");
    const footer = within(menu).getByText(/Made by Hbrauveres/).closest("[data-footer]");
    expect(footer).not.toBeNull();
    expect(footer).toHaveTextContent("Buy me a coffee");
    expect(footer).toHaveTextContent("GitHub");
    expect(footer).toHaveTextContent("LinkedIn");
    // The last thing in the menu.
    const sections = menu.querySelectorAll("[data-footer], button, a");
    expect(sections[sections.length - 1].closest("[data-footer]")).toBe(footer);
  });

  it("has no footer items on desktop", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /account/ }));
    expect(within(screen.getByRole("dialog")).queryByText(/Made by Hbrauveres/)).toBeNull();
  });
});
