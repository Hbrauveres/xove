import type { Friend } from "../../types";
import { Avatar } from "../ui/Avatar";
import styles from "./ViewerList.module.css";

type Props = {
  people: Friend[];
  meId: string;
  sharerId: string | null;
};

/** Everyone on the allowlist: who's here, who's on air, who's away. */
export function ViewerList({ people, meId, sharerId }: Props) {
  const online = people.filter((p) => p.online);
  const away = people.filter((p) => !p.online);

  return (
    <section className={styles.panel} aria-labelledby="viewers-title">
      <h2 id="viewers-title" className={styles.heading}>
        Here now <span className={styles.count}>{online.length}</span>
      </h2>
      <ul className={styles.list}>
        {online.map((p) => {
          const onAir = p.id === sharerId;
          return (
            <li key={p.id} className={styles.person}>
              <Avatar person={p} size={30} onAir={onAir} />
              <span className={styles.name}>
                {p.name}
                {p.id === meId && <span className={styles.you}> (you)</span>}
              </span>
              <span className={onAir ? styles.tagLive : styles.tag}>{onAir ? "Sharing" : "Watching"}</span>
            </li>
          );
        })}
      </ul>

      {away.length > 0 && (
        <>
          <h3 className={styles.subheading}>Away</h3>
          <ul className={styles.list}>
            {away.map((p) => (
              <li key={p.id} className={`${styles.person} ${styles.away}`}>
                <Avatar person={p} size={30} />
                <span className={styles.name}>{p.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
