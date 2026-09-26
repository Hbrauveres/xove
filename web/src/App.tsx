import { Navigate, Route, Routes } from "react-router";
import { RedirectIfSignedIn, RequireAdmin, RequireMember, RequireNonMember } from "./auth/guards";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { RequestAccessPage } from "./pages/RequestAccessPage";
import { RoomPage } from "./pages/RoomPage";

/**
 *  /                 home + Google sign-in (signed-in people are sent on)
 *  /request-access   signed in, not a member yet
 *  /room             members
 *  /admin            admins
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectIfSignedIn><HomePage /></RedirectIfSignedIn>} />
      <Route path="/request-access" element={<RequireNonMember><RequestAccessPage /></RequireNonMember>} />
      <Route path="/room" element={<RequireMember><RoomPage /></RequireMember>} />
      <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
