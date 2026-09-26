import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { FullPageMessage } from "../components/ui/FullPageMessage";
import { useAuth } from "./AuthProvider";

/**
 * Client-side guards only decide which screen to show.
 * The real protection is the API: every protected endpoint checks the session itself.
 */

/** Where a signed-in person belongs, based on their status. */
function homeFor(status: string, admin: boolean): string {
  return status === "MEMBER" || admin ? "/room" : "/request-access";
}

export function RequireMember({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") return <FullPageMessage>Loading…</FullPageMessage>;
  if (state.status === "signedOut") return <Navigate to="/" replace />;
  if (state.me.status !== "MEMBER") return <Navigate to="/request-access" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") return <FullPageMessage>Loading…</FullPageMessage>;
  if (state.status === "signedOut") return <Navigate to="/" replace />;
  if (!state.me.admin) return <Navigate to={homeFor(state.me.status, false)} replace />;
  return <>{children}</>;
}

/** For the request-access page: signed-in non-members only. */
export function RequireNonMember({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") return <FullPageMessage>Loading…</FullPageMessage>;
  if (state.status === "signedOut") return <Navigate to="/" replace />;
  if (state.me.status === "MEMBER") return <Navigate to="/room" replace />;
  return <>{children}</>;
}

/** For the home page: signed-in people skip it and go where they belong. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") return <FullPageMessage>Loading…</FullPageMessage>;
  if (state.status === "signedIn") return <Navigate to={homeFor(state.me.status, state.me.admin)} replace />;
  return <>{children}</>;
}
