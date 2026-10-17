import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Range } from "../ui/Range";
import { showToast } from "../ui/toast";
import { MicIcon, MicOffIcon, SoundIcon, VolumeOffIcon } from "./icons";
import styles from "./VolumeMixer.module.css";

export type ChannelSound = { volume: number; muted: boolean };

/**
 * One sound in the mixer. The list is fixed (the screen's sound, then the voice): a sound
 * that can't be heard keeps its place, greyed, with `unavailable` saying why (round 113).
 */
export type Channel = ChannelSound & {
  id: "screen" | "voice";
  label: string;
  unavailable?: string;
  onChange?: (sound: ChannelSound) => void;
};

/** Before #101 there's no voice to hear. */
export const NO_VOICE_YET = "No voice yet";

/** The mixer closes by itself after this long without a touch inside (design decision 3). */
export const MIXER_IDLE_MS = 4000;

type Props = {
  channels: Channel[];
  /** False where the page can't set a volume (iPhones and iPads): round on/off buttons only. */
  canSetVolume: boolean;
  open: boolean;
  onClose: () => void;
};

const ICONS = {
  screen: { on: <SoundIcon />, off: <VolumeOffIcon /> },
  voice: { on: <MicIcon />, off: <MicOffIcon /> },
};

/**
 * The viewer's mixer (spec 0108): a slim frosted panel that unrolls upward over the volume
 * button, an upright bar per sound with a round mute under it. Muting never closes it; 4 s
 * without a touch inside does. Only changes this browser.
 */
export function VolumeMixer({ channels, canSetVolume, open, onClose }: Props) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  const idle = useRef<number | undefined>(undefined);
  const restart = useCallback(() => {
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => close.current(), MIXER_IDLE_MS);
  }, []);
  useEffect(() => {
    if (!open) return;
    restart();
    return () => window.clearTimeout(idle.current);
  }, [open, restart]);

  // A greyed sound says why: by touch in the toast (a mouse has the tooltip).
  const pointer = useRef("");
  const onPointerDown = (e: ReactPointerEvent) => {
    pointer.current = e.pointerType;
  };

  return (
    <div
      className={styles.mixer}
      role="group"
      aria-label="Volume"
      data-open={open || undefined}
      data-pill={!canSetVolume || undefined}
      inert={!open}
      // Any touch, drag or key inside keeps it open for another 4 s.
      onPointerDownCapture={restart}
      onPointerMoveCapture={open ? restart : undefined}
      onKeyDownCapture={restart}
      onChangeCapture={restart}
    >
      <div className={styles.inner}>
        {channels.map((c) => {
          // Crossed when it can't be heard: muted, at zero, or not there (as the volume button).
          const silent = Boolean(c.unavailable) || c.muted || (canSetVolume && c.volume === 0);
          const icon = silent ? ICONS[c.id].off : ICONS[c.id].on;
          const toggle = () => {
            const touched = pointer.current === "touch" || pointer.current === "pen";
            pointer.current = "";
            if (c.unavailable) {
              if (touched) showToast(c.unavailable, ICONS[c.id].off);
              return;
            }
            c.onChange?.({ volume: c.volume, muted: !c.muted });
          };
          return (
            <div
              key={c.id}
              className={styles.channel}
              data-channel={c.id}
              data-unavailable={c.unavailable ? true : undefined}
              data-muted={c.muted || undefined}
              title={c.unavailable}
            >
              {canSetVolume &&
                (c.unavailable ? (
                  <span className={styles.bar} aria-hidden="true">
                    <span className={styles.empty} />
                  </span>
                ) : (
                  <span className={styles.bar}>
                    <Range
                      className={styles.range}
                      min={0}
                      max={1}
                      step={0.05}
                      aria-label={`${c.label} volume`}
                      aria-orientation="vertical"
                      value={c.volume}
                      // Moving the bar means "I want to hear it": it also unmutes.
                      onChange={(e) => c.onChange?.({ volume: Number(e.target.value), muted: false })}
                    />
                  </span>
                ))}
              <button
                type="button"
                className={styles.mute}
                // One name; pressed means muted, in the mixer and in the iPhone's pill alike.
                aria-label={c.unavailable ? `${c.label}: ${c.unavailable}` : `Mute ${c.label}`}
                aria-pressed={c.unavailable ? undefined : c.muted}
                aria-disabled={c.unavailable ? true : undefined}
                onPointerDown={onPointerDown}
                onClick={toggle}
              >
                {icon}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
