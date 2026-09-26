import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { ActivityFeed } from "../components/activity/ActivityFeed";
import { ShareControls } from "../components/controls/ShareControls";
import { AppHeader } from "../components/layout/AppHeader";
import { MockPanel } from "../components/mock/MockPanel";
import { Stage } from "../components/stage/Stage";
import { ViewerList } from "../components/viewers/ViewerList";
import { useMockSession } from "../mock/useMockSession";
import type { Friend } from "../types";
import styles from "./RoomPage.module.css";

/** The whole app is one room: the stage, its controls, and who's here. Members only. */
export function RoomPage() {
  const { state, signOut } = useAuth();
  const navigate = useNavigate();
  const me = state.status === "signedIn" ? state.me : null;

  // The signed-in person joins the mock room as "you". The stage is still simulated until LiveKit.
  const meAsFriend = useMemo<Friend>(
    () => ({ id: "me", name: me?.name?.split(" ")[0] ?? me?.email ?? "You", hue: 36, online: true }),
    [me?.name, me?.email],
  );
  const session = useMockSession(meAsFriend);
  const onlineCount = session.people.filter((p) => p.online).length;

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className={styles.shell}>
      <AppHeader
        me={session.me}
        connection={session.connection}
        onlineCount={onlineCount}
        onSignOut={handleSignOut}
        isAdmin={me?.admin ?? false}
      />

      <div className={styles.layout}>
        <main className={styles.main}>
          <Stage
            share={session.share}
            sharer={session.sharer}
            stats={session.stats}
            isMeSharing={session.isMeSharing}
            connection={session.connection}
            onStartSharing={session.startSharing}
          />
          <ShareControls
            sharer={session.sharer}
            isMeSharing={session.isMeSharing}
            onStart={session.startSharing}
            onTake={session.takeScreen}
            onStop={session.stopSharing}
          />
        </main>

        <aside className={styles.side}>
          <ViewerList people={session.people} meId={session.me.id} sharerId={session.share?.sharerId ?? null} />
          <ActivityFeed events={session.activity} people={session.people} meId={session.me.id} />
          <MockPanel simulate={session.simulate} isMeSharing={session.isMeSharing} />
        </aside>
      </div>
    </div>
  );
}
