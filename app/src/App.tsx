import { Navigate, Route, Routes } from "react-router";
import { RedirectIfSignedIn, RequireAdmin, RequireMember, RequireNonMember } from "./auth/guards";
import { useInstalled } from "./hooks/useInstalled";
import { TOUCH_QUERY } from "./hooks/useRoomLayout";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { InstallPage } from "./pages/InstallPage";
import { RequestAccessPage } from "./pages/RequestAccessPage";
import { RoomPage } from "./pages/RoomPage";

/**
 *  /                 home + Google sign-in (signed-in people are sent on)
 *  /request-access   signed in, not a member yet
 *  /room             members
 *  /admin            admins
 *
 * On a phone or tablet in a browser tab, only the install screen (spec 0171): Xovê is used
 * from the home screen there.
 */
export default function App() {
  const installed = useInstalled();
  const touch = window.matchMedia?.(TOUCH_QUERY).matches ?? false;
  if (touch && !installed) return <InstallPage />;
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
