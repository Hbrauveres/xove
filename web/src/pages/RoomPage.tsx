import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { ActivityFeed } from "../components/activity/ActivityFeed";
import { ShareControls } from "../components/controls/ShareControls";
import { WaitingRoom } from "../components/room/WaitingRoom";
import { ShareSetup } from "../components/share/ShareSetup";
import { AppHeader } from "../components/layout/AppHeader";
import { Stage } from "../components/stage/Stage";
import { ViewerList } from "../components/viewers/ViewerList";
import { useRoomSeat, type RoomSeat } from "../hooks/useRoomSeat";
import { useRoomSession } from "../hooks/useRoomSession";
import type { Friend } from "../types";
import styles from "./RoomPage.module.css";

type Props = {
  /** How often to ask the API which streams are live. Tests pass a short one. */
  pollMs?: number;
};

/**
 * The whole app is one room: the stage, its controls, and who's here. Members only.
 * Up to 20 people at once (spec 0060): whoever comes next waits for a seat.
 */
export function RoomPage({ pollMs }: Props = {}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const seat = useRoomSeat(pollMs);

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  // The video room only with a seat: the API hands out LiveKit tokens to seated people only.
  if (seat.status?.status !== "in") return <WaitingRoom seat={seat} onSignOut={handleSignOut} />;
  return <Room pollMs={pollMs} seat={seat} onSignOut={handleSignOut} />;
}

function Room({ pollMs, seat, onSignOut }: Props & { seat: RoomSeat; onSignOut: () => void }) {
  const { state } = useAuth();
  const me = state.status === "signedIn" ? state.me : null;

  const meAsFriend = useMemo<Friend>(
    () => ({ id: "me", name: me?.name?.split(" ")[0] ?? me?.email ?? "You", hue: 36, online: true }),
    [me?.name, me?.email],
  );
  const session = useRoomSession(meAsFriend, pollMs);
  const onlineCount = session.people.length;

  // The API forgot my seat (it restarted): ask again. With a seat free, nothing changes here.
  const { reenter } = seat;
  useEffect(() => {
    if (session.seated === false) reenter();
  }, [session.seated, reenter]);

  return (
    <div className={styles.shell}>
      <AppHeader
        me={session.me}
        connection={session.connection}
        onlineCount={onlineCount}
        onSignOut={onSignOut}
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
