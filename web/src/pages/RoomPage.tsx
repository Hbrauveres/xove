import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { AccountButton } from "../components/room/AccountButton";
import { ActivityBell } from "../components/room/ActivityBell";
import { ActivityPill } from "../components/room/ActivityPill";
import { PeopleButton } from "../components/room/PeopleButton";
import { FooterItems, RoomFooter } from "../components/room/RoomFooter";
import { RoomHeader } from "../components/room/RoomHeader";
import { WaitingRoom } from "../components/room/WaitingRoom";
import { ShareSetup } from "../components/share/ShareSetup";
import { loadAmbilight } from "../media/preferences";
import { canShareScreen } from "../media/shareSettings";
import { Stage } from "../components/stage/Stage";
import { useFullscreenElement, useFullscreenHost } from "../hooks/useFullscreenElement";
import { TOUCH_QUERY, useRoomLayout } from "../hooks/useRoomLayout";
import { usePageFullscreen } from "../hooks/usePageFullscreen";
import { SEAT_POLL_MS, useRoomSeat, type RoomSeat } from "../hooks/useRoomSeat";
import { useRoomSession } from "../hooks/useRoomSession";
import { useStagePick } from "../hooks/useStagePick";
import type { Friend, StreamKind } from "../types";
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
  // A stream still loading counts as nothing watched yet ("In the room").
  const stagePersonId = stage.playing ? (stage.big?.person.id ?? null) : null;
  useEffect(() => {
    watchStage(stagePersonId && stage.mainKind ? { personId: stagePersonId, kind: stage.mainKind } : null);
  }, [watchStage, stagePersonId, stage.mainKind]);
  // In fullscreen only the player can be seen: the setup window and errors go inside it (spec 0101).
  const fullscreen = useFullscreenElement();
  const overPage = useFullscreenHost();
  const [ambilight, setAmbilight] = useState(loadAmbilight);
  // What each person shares, for the people panel; and whether a stream is still live.
  const sharing = useMemo(
    () =>
      Object.fromEntries(
        session.sharers.map((s) => [s.person.id, { screen: Boolean(s.screen), camera: Boolean(s.camera) }]),
      ),
    [session.sharers],
  );
  const isLive = (personId: string, kind: StreamKind) => Boolean(sharing[personId]?.[kind]);
  // Under the stage (spec 0107): who has its person on their stage (me included, never that
  // person), and, for an empty stage, the others in the room.
  const bigId = stage.big?.person.id;
  const { people, watchingOf } = session;
  const meId = session.me.id;
  const watchers = useMemo(
    () => (bigId ? people.filter((p) => p.id !== bigId && watchingOf[p.id]?.sharerId === bigId) : []),
    [people, watchingOf, bigId],
  );
  const others = useMemo(() => people.filter((p) => p.id !== meId), [people, meId]);
  // A phone or tablet held upright (specs 0158 and 0160): the same room, laid out for it.
  const layout = useRoomLayout();
  const phone = layout === "upright";
  const sideways = layout === "sideways";
  // Either phone view: the bell, and the footer's items in my menu (specs 0158 and 0160).
  const handheld = phone || sideways;
  // On a phone or tablet, a tap puts the whole room in fullscreen, so the address bar goes (spec 0160).
  const touch = window.matchMedia?.(TOUCH_QUERY).matches ?? false;
  usePageFullscreen(handheld && touch, layout);
  // For the phone's feed: who has each sharer on their stage, as under the stage.
  const watchersOf = useCallback(
    (id: string) => people.filter((p) => p.id !== id && watchingOf[p.id]?.sharerId === id),
    [people, watchingOf],
  );
  const watching = stage.big && stage.mainKind ? { personId: stage.big.person.id, kind: stage.mainKind } : null;

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

  // People, then (on a phone) the bell, then me at the far right (spec 0158).
  const myButtons = (
    <>
      <PeopleButton
        people={session.people}
        meId={session.me.id}
        sharing={sharing}
        watchingOf={session.watchingOf}
        seats={session.seats}
      />
      {handheld && (
        <ActivityBell
          events={session.activity}
          people={session.knownPeople}
          meId={session.me.id}
          isLive={isLive}
          watching={watching}
          onWatch={stage.pick}
        />
      )}
      <AccountButton
        me={session.me}
        isAdmin={me?.admin ?? false}
        connection={session.connection}
        ambilight={ambilight}
        onAmbilightChange={setAmbilight}
        onSignOut={onSignOut}
        footer={handheld ? <FooterItems /> : undefined}
      />
    </>
  );

  return (
    <div className={styles.theater} data-layout={phone ? "phone" : sideways ? "sideways" : undefined}>
      {/* Sideways there's no header: my buttons sit in the stage's top bar (spec 0160). */}
      {!sideways && (
        <RoomHeader
          middle={
            // On the phone the bell takes the pill's place, on the right (spec 0158).
            !phone && (
              <ActivityPill
                events={session.activity}
                people={session.knownPeople}
                meId={session.me.id}
                connection={session.connection}
                isLive={isLive}
                watching={watching}
                onWatch={stage.pick}
              />
            )
          }
          right={myButtons}
        />
      )}

      {/* One column as wide as the stage can be: the stage and its info row share its edges. */}
      <main className={styles.middle}>
        <div className={styles.column}>
          <Stage
            sharers={session.sharers}
            stage={stage}
            ambilight={ambilight}
            watchers={watchers}
            others={others}
            layout={phone ? "phone" : sideways ? "sideways" : undefined}
            topRight={sideways ? myButtons : undefined}
            watchersOf={watchersOf}
            people={people}
            meId={meId}
            arrivedAt={session.arrivedAt}
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
        </div>
        {/* Over the bottom of the middle: the column is sized exactly, nothing may push it. */}
        {session.error && !fullscreen && (
          <p className={`${styles.error} ${styles.errorBelow}`} role="alert">
            {session.error}
          </p>
        )}
      </main>

      {!handheld && <RoomFooter />}

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
    </div>
  );
}
