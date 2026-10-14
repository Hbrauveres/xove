// First: the install prompt may come before anything renders (spec 0171).
import { listenForInstall } from "./install/prompt";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./styles/global.css";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";

listenForInstall();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
