import type { SharePrefs } from "../../media/preferences";
import { CAMERA_QUALITIES, SHARE_QUALITIES, type ShareMode, type ShareQuality } from "../../media/shareSettings";
import type { StreamKind } from "../../types";
import styles from "./ShareSettingsFields.module.css";

type Props = {
  /** A camera goes up to 720p (spec 0060). */
  kind?: StreamKind;
  prefs: SharePrefs;
  onChange: (prefs: SharePrefs) => void;
  disabled?: boolean;
  /** "bar": compact, over the player. "form": in the setup window. */
  look?: "bar" | "form";
  /** Names the fields when two sets show together: "Camera" gives "Camera quality" and "Camera mode". */
  name?: string;
};

const MODES: { id: ShareMode; label: string }[] = [
  { id: "smooth", label: "Smooth (games, videos)" },
  { id: "sharp", label: "Sharp (text, code)" },
];

/** The sharer's two choices: the best quality viewers can get, and motion or detail first. */
export function ShareSettingsFields({ kind = "screen", prefs, onChange, disabled = false, look = "form", name }: Props) {
  const qualities = kind === "camera" ? CAMERA_QUALITIES : SHARE_QUALITIES;
  return (
    <div className={`${styles.fields} ${styles[look]}`}>
      <label className={styles.field}>
        <span>{name ? `${name} quality` : "Send quality"}</span>
        <select
          value={prefs.quality}
          disabled={disabled}
          onChange={(e) => onChange({ ...prefs, quality: e.target.value as ShareQuality })}
        >
          {qualities.map((q) => (
            <option key={q.id} value={q.id}>
              {q.id} · {q.fps} fps
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>{name ? `${name} mode` : "Mode"}</span>
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
