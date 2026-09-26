import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { ActivityFeed } from "../components/activity/ActivityFeed";
import { ShareControls } from "../components/controls/ShareControls";
import { AppHeader } from "../components/layout/AppHeader";
import { MockPanel } from "../components/mock/MockPanel";
import { Stage } from "../components/stage/Stage";
import { ViewerList } from "../components/viewers/ViewerList";
import { useRoomSession } from "../hooks/useRoomSession";
import type { Friend } from "../types";
import styles from "./RoomPage.module.css";

type Props = {
  /** How often to ask the API who is sharing. Tests pass a short one. */
  pollMs?: number;
};

/** The whole app is one room: the stage, its controls, and who's here. Members only. */
export function RoomPage({ pollMs }: Props = {}) {
  const { state, signOut } = useAuth();
  const navigate = useNavigate();
  const me = state.status === "signedIn" ? state.me : null;

  const meAsFriend = useMemo<Friend>(
    () => ({ id: "me", name: me?.name?.split(" ")[0] ?? me?.email ?? "You", hue: 36, online: true }),
    [me?.name, me?.email],
  );
  const session = useRoomSession(meAsFriend, pollMs);
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
            onStartSharing={session.take}
          />
          <ShareControls
            sharer={session.sharer}
            isMeSharing={session.isMeSharing}
            onStart={session.take}
            onTake={session.take}
            onStop={session.stop}
          />
          {session.error && (
            <p className={styles.error} role="alert">
              {session.error}
            </p>
          )}
        </main>

        <aside className={styles.side}>
          <ViewerList people={session.people} meId={session.me.id} sharerId={session.share?.sharerId ?? null} />
          <ActivityFeed events={session.activity} people={session.knownPeople} meId={session.me.id} />
          <MockPanel simulate={session.simulate} />
        </aside>
      </div>
    </div>
  );
}
