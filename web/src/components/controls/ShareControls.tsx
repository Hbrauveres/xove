import { useEffect, useState } from "react";
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
  /** A request is on its way: buttons wait. */
  busy?: boolean;
};

type Step = "idle" | "confirmTakeover";

/**
 * The one control that matters: share, take over, or stop.
 * Taking the screen from someone asks first; then the browser's own picker opens.
 */
export function ShareControls({ sharer, isMeSharing, onStart, onTake, onStop, busy = false }: Props) {
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
            ? "Everyone here can see your screen."
            : someoneElseSharing
              ? `Want the stage? Taking it stops ${sharer.name}'s share.`
              : "The stage is free. Share a screen, window or tab."}
        </p>

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
