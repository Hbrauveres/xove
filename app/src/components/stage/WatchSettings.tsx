import { useEffect, useId, useRef, useState } from "react";
import type { WatchPrefs, WatchQuality } from "../../media/preferences";
import { effectiveQuality, viewerQualities } from "../../media/shareSettings";
import { MenuGroup, MenuRadio, PlayerMenu } from "./PlayerMenu";
import round from "./RoundButton.module.css";
import { CogIcon } from "./icons";
import styles from "./WatchSettings.module.css";

type Props = {
  /** Height of the sharer's best layer, to know which qualities exist. */
  sharerHeight: number;
  /** How many qualities the sharer sends, when known. */
  layers?: number;
  /** The sharer's chosen quality: nothing above it is offered. */
  cap?: "1080p" | "720p" | "480p";
  prefs: WatchPrefs;
  onChange: (prefs: WatchPrefs) => void;
  /** The menu opened or closed: the player keeps its controls shown while it's open. */
  onOpenChange?: (open: boolean) => void;
};

/**
 * The viewer's settings, as a round gear button (spec 0101): the quality they watch,
 * Auto or a fixed one (spec 0086 FR-9). Only changes this browser.
 */
export function WatchSettings({ sharerHeight, layers, cap, prefs, onChange, onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const control = useRef<HTMLDivElement>(null);
  const gear = useRef<HTMLButtonElement>(null);
  const tipId = useId();
  const menuId = useId();
  // Also when it goes away while open (the stream stops), so the player doesn't stay held.
  useEffect(() => {
    onOpenChange?.(open);
    return () => onOpenChange?.(false);
  }, [open, onOpenChange]);

  const qualities = viewerQualities(sharerHeight, layers, cap);
  const current = effectiveQuality(prefs.quality, qualities);
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) gear.current?.focus();
  };
  const pick = (quality: WatchQuality) => {
    onChange({ ...prefs, quality });
    close(true);
  };

  return (
    <div ref={control} className={styles.control}>
      <div className={round.pill} data-open={open || undefined}>
        <button
          ref={gear}
          type="button"
          className={round.main}
          aria-label="Settings"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-describedby={tipId}
          onClick={() => setOpen(!open)}
        >
          <CogIcon />
        </button>
        <span id={tipId} role="tooltip" className={round.tip}>
          Settings
        </span>
      </div>

      {open && (
        <PlayerMenu id={menuId} label="Settings" anchor={control} onClose={close}>
          <MenuGroup label="Quality">
            <MenuRadio checked={current === "auto"} onSelect={() => pick("auto")}>
              Auto
            </MenuRadio>
            {qualities.map((q) => (
              <MenuRadio key={q} checked={current === q} onSelect={() => pick(q)}>
                {q}
              </MenuRadio>
            ))}
          </MenuGroup>
        </PlayerMenu>
      )}
    </div>
  );
}
