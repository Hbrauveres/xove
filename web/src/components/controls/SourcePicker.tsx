import { useState } from "react";
import { Button } from "../ui/Button";
import styles from "./SourcePicker.module.css";

type Props = {
  onPick: () => void;
  onCancel: () => void;
};

const SOURCES = [
  { id: "screen", label: "Entire screen", detail: "Monitor 1 · 1920×1080" },
  { id: "window", label: "Window", detail: "Any open app" },
  { id: "tab", label: "Browser tab", detail: "Can include the tab's sound" },
] as const;

/**
 * Stand-in for the browser's own picker. In the real app you call
 * getDisplayMedia() (via LiveKit's setScreenShareEnabled) and the browser
 * shows its native dialog; this page can't, so the choice is simulated.
 */
export function SourcePicker({ onPick, onCancel }: Props) {
  const [choice, setChoice] = useState<string>("screen");

  return (
    <div className={styles.picker} role="dialog" aria-labelledby="picker-title">
      <div className={styles.head}>
        <p id="picker-title" className={styles.title}>
          Choose what to share
        </p>
        <span className={styles.badge}>Browser dialog, simulated</span>
      </div>

      <div className={styles.options} role="radiogroup" aria-label="Share source">
        {SOURCES.map((s) => (
          <label key={s.id} className={`${styles.option} ${choice === s.id ? styles.selected : ""}`}>
            <input
              id={`source-${s.id}`}
              type="radio"
              name="share-source"
              value={s.id}
              checked={choice === s.id}
              onChange={() => setChoice(s.id)}
            />
            <span className={styles.preview} aria-hidden="true" data-kind={s.id} />
            <span className={styles.label}>{s.label}</span>
            <span className={styles.detail}>{s.detail}</span>
          </label>
        ))}
      </div>

      <div className={styles.actions}>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onPick}>
          Share
        </Button>
      </div>
    </div>
  );
}
