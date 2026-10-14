import { useRef } from "react";
import type { MediaTrack } from "../../types";
import { ScreenVideo } from "./ScreenVideo";
import styles from "./Facecam.module.css";

/** Where the facecam sits over the player: its top-left corner, as fractions of the player (0 to 1). */
export type FacecamPlace = { x: number; y: number };

type Props = {
  video?: MediaTrack;
  label: string;
  place: FacecamPlace;
  collapsed: boolean;
  /** Puts this video in the big player, and the big one here. */
  onSwap: () => void;
  onMove: (place: FacecamPlace) => void;
  onCollapse: (collapsed: boolean) => void;
};

/** How far an arrow key moves the facecam. */
const STEP = 0.05;

const round = (n: number) => Math.round(n * 10000) / 10000;
const clamp = (n: number, max: number) => round(Math.min(Math.max(n, 0), Math.max(max, 0)));

/**
 * The small window over the big player when someone shares their screen and their
 * camera together (spec 0060): their camera over the screen, or the other way round.
 * Drag it (or move it with the arrow keys) wherever it bothers least, collapse it to a
 * tab, or swap it with the big video with its button.
 */
export function Facecam({ video, label, place, collapsed, onSwap, onMove, onCollapse }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; from: FacecamPlace } | null>(null);

  /** The furthest the facecam can go and still be whole inside the player. */
  const limits = () => {
    const box = boxRef.current;
    const player = box?.parentElement?.getBoundingClientRect();
    const own = box?.getBoundingClientRect();
    if (!player || !own || player.width === 0 || player.height === 0) return null;
    return { player, maxX: 1 - own.width / player.width, maxY: 1 - own.height / player.height };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Its buttons are buttons, not handles.
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, from: place };
    boxRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = drag.current;
    const room = limits();
    if (!start || start.pointerId !== e.pointerId || !room) return;
    onMove({
      x: clamp(start.from.x + (e.clientX - start.x) / room.player.width, room.maxX),
      y: clamp(start.from.y + (e.clientY - start.y) / room.player.height, room.maxY),
    });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    boxRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== boxRef.current) return;
    const room = limits();
    if (!room) return;
    const moves: Record<string, FacecamPlace> = {
      ArrowLeft: { x: place.x - STEP, y: place.y },
      ArrowRight: { x: place.x + STEP, y: place.y },
      ArrowUp: { x: place.x, y: place.y - STEP },
      ArrowDown: { x: place.x, y: place.y + STEP },
    };
    const next = moves[e.key];
    if (!next) return;
    e.preventDefault();
    onMove({ x: clamp(next.x, room.maxX), y: clamp(next.y, room.maxY) });
  };

  if (collapsed) {
    return (
      <button type="button" className={styles.tab} onClick={() => onCollapse(false)} aria-label="Show facecam" title="Show facecam">
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <rect x="3" y="5" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M13 9l4-2v6l-4-2z" fill="currentColor" />
        </svg>
      </button>
    );
  }

  return (
    <div
      ref={boxRef}
      data-facecam=""
      // Its own drag, never a swipe of the stage (spec 0159).
      data-no-swipe
      className={styles.facecam}
      style={{ left: `${place.x * 100}%`, top: `${place.y * 100}%` }}
      tabIndex={0}
      aria-roledescription="facecam"
      aria-label={`${label}: drag or use the arrow keys to move it`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <ScreenVideo video={video} label={label} />
      <div className={styles.controls}>
        <button type="button" className={styles.button} onClick={onSwap} aria-label="Swap views" title="Swap views">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path
              d="M4 7h11M12 4l3 3-3 3M16 13H5M8 10l-3 3 3 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => onCollapse(true)}
          aria-label="Hide facecam"
          title="Hide facecam"
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path d="M5 10h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
