import { useEffect, useId, useRef } from "react";
import { showToast } from "../ui/toast";
import { VolumeIcon, VolumeOffIcon } from "./icons";
import round from "./RoundButton.module.css";
import styles from "./VolumeButton.module.css";
import { VolumeMixer, type Channel } from "./VolumeMixer";

type Props = {
  /** The sounds of the stream watched, in the mixer's fixed order (spec 0108). */
  channels: Channel[];
  /** False where the page can't set the volume (iPhones and iPads): on/off only. */
  canSetVolume: boolean;
  /** The mixer, open over the button; the stage owns it, so the settings can close it. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** When none of the stream's sounds can be heard (spec 0098 FR-15). */
export const NO_SOUND_HERE = "No sound in this stream";

/**
 * The viewer's volume, as a round button (specs 0101 and 0108): a click, tap or Enter opens
 * the mixer over it, and closes it; it never mutes. Crossed when every sound you can hear is
 * muted; crossed and locked when there's none. Only changes this browser.
 */
export function VolumeButton({ channels, canSetVolume, open, onOpenChange }: Props) {
  const control = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const tipId = useId();
  const heard = channels.filter((c) => !c.unavailable);
  const locked = heard.length === 0;
  const shown = open && !locked;
  // Closing with the focus inside (4 s idle, Escape) gives it back to the button.
  const close = () => {
    if (control.current?.contains(document.activeElement) && document.activeElement !== button.current) button.current?.focus();
    onOpenChange(false);
  };

  // A press anywhere else closes it (the button's own press toggles it).
  useEffect(() => {
    if (!shown) return;
    const outside = (e: PointerEvent) => {
      if (!control.current?.contains(e.target as Node)) onOpenChange(false);
    };
    // Escape closes it wherever the focus is (a touch or Safari's click focuses nothing).
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (control.current?.contains(document.activeElement)) button.current?.focus();
      onOpenChange(false);
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape);
    };
  }, [shown, onOpenChange]);

  const silent = locked || heard.every((c) => c.muted || c.volume === 0);
  const label = locked ? NO_SOUND_HERE : silent ? "Volume, all muted" : "Volume";
  const pointer = useRef("");

  return (
    <div ref={control} className={styles.control}>
      <div className={`${round.pill} ${locked ? round.disabled : ""}`} data-open={shown || undefined}>
        <button
          ref={button}
          type="button"
          className={round.main}
          aria-label={label}
          aria-disabled={locked || undefined}
          aria-expanded={locked ? undefined : shown}
          aria-describedby={tipId}
          onPointerDown={(e) => {
            pointer.current = e.pointerType;
          }}
          onClick={() => {
            const touched = pointer.current === "touch" || pointer.current === "pen";
            pointer.current = "";
            if (!locked) onOpenChange(!shown);
            else if (touched) showToast(NO_SOUND_HERE, <VolumeOffIcon />);
          }}
        >
          {silent ? <VolumeOffIcon /> : <VolumeIcon />}
        </button>
        <span id={tipId} role="tooltip" className={round.tip}>
          {label}
        </span>
      </div>
      {/* After the button, so Tab goes button, then the mixer. */}
      {!locked && <VolumeMixer channels={channels} canSetVolume={canSetVolume} open={shown} onClose={close} />}
    </div>
  );
}
