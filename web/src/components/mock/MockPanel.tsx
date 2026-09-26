import type { RoomSession } from "../../hooks/useRoomSession";
import { Button } from "../ui/Button";
import styles from "./MockPanel.module.css";

type Props = {
  simulate: RoomSession["simulate"];
};

/**
 * Dev-only buttons that fake who is around. Sharing is real now (open a second
 * browser to see it); presence and the connection stay fake until LiveKit.
 */
export function MockPanel({ simulate }: Props) {
  return (
    <details className={styles.panel} open>
      <summary className={styles.summary}>
        <span>Simulate friends</span>
        <span className={styles.badge}>mock only</span>
      </summary>
      <div className={styles.actions}>
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
