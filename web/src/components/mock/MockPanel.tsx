import type { Session } from "../../mock/useMockSession";
import { Button } from "../ui/Button";
import styles from "./MockPanel.module.css";

type Props = {
  simulate: Session["simulate"];
  isMeSharing: boolean;
};

/**
 * Dev-only buttons that fake what other people do, so you can feel every
 * state of the app alone. Delete this component when the real backend lands.
 */
export function MockPanel({ simulate, isMeSharing }: Props) {
  return (
    <details className={styles.panel} open>
      <summary className={styles.summary}>
        <span>Simulate friends</span>
        <span className={styles.badge}>mock only</span>
      </summary>
      <div className={styles.actions}>
        <Button size="sm" variant="ghost" onClick={simulate.friendStarts}>
          A friend starts sharing
        </Button>
        <Button size="sm" variant="ghost" onClick={simulate.friendTakesFromMe} disabled={!isMeSharing}>
          A friend takes your screen
        </Button>
        <Button size="sm" variant="ghost" onClick={simulate.friendJoins}>
          A friend joins
        </Button>
        <Button size="sm" variant="ghost" onClick={simulate.friendLeaves}>
          A friend leaves
        </Button>
        <Button size="sm" variant="ghost" onClick={simulate.connectionDrop}>
          Drop my connection
        </Button>
      </div>
    </details>
  );
}
