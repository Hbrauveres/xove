import { useId, useState, type ReactNode } from "react";
import type { ScreenSurface } from "../../hooks/useLiveKitRoom";
import { usePinnedRow } from "../../hooks/usePinnedRow";
import type { CameraDevice, StreamKind } from "../../types";
import { DropUp } from "../ui/DropUp";
import drop from "../ui/DropUp.module.css";
import { Picker } from "../ui/Picker";
import { ButtonSlot } from "./ButtonSlot";
import { CameraOffIcon, CameraOnIcon, CogIcon, ScreenOffIcon, ScreenOnIcon, ScreenShareIcon, WindowIcon } from "./icons";
import round from "./RoundButton.module.css";
import styles from "./PlayerButtons.module.css";

export const FULL_ROOM = "6 streams are live, the most at once. You can start yours when one stops.";
export const NO_SOUND =
  "No sound is being shared. Share a tab, or a window with “Share this app's audio too”, with Change.";

type Props = {
  /** Which of my streams are live. */
  mine: Record<StreamKind, boolean>;
  /** Stream places left of the 6. */
  free: number;
  /** The browser's cameras, and the one in use. */
  cameras: CameraDevice[];
  camera: string | null;
  /** False where the browser can't share a screen (phones). */
  canShareScreen: boolean;
  /** I'm sharing my screen, but my browser gave no sound. */
  noSound?: boolean;
  /** What my screen share shows: a window, a tab or the whole screen. */
  screenSurface?: ScreenSurface;
  /** A request is on its way: the buttons wait. */
  busy?: boolean;
  onStart: (kind: StreamKind) => void;
  onStop: (kind: StreamKind) => void;
  onChangeWindow: () => void;
  onPickCamera: (deviceId: string) => void;
  /** The settings panel is open; the cog opens and closes it (spec 0107). */
  settingsOpen: boolean;
  onSettings: () => void;
  /** A drop-up's list opened or closed: the player keeps its controls shown while one is open. */
  onMenuChange?: (open: boolean) => void;
  /** What the viewer hears, before my buttons (spec 0101): the volume, while watching someone. */
  before?: ReactNode;
};

/** What the room passes on to my buttons: the stage adds the viewer's part. */
export type StreamControls = Omit<Props, "onMenuChange" | "before">;

const LABEL: Record<StreamKind, { start: string; stop: string; quick: string }> = {
  screen: { start: "Share your screen", stop: "Stop sharing your screen", quick: "What you share" },
  camera: { start: "Turn on your camera", stop: "Turn off your camera", quick: "Your camera" },
};

const SURFACE: Record<ScreenSurface, string> = { window: "A window", browser: "A tab", monitor: "Your whole screen" };

/**
 * The player's centred row of round buttons (specs 0098, 0101, 0106 and 0107): the volume
 * while watching someone, my screen and camera, and the cog for the settings. A click on mine
 * starts or stops; while one is live, resting the pointer on it unrolls its quick access.
 */
export function PlayerButtons(props: Props) {
  const { canShareScreen, before, settingsOpen, onSettings } = props;

  // A button that comes or goes never moves the one under the pointer (spec 0106).
  const { ref: rowRef } = usePinnedRow<HTMLDivElement>();

  const kinds: StreamKind[] = canShareScreen ? ["screen", "camera"] : ["camera"];
  return (
    <div className={styles.row}>
      <div className={styles.buttons} ref={rowRef}>
        <ButtonSlot shown={Boolean(before)} side="start">
          {before}
        </ButtonSlot>
        {kinds.map((kind) => (
          <StreamButton key={kind} kind={kind} {...props} />
        ))}
        <div className={styles.control}>
          <div className={round.pill} data-open={settingsOpen || undefined}>
            <button
              type="button"
              className={round.main}
              aria-label="Settings"
              aria-expanded={settingsOpen}
              aria-haspopup="dialog"
              onClick={onSettings}
            >
              <CogIcon />
            </button>
            <span role="tooltip" className={round.tip} aria-hidden="true">
              Settings
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StreamButton({
  kind,
  mine,
  free,
  cameras,
  camera,
  noSound = false,
  screenSurface,
  busy = false,
  onStart,
  onStop,
  onChangeWindow,
  onPickCamera,
  onMenuChange,
}: Props & { kind: StreamKind }) {
  const live = mine[kind];
  const full = !live && free <= 0;
  const blocked = full || busy;
  const silent = kind === "screen" && live && noSound;
  const label = live ? LABEL[kind].stop : LABEL[kind].start;
  const tip = full ? FULL_ROOM : silent ? `${label}. ${NO_SOUND}` : label;
  const tipId = useId();
  // The camera's list closes when its drop-up is left.
  const [listClosed, setListClosed] = useState(false);

  const button = (
    <div className={styles.control}>
      <div className={`${round.pill} ${live ? round.live : ""} ${full ? round.disabled : ""}`}>
        <button
          type="button"
          className={round.main}
          aria-label={label}
          aria-pressed={live}
          aria-disabled={blocked || undefined}
          aria-describedby={tipId}
          onClick={() => {
            if (blocked) return;
            if (live) onStop(kind);
            else onStart(kind);
          }}
        >
          <Icon kind={kind} off={!live} />
        </button>
        <span id={tipId} role="tooltip" className={round.tip}>
          {tip}
        </span>
      </div>
    </div>
  );

  const quick =
    kind === "screen" ? (
      <div className={drop.row}>
        <span className={styles.source}>
          <WindowIcon />
          <span>{screenSurface ? SURFACE[screenSurface] : "Your screen"}</span>
        </span>
        <button
          type="button"
          className={styles.change}
          title="Pick another window or tab; viewers keep watching the same stream"
          disabled={busy}
          onClick={onChangeWindow}
        >
          Change
        </button>
      </div>
    ) : (
      <Picker
        label="Camera"
        options={cameras.map((c) => ({ value: c.deviceId, label: c.label || "Camera" }))}
        value={camera ?? cameras[0]?.deviceId ?? ""}
        opens="up"
        look="glass"
        disabled={busy}
        closed={listClosed}
        onOpenChange={(open) => {
          if (open) setListClosed(false);
          onMenuChange?.(open);
        }}
        onChange={onPickCamera}
      />
    );

  return (
    <DropUp
      label={LABEL[kind].quick}
      enabled={live && (kind === "screen" || cameras.length > 0)}
      width={kind === "screen" ? 228 : 210}
      onLeave={() => setListClosed(true)}
      trigger={button}
    >
      {quick}
    </DropUp>
  );
}

/** The design's icons: plain while live; crossed while off, the screen showing "share" on hover and focus. */
function Icon({ kind, off }: { kind: StreamKind; off: boolean }) {
  if (kind === "camera") return off ? <CameraOffIcon /> : <CameraOnIcon />;
  if (!off) return <ScreenOnIcon />;
  return (
    <>
      <span className={round.iconRest}>
        <ScreenOffIcon />
      </span>
      <span className={round.iconHover}>
        <ScreenShareIcon />
      </span>
    </>
  );
}

