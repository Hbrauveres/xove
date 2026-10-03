import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { ActivityFeed } from "../components/activity/ActivityFeed";
import { ShareControls } from "../components/controls/ShareControls";
import { ShareSetup } from "../components/share/ShareSetup";
import { AppHeader } from "../components/layout/AppHeader";
import { Stage } from "../components/stage/Stage";
import { ViewerList } from "../components/viewers/ViewerList";
import { useRoomSession } from "../hooks/useRoomSession";
import type { Friend } from "../types";
import styles from "./RoomPage.module.css";

type Props = {
  /** How often to ask the API which streams are live. Tests pass a short one. */
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
  const onlineCount = session.people.length;

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
            sharers={session.sharers}
            connection={session.connection}
            onStartSharing={() => session.start("screen")}
            prefs={session.prefs}
            onPrefsChange={session.setPrefs}
          />
          <ShareControls
            mine={session.mine}
            free={session.free}
            onStart={session.start}
            onStop={session.stop}
            noSound={session.noSound}
            busy={session.busy}
          />
          {session.error && (
            <p className={styles.error} role="alert">
              {session.error}
            </p>
          )}
        </main>

        {session.pending && (
          <ShareSetup
            kind={session.pending.kind}
            preview={session.pending.video}
            initial={session.prefs[session.pending.kind]}
            hasSound={session.pending.audio !== undefined}
            onStart={session.confirm}
            onCancel={session.cancelPending}
          />
        )}

        <aside className={styles.side}>
          <ViewerList people={session.people} meId={session.me.id} sharingIds={session.sharers.map((s) => s.person.id)} />
          <ActivityFeed events={session.activity} people={session.knownPeople} meId={session.me.id} />
        </aside>
      </div>
    </div>
  );
}
