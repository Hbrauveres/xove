import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { ActivityFeed } from "../components/activity/ActivityFeed";
import { WaitingRoom } from "../components/room/WaitingRoom";
import { ShareSetup } from "../components/share/ShareSetup";
import { canShareScreen } from "../media/shareSettings";
import { AppHeader } from "../components/layout/AppHeader";
import { Stage } from "../components/stage/Stage";
import { ViewerList } from "../components/viewers/ViewerList";
import { useFullscreenElement, useFullscreenHost } from "../hooks/useFullscreenElement";
import { SEAT_POLL_MS, useRoomSeat, type RoomSeat } from "../hooks/useRoomSeat";
import { useRoomSession } from "../hooks/useRoomSession";
import { useStagePick } from "../hooks/useStagePick";
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
  // Who is on the stage (spec 0104): the stage, the previews and the activity list can change it.
  const stage = useStagePick(session.sharers);
  const { watchStage } = session;
  const stagePersonId = stage.big?.person.id ?? null;
  useEffect(() => {
    watchStage(stagePersonId && stage.mainKind ? { personId: stagePersonId, kind: stage.mainKind } : null);
  }, [watchStage, stagePersonId, stage.mainKind]);
  // In fullscreen only the player can be seen: the setup window and errors go inside it (spec 0101).
  const fullscreen = useFullscreenElement();
  const overPage = useFullscreenHost();
  const onlineCount = session.people.length;

  // The API forgot my seat (it restarted): ask again, with my video connection, which
  // confirms the seat; keep asking until it answers. With a seat free, nothing changes here.
  const { reenter } = seat;
  const { seated, participantSid } = session;
  useEffect(() => {
    if (seated !== false) return;
    reenter(participantSid());
    const timer = window.setInterval(() => reenter(participantSid()), pollMs ?? SEAT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [seated, reenter, participantSid, pollMs]);

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
            stage={stage}
            controls={{
              mine: session.mine,
              free: session.free,
              prefs: session.prefs,
              cameras: session.cameras,
              camera: session.cameraId,
              canShareScreen: canShareScreen(),
              noSound: session.noSound,
              busy: session.busy,
              onStart: session.start,
              onStop: session.stop,
              onPrefsChange: session.setPrefs,
              onChangeWindow: session.changeScreen,
              onPickCamera: session.pickCamera,
            }}
          />
          {session.error && !fullscreen && (
            <p className={styles.error} role="alert">
              {session.error}
            </p>
          )}
        </main>

        {fullscreen &&
          session.error &&
          createPortal(
            <p className={`${styles.error} ${styles.errorOver}`} role="alert">
              {session.error}
            </p>,
            overPage,
          )}
        {session.pending &&
          createPortal(
            <ShareSetup
              kind={session.pending.kind}
              preview={session.pending.video}
              initial={session.prefs[session.pending.kind]}
              hasSound={session.pending.audio !== undefined}
              onStart={session.confirm}
              onCancel={session.cancelPending}
            />,
            overPage,
          )}

        <aside className={styles.side}>
          <ViewerList people={session.people} meId={session.me.id} sharingIds={session.sharers.map((s) => s.person.id)} />
          <ActivityFeed events={session.activity} people={session.knownPeople} meId={session.me.id} />
        </aside>
      </div>
    </div>
  );
}
