import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { ScreenSurface } from "../../hooks/useLiveKitRoom";
import type { SharePrefs } from "../../media/preferences";
import { CAMERA_QUALITIES, MODE_OPTIONS, SHARE_QUALITIES, type ShareMode, type ShareQuality } from "../../media/shareSettings";
import type { CameraDevice, MediaTrack, StreamKind } from "../../types";
import { Picker } from "../ui/Picker";
import { Segmented } from "../ui/Segmented";
import { CameraOnIcon, CloseIcon, ScreenShareIcon, WindowIcon } from "./icons";
import { NO_SOUND } from "./PlayerButtons";
import { FULL_VIEW_SHEET } from "./makeRoom";
import styles from "./SettingsPanel.module.css";

/** How long it takes to slide in or out; it leaves the page once it's out. */
const PANEL_MS = 260;

const SURFACE: Record<ScreenSurface, string> = { window: "A window", browser: "A tab", monitor: "Your whole screen" };

type Tab = "screen" | "camera";

type Props = {
  /** A 300 px drawer from the stage's right edge, or a bottom sheet (a phone held upright). */
  variant: "drawer" | "sheet";
  open: boolean;
  onClose: () => void;
  /** False on a phone, or where the browser can't share a screen: only Camera. */
  screenTab: boolean;
  /** Which of my streams are live. */
  mine: Record<StreamKind, boolean>;
  prefs: Record<StreamKind, SharePrefs>;
  onPrefsChange: (kind: StreamKind, prefs: SharePrefs) => void;
  /** What my screen share shows. */
  screenSurface?: ScreenSurface;
  onChangeWindow: () => void;
  cameras: CameraDevice[];
  cameraId: string | null;
  onPickCamera: (deviceId: string) => void;
  /** My camera: the one being sent, or the preview's. */
  cameraVideo?: MediaTrack;
  /** Turns the camera on for the preview only, or off again. */
  onPreviewCamera: (on: boolean) => void;
  busy?: boolean;
  /** I'm sharing my screen without sound: the Screen tab says how to share it. */
  noSound?: boolean;
  /** The sheet in the upright full-screen view: a little shorter, so the player can fit above it. */
  fullView?: boolean;
};

/**
 * The settings for what I send (spec 0107): tabs Screen and Camera, a red marker sliding to
 * the chosen one and a red dot on what's live. Changes apply at once and are remembered. The
 * Camera tab shows my camera; while it's off, only I see it, and only while the tab is open.
 */
export function SettingsPanel(props: Props) {
  const { variant, open, onClose, screenTab, mine, onPreviewCamera } = props;
  const tabs: Tab[] = screenTab ? ["screen", "camera"] : ["camera"];
  const [chosen, setTab] = useState<Tab>(tabs[0]);
  const tab = tabs.includes(chosen) ? chosen : tabs[0];
  const ids = useId();

  // In the page while open, and for its slide out after.
  const [present, setPresent] = useState(open);
  const [shown, setShown] = useState(false);
  if (open && !present) setPresent(true);
  if (!open && shown) setShown(false);
  useEffect(() => {
    if (open) {
      const next = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(next);
    }
    const gone = window.setTimeout(() => setPresent(false), PANEL_MS);
    return () => window.clearTimeout(gone);
  }, [open]);

  // The camera's preview: on only while the Camera tab is open and the camera isn't live.
  const wantPreview = open && tab === "camera" && !mine.camera;
  const previewing = useRef(false);
  const preview = useRef(onPreviewCamera);
  useEffect(() => {
    preview.current = onPreviewCamera;
  });
  useEffect(() => {
    if (wantPreview === previewing.current) return;
    previewing.current = wantPreview;
    preview.current(wantPreview);
  }, [wantPreview]);
  useEffect(
    () => () => {
      if (previewing.current) preview.current(false);
    },
    [],
  );

  if (!present) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };
  const tabId = (t: Tab) => `${ids}-${t}`;

  return (
    <div
      className={styles.panel}
      role="dialog"
      aria-label="Settings"
      data-variant={variant}
      style={props.fullView ? ({ "--sheet-height": `${FULL_VIEW_SHEET * 100}%` } as CSSProperties) : undefined}
      data-open={shown || undefined}
      inert={!open || undefined}
      onKeyDown={onKeyDown}
      data-no-swipe
    >
      <div className={styles.head}>
        <h2>Settings</h2>
        <button type="button" className={styles.close} aria-label="Close settings" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div
        className={styles.tabs}
        role="tablist"
        style={{ "--n": tabs.length, "--i": tabs.indexOf(tab) } as CSSProperties}
      >
        <span className={styles.marker} aria-hidden="true" />
        {tabs.map((t) => (
          <button
            key={t}
            id={tabId(t)}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={t === tab}
            aria-controls={`${tabId(t)}-panel`}
            onClick={() => setTab(t)}
          >
            {t === "screen" ? <ScreenShareIcon /> : <CameraOnIcon />}
            {t === "screen" ? "Screen" : "Camera"}
            {mine[t] && <span className={styles.dot} data-live aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div id={`${tabId(tab)}-panel`} role="tabpanel" aria-labelledby={tabId(tab)} className={styles.body}>
        {tab === "screen" ? <ScreenTab {...props} /> : <CameraTab {...props} />}
      </div>
    </div>
  );
}

function QualityAndMode({ kind, prefs, onPrefsChange, busy }: { kind: StreamKind } & Pick<Props, "prefs" | "onPrefsChange" | "busy">) {
  const mine = prefs[kind];
  const qualities = (kind === "camera" ? CAMERA_QUALITIES : SHARE_QUALITIES).map((q) => ({ value: q.id, label: q.id }));
  const name = kind === "camera" ? "Camera" : "Screen";
  return (
    <>
      <div className={styles.group}>
        <p className={styles.heading}>Quality</p>
        <Segmented<ShareQuality>
          label={`${name} quality`}
          options={qualities}
          value={mine.quality}
          disabled={busy}
          onChange={(quality) => onPrefsChange(kind, { ...mine, quality })}
        />
      </div>
      <div className={styles.group}>
        <p className={styles.heading}>Mode</p>
        <Segmented<ShareMode>
          label={`${name} mode`}
          options={MODE_OPTIONS}
          value={mine.mode}
          disabled={busy}
          onChange={(mode) => onPrefsChange(kind, { ...mine, mode })}
        />
      </div>
    </>
  );
}

function ScreenTab(props: Props) {
  const { mine, screenSurface, onChangeWindow, busy, noSound } = props;
  return (
    <>
      {mine.screen ? (
        <div className={styles.group}>
          <p className={styles.heading}>Window</p>
          <div className={styles.fieldRow}>
            <span className={styles.source}>
              <WindowIcon />
              <span>{screenSurface ? SURFACE[screenSurface] : "Your screen"}</span>
            </span>
            <button
              type="button"
              className={styles.button}
              title="Pick another window or tab; viewers keep watching the same stream"
              disabled={busy}
              onClick={onChangeWindow}
            >
              Change
            </button>
          </div>
          {noSound && <p className={styles.hint}>{NO_SOUND}</p>}
        </div>
      ) : (
        <p className={styles.hint}>
          You're not sharing. These are used the next time you do; the browser shows a preview when you pick what to
          share.
        </p>
      )}
      <QualityAndMode kind="screen" {...props} />
    </>
  );
}

function CameraTab(props: Props) {
  const { mine, cameras, cameraId, onPickCamera, cameraVideo, busy } = props;
  return (
    <>
      <div className={styles.preview}>
        <Preview video={cameraVideo} />
        {mine.camera ? <span className={styles.live}>LIVE</span> : <span className={styles.badge}>Only you see this</span>}
      </div>
      {cameras.length > 0 && (
        <div className={styles.group}>
          <p className={styles.heading}>Camera</p>
          <Picker
            label="Camera"
            options={cameras.map((c) => ({ value: c.deviceId, label: c.label || "Camera" }))}
            value={cameraId ?? cameras[0].deviceId}
            disabled={busy}
            onChange={onPickCamera}
          />
        </div>
      )}
      <QualityAndMode kind="camera" {...props} />
    </>
  );
}

/** My camera, as it is sent. */
function Preview({ video }: { video?: MediaTrack }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !video) return;
    video.attach(el);
    return () => {
      video.detach(el);
    };
  }, [video]);
  return <video ref={ref} className={styles.video} autoPlay playsInline muted disablePictureInPicture aria-label="Your camera" />;
}
