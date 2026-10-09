import type { Friend } from "../../types";
import styles from "./StageDots.module.css";

type Props = {
  /** Everyone live, in the feed's order (the longest sharing first). */
  people: Friend[];
  meId: string;
  /** Who's on the stage. */
  onStage: string | null;
  onPick: (personId: string) => void;
};

/**
 * Where you are among the people live (spec 0159): a dot each, the one on the stage a short
 * pill. A tap puts that person on the stage. Nothing with only one person live.
 */
export function StageDots({ people, meId, onStage, onPick }: Props) {
  if (people.length < 2) return null;
  return (
    <div className={styles.dots}>
      {people.map((p) => (
        <button
          key={p.id}
          type="button"
          className={styles.dot}
          aria-label={p.id === meId ? "Watch yourself" : `Watch ${p.name}`}
          aria-current={p.id === onStage ? "true" : undefined}
          onClick={() => onPick(p.id)}
        />
      ))}
    </div>
  );
}
