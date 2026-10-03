import type { SharePrefs } from "../../media/preferences";
import { SHARE_QUALITIES, type ShareMode, type ShareQuality } from "../../media/shareSettings";
import styles from "./ShareSettingsFields.module.css";

type Props = {
  prefs: SharePrefs;
  onChange: (prefs: SharePrefs) => void;
  disabled?: boolean;
  /** "bar": compact, over the player. "form": in the setup window. */
  look?: "bar" | "form";
};

const MODES: { id: ShareMode; label: string }[] = [
  { id: "smooth", label: "Smooth (games, videos)" },
  { id: "sharp", label: "Sharp (text, code)" },
];

/** The sharer's two choices: the best quality viewers can get, and motion or detail first. */
export function ShareSettingsFields({ prefs, onChange, disabled = false, look = "form" }: Props) {
  return (
    <div className={`${styles.fields} ${styles[look]}`}>
      <label className={styles.field}>
        <span>Send quality</span>
        <select
          value={prefs.quality}
          disabled={disabled}
          onChange={(e) => onChange({ ...prefs, quality: e.target.value as ShareQuality })}
        >
          {SHARE_QUALITIES.map((q) => (
            <option key={q.id} value={q.id}>
              {q.id} · {q.fps} fps
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Mode</span>
        <select
          value={prefs.mode}
          disabled={disabled}
          onChange={(e) => onChange({ ...prefs, mode: e.target.value as ShareMode })}
        >
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
