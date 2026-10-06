import { useEffect, useId, useRef, useState } from "react";
import type { WatchPrefs } from "../../media/preferences";
import round from "./RoundButton.module.css";
import styles from "./VolumeButton.module.css";

type Props = {
  prefs: WatchPrefs;
  onChange: (prefs: WatchPrefs) => void;
  /** False for a stream without sound: crossed, disabled, no slider (spec 0098 FR-15). */
  hasSound: boolean;
  /** False where the page can't set the volume (iPhones and iPads): mute only. */
  canSetVolume: boolean;
  /** The slider opened or closed: the player keeps its controls shown while it's open. */
  onOpenChange?: (open: boolean) => void;
};

/** How long the slider waits after the pointer leaves, so the pointer can travel to it. */
const LEAVE_MS = 150;

/**
 * The viewer's volume, as a round button (spec 0101): a click mutes or unmutes; pointing
 * at it or focusing it slides a vertical slider up above it. Only changes this browser.
 */
export function VolumeButton({ prefs, onChange, hasSound, canSetVolume, onOpenChange }: Props) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const control = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  // A click focuses the button too: only keyboard focus opens the slider, so after a
  // click it still goes when the pointer leaves.
  const pressing = useRef(false);
  const tipId = useId();
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  // No slider while muted, without sound, or where the volume can't be set.
  const canSlide = hasSound && !prefs.muted && canSetVolume;
  const open = canSlide && (hovered || focused);
  // Also when it goes away while open (the stream stops), so the player doesn't stay held.
  useEffect(() => {
    onOpenChange?.(open);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);

  const silent = !hasSound || prefs.muted || prefs.volume === 0;
  const label = !hasSound ? "No sound in this stream" : prefs.muted ? "Unmute" : "Mute";

  return (
    <div
      ref={control}
      className={styles.control}
      onPointerEnter={() => {
        window.clearTimeout(leaveTimer.current);
        setHovered(true);
      }}
      onPointerLeave={() => {
        window.clearTimeout(leaveTimer.current);
        leaveTimer.current = window.setTimeout(() => setHovered(false), LEAVE_MS);
      }}
      onPointerDown={() => {
        pressing.current = true;
      }}
      onPointerUp={() => {
        pressing.current = false;
      }}
      onFocus={() => {
        if (!pressing.current) setFocused(true);
      }}
      onBlur={(e) => {
        if (!control.current?.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className={`${round.pill} ${hasSound ? "" : round.disabled}`} data-open={open || undefined}>
        <button
          type="button"
          className={round.main}
          aria-label={label}
          aria-disabled={!hasSound || undefined}
          aria-describedby={tipId}
          onClick={() => {
            if (hasSound) onChange({ ...prefs, muted: !prefs.muted });
          }}
        >
          <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
            <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
            {silent ? (
              <path d="M13 8l4 4M17 8l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path
                d="M13 7.5a3.5 3.5 0 0 1 0 5M15 5a7 7 0 0 1 0 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
        <span id={tipId} role="tooltip" className={round.tip}>
          {label}
        </span>
      </div>

      {/* After the button, so Tab goes button, then slider. */}
      {canSlide && (
        <div className={styles.popup} data-open={open || undefined} inert={!open}>
          <input
            className={styles.slider}
            type="range"
            min={0}
            max={1}
            step={0.05}
            aria-label="Volume"
            aria-orientation="vertical"
            value={prefs.volume}
            // Moving the slider means "I want to hear it": it also unmutes.
            onChange={(e) => onChange({ ...prefs, volume: Number(e.target.value), muted: false })}
          />
        </div>
      )}
    </div>
  );
}
