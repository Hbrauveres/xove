import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "../App";
import { AuthProvider } from "../auth/AuthProvider";

/** Renders the whole app at a given URL, the way the browser would. */
export function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}
