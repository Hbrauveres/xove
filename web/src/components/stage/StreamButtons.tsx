import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { SharePrefs } from "../../media/preferences";
import { CAMERA_QUALITIES, SHARE_QUALITIES } from "../../media/shareSettings";
import type { CameraDevice, StreamKind } from "../../types";
import { MODES } from "../share/ShareSettingsFields";
import styles from "./StreamButtons.module.css";

export const FULL_ROOM = "6 streams are live, the most at once. You can start yours when one stops.";
export const NO_SOUND =
  "No sound is being shared. Share a tab, or a window with “Share this app's audio too”, from Change window.";

type Props = {
  /** Which of my streams are live. */
  mine: Record<StreamKind, boolean>;
  /** Stream places left of the 6. */
  free: number;
  /** My quality and mode for each of my streams. */
  prefs: Record<StreamKind, SharePrefs>;
  /** The browser's cameras, and the one in use. */
  cameras: CameraDevice[];
  camera: string | null;
  /** False where the browser can't share a screen (phones). */
  canShareScreen: boolean;
  /** I'm sharing my screen, but my browser gave no sound. */
  noSound?: boolean;
  /** A request is on its way: the buttons wait. */
  busy?: boolean;
  onStart: (kind: StreamKind) => void;
  onStop: (kind: StreamKind) => void;
  onPrefsChange: (kind: StreamKind, prefs: SharePrefs) => void;
  onChangeWindow: () => void;
  onPickCamera: (deviceId: string) => void;
  /** A menu opened or closed: the player keeps its controls shown while one is open. */
  onMenuChange?: (open: boolean) => void;
};

/** What the stage passes on to the buttons: everything but the menu's state. */
export type StreamControls = Omit<Props, "onMenuChange">;

const LABEL: Record<StreamKind, { start: string; stop: string; options: string }> = {
  screen: {
    start: "Share your screen",
    stop: "Stop sharing",
    options: "Screen options",
  },
  camera: {
    start: "Turn on camera",
    stop: "Turn off camera",
    options: "Camera options",
  },
};

/**
 * My screen and camera, as round buttons over the bottom of the stage, like Discord's
 * (spec 0098). A click starts or stops; while live, the arrow opens that stream's menu.
 */
export function StreamButtons(props: Props) {
  const { mine, canShareScreen, onMenuChange } = props;
  const [picked, setPicked] = useState<StreamKind | null>(null);
  const root = useRef<HTMLDivElement>(null);
  // A stream that stops closes its menu, for good: it doesn't reopen when the stream
  // comes back (set while rendering, React's way to follow a changed prop).
  if (picked !== null && !mine[picked]) setPicked(null);
  const open = picked;
  const show = (kind: StreamKind | null) => setPicked(kind);

  // The player keeps its controls shown while a menu is open.
  useEffect(() => {
    onMenuChange?.(open !== null);
  }, [open, onMenuChange]);

  // A click anywhere else closes the menu.
  useEffect(() => {
    if (open === null) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) show(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  });

  const kinds: StreamKind[] = canShareScreen ? ["screen", "camera"] : ["camera"];
  return (
    <div className={styles.row} ref={root}>
      <div className={styles.buttons}>
        {kinds.map((kind) => (
          <StreamButton key={kind} kind={kind} {...props} open={open === kind} onOpen={(o) => show(o ? kind : null)} />
        ))}
      </div>
    </div>
  );
}

function StreamButton({
  kind,
  mine,
  free,
  prefs,
  cameras,
  camera,
  noSound = false,
  busy = false,
  onStart,
  onStop,
  onPrefsChange,
  onChangeWindow,
  onPickCamera,
  open,
  onOpen,
}: Props & {
  kind: StreamKind;
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  const live = mine[kind];
  const full = !live && free <= 0;
  const blocked = full || busy;
  const silent = kind === "screen" && live && noSound;
  const label = live ? LABEL[kind].stop : LABEL[kind].start;
  const tip = full ? FULL_ROOM : silent ? `${label}. ${NO_SOUND}` : label;
  const tipId = useId();
  const menuId = useId();
  const noteId = useId();
  const arrow = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // Opening the menu puts the keyboard on its first item.
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>("[role^=menuitem]")?.focus();
  }, [open]);

  const close = () => {
    onOpen(false);
    arrow.current?.focus();
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      onOpen(false);
    }
  };

  const qualities = kind === "camera" ? CAMERA_QUALITIES : SHARE_QUALITIES;
  const set = (next: Partial<SharePrefs>) => {
    if (!busy) onPrefsChange(kind, { ...prefs[kind], ...next });
  };

  return (
    <div className={styles.control}>
      <div
        className={`${styles.pill} ${live ? styles.live : ""} ${full ? styles.full : ""}`}
        data-open={open || undefined}
      >
        <button
          type="button"
          className={styles.main}
          aria-label={label}
          aria-pressed={live}
          aria-disabled={blocked || undefined}
          aria-describedby={tipId}
          onClick={() => {
            if (blocked) return;
            onOpen(false);
            if (live) onStop(kind);
            else onStart(kind);
          }}
        >
          <Icon kind={kind} off={!live} />
        </button>

        {live && (
          <button
            ref={arrow}
            type="button"
            className={styles.arrow}
            aria-label={LABEL[kind].options}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            onClick={() => onOpen(!open)}
          >
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path d="M3 7.5 6 4.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {silent && (
          <span className={styles.badge} role="img" aria-label="No sound">
            <svg viewBox="0 0 20 20" width="11" height="11" aria-hidden="true">
              <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
              <path d="M13 8l4 4M17 8l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        )}

        <span id={tipId} role="tooltip" className={styles.tip}>
          {tip}
        </span>
      </div>

      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={LABEL[kind].options}
          className={styles.menu}
          onKeyDown={onMenuKey}
        >
          <MenuGroup label="Quality">
            {qualities.map((q) => (
              <MenuRadio
                key={q.id}
                checked={prefs[kind].quality === q.id}
                busy={busy}
                onSelect={() => set({ quality: q.id })}
              >
                {q.id}
              </MenuRadio>
            ))}
          </MenuGroup>
          <MenuGroup label="Mode">
            {MODES.map((m) => (
              <MenuRadio
                key={m.id}
                checked={prefs[kind].mode === m.id}
                busy={busy}
                onSelect={() => set({ mode: m.id })}
              >
                {m.label}
              </MenuRadio>
            ))}
          </MenuGroup>
          <hr className={styles.separator} />
          {kind === "screen" ? (
            <>
              {silent && (
                <p id={noteId} className={styles.note} aria-hidden="true">
                  {NO_SOUND}
                </p>
              )}
              <MenuItem
                busy={busy}
                describedBy={silent ? noteId : undefined}
                onSelect={() => {
                  onOpen(false);
                  onChangeWindow();
                }}
              >
                Change window
              </MenuItem>
            </>
          ) : (
            cameras.length > 0 && (
              <>
                <MenuGroup label="Camera">
                  {cameras.map((c) => (
                    <MenuRadio
                      key={c.deviceId}
                      checked={camera === c.deviceId}
                      busy={busy}
                      onSelect={() => onPickCamera(c.deviceId)}
                    >
                      {c.label}
                    </MenuRadio>
                  ))}
                </MenuGroup>
                <hr className={styles.separator} />
              </>
            )
          )}
          <MenuItem
            danger
            busy={busy}
            onSelect={() => {
              onOpen(false);
              onStop(kind);
            }}
          >
            {LABEL[kind].stop}
          </MenuItem>
        </div>
      )}
    </div>
  );
}

/** One set of choices in a menu, named for screen readers ("Quality", "Mode", "Camera"). */
function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className={styles.heading} aria-hidden="true">
        {label}
      </p>
      {children}
    </div>
  );
}

type ItemProps = { busy: boolean; onSelect: () => void; children: string };

/** While a start, change or stop is on its way, the items wait too (FR-14). */
function MenuRadio({ checked, busy, onSelect, children }: ItemProps & { checked: boolean }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      aria-disabled={busy || undefined}
      tabIndex={-1}
      className={styles.item}
      onClick={() => !busy && onSelect()}
    >
      {children}
    </button>
  );
}

function MenuItem({
  danger = false,
  busy,
  describedBy,
  onSelect,
  children,
}: ItemProps & { danger?: boolean; describedBy?: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={busy || undefined}
      aria-describedby={describedBy}
      tabIndex={-1}
      className={`${styles.item} ${danger ? styles.danger : ""}`}
      onClick={() => !busy && onSelect()}
    >
      {children}
    </button>
  );
}

function Icon({ kind, off }: { kind: StreamKind; off: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
      {kind === "screen" ? (
        <path
          d="M3 4.5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM7 17.5h6M10 14.5v3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M3 6h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM13 9l5-3v8l-5-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
      {off && <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}
