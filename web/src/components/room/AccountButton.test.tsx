import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAmbilight } from "../../media/preferences";
import type { ConnectionState, Friend } from "../../types";
import { AccountButton } from "./AccountButton";

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

    fireEvent.change(screen.getByRole("slider", { name: "Ambilight brightness" }), { target: { value: "0.85" } });
    expect(onAmbilightChange).toHaveBeenLastCalledWith({ on: true, brightness: 0.85 });
    expect(loadAmbilight().brightness).toBe(0.85);
  });
});
