import { Button } from "../ui/Button";
import styles from "./TakeoverConfirm.module.css";

type Props = {
  sharerName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Inline "are you sure" before stealing the stage. Version 1 policy: steal. */
export function TakeoverConfirm({ sharerName, onConfirm, onCancel }: Props) {
  return (
    <div className={styles.box} role="alertdialog" aria-labelledby="takeover-title">
      <p id="takeover-title" className={styles.text}>
        <strong>{sharerName}</strong> is sharing right now. If you take the screen, their share stops and
        everyone sees yours.
      </p>
      <div className={styles.actions}>
        <Button size="sm" onClick={onConfirm}>
          Take the screen
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Keep watching
        </Button>
      </div>
    </div>
  );
}
