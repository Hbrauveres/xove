import { useEffect, useState } from "react";
import type { SharePrefs } from "../../media/preferences";
import { SHARE_QUALITIES, type ShareMode, type ShareQuality } from "../../media/shareSettings";
import type { Friend } from "../../types";
import { Button } from "../ui/Button";
import { TakeoverConfirm } from "./TakeoverConfirm";
import styles from "./ShareControls.module.css";

type Props = {
  sharer: Friend | null;
  isMeSharing: boolean;
  onStart: () => void;
  onTake: () => void;
  onStop: () => void;
  /** The quality and mode my screen is (or will be) sent with. */
  prefs: SharePrefs;
  onPrefsChange: (prefs: SharePrefs) => void;
  /** I'm sharing, but my browser gave no sound. */
  noSound?: boolean;
  /** A request is on its way: buttons wait. */
  busy?: boolean;
};

const MODES: { id: ShareMode; label: string }[] = [
  { id: "smooth", label: "Smooth (games, videos)" },
  { id: "sharp", label: "Sharp (text, code)" },
];

type Step = "idle" | "confirmTakeover";

/**
 * The one control that matters: share, take over, or stop.
 * Taking the screen from someone asks first; then the browser's own picker opens.
 */
export function ShareControls({
  sharer,
  isMeSharing,
  onStart,
  onTake,
  onStop,
  prefs,
  onPrefsChange,
  noSound = false,
  busy = false,
}: Props) {
  const [step, setStep] = useState<Step>("idle");
  const someoneElseSharing = sharer !== null && !isMeSharing;

  // If the sharer stops while you're confirming, there's nothing left to take over.
  useEffect(() => {
    if (step === "confirmTakeover" && !someoneElseSharing) setStep("idle");
  }, [step, someoneElseSharing]);

  const confirmTakeover = () => {
    setStep("idle");
    onTake();
  };

  return (
    <section className={styles.controls} aria-label="Screen sharing">
      <div className={styles.row}>
        <p className={styles.hint}>
          {isMeSharing
            ? "Everyone here can see your screen. Changing the quality reloads it for a second."
            : someoneElseSharing
              ? `Want the stage? Taking it stops ${sharer.name}'s share.`
              : "The stage is free. Share a screen, window or tab."}
        </p>

        <div className={styles.settings}>
          <label className={styles.setting}>
            <span>Quality</span>
            <select
              value={prefs.quality}
              disabled={busy}
              onChange={(e) => onPrefsChange({ ...prefs, quality: e.target.value as ShareQuality })}
            >
              {SHARE_QUALITIES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.id} · {q.fps} fps
                </option>
              ))}
            </select>
          </label>
          <label className={styles.setting}>
            <span>Mode</span>
            <select
              value={prefs.mode}
              disabled={busy}
              onChange={(e) => onPrefsChange({ ...prefs, mode: e.target.value as ShareMode })}
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isMeSharing ? (
          <Button variant="danger" onClick={onStop} disabled={busy}>
            Stop sharing
          </Button>
        ) : someoneElseSharing ? (
          <Button variant="ghost" onClick={() => setStep("confirmTakeover")} disabled={busy || step !== "idle"}>
            Take the screen
          </Button>
        ) : (
          <Button onClick={onStart} disabled={busy}>
            Share my screen
          </Button>
        )}
      </div>

      {isMeSharing && noSound && (
        <p className={styles.notice} role="status">
          No sound is being shared. To share sound, share a browser tab (or your whole screen on Windows) and tick
          "Share audio" in the picker. Firefox and Safari can't share sound.
        </p>
      )}

      {step === "confirmTakeover" && sharer && (
        <TakeoverConfirm
          sharerName={sharer.name}
          onConfirm={confirmTakeover}
          onCancel={() => setStep("idle")}
        />
      )}
    </section>
  );
}
