import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { installFakeApi } from "../test/fakeApi";
import { renderApp } from "../test/renderApp";

describe("home page", () => {
  it("shows the drawn mark, not the typed name (spec 0111)", async () => {
    installFakeApi({ me: null });
    renderApp("/");

    expect(await screen.findByRole("img", { name: "Xovê" })).toBeInTheDocument();
    expect(screen.queryByText(/xovê/)).not.toBeInTheDocument();
  });
});
