import { useEffect, useState } from "react";
import type { Friend } from "../../types";
import { Button } from "../ui/Button";
import { SourcePicker } from "./SourcePicker";
import { TakeoverConfirm } from "./TakeoverConfirm";
import styles from "./ShareControls.module.css";

type Props = {
  sharer: Friend | null;
  isMeSharing: boolean;
  onStart: () => void;
  onTake: () => void;
  onStop: () => void;
};

type Step = "idle" | "confirmTakeover" | "picking";

/**
 * The one control that matters: share, take over, or stop.
 * Taking the screen from someone asks first, then opens the source picker.
 */
export function ShareControls({ sharer, isMeSharing, onStart, onTake, onStop }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const someoneElseSharing = sharer !== null && !isMeSharing;

  // If the sharer stops while you're confirming, there's nothing left to take over.
  useEffect(() => {
    if (step === "confirmTakeover" && !someoneElseSharing) setStep("idle");
  }, [step, someoneElseSharing]);

  const finishPicking = () => {
    setStep("idle");
    if (someoneElseSharing) onTake();
    else onStart();
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
          <Button variant="danger" onClick={onStop}>
            Stop sharing
          </Button>
        ) : someoneElseSharing ? (
          <Button variant="ghost" onClick={() => setStep("confirmTakeover")} disabled={step !== "idle"}>
            Take the screen
          </Button>
        ) : (
          <Button onClick={() => setStep("picking")} disabled={step !== "idle"}>
            Share my screen
          </Button>
        )}
      </div>

      {step === "confirmTakeover" && sharer && (
        <TakeoverConfirm
          sharerName={sharer.name}
          onConfirm={() => setStep("picking")}
          onCancel={() => setStep("idle")}
        />
      )}

      {step === "picking" && <SourcePicker onPick={finishPicking} onCancel={() => setStep("idle")} />}
    </section>
  );
}
