import { useElapsed } from "../../hooks/useElapsed";
import type { Friend, Sharer } from "../../types";
import { Avatar } from "../ui/Avatar";
import styles from "./NowWatching.module.css";
import { whoIsHere } from "./whoIsHere";

/** What a person shares, in two words. */
const whatOf = (s: Sharer) => (s.screen && s.camera ? "Screen with camera" : s.screen ? "Screen" : "Camera");

/** The most avatars in a row: the count covers the rest. */
const MAX_AVATARS = 4;

/** Live streams at once (spec 0060). */
export const STREAM_PLACES = 6;

type Props = {
  sharer: Sharer | null;
  /** Everyone with this stream on their stage, me included, never the sharer (spec 0107). */
  watchers?: Friend[];
  /** The others in the room, for an empty stage. */
  others?: Friend[];
  /** The phone's layout (spec 0158): "Name · what" on one line, "N watching" in words, "Nobody live". */
  compact?: boolean;
  /** Places left of the 6, for the phone's empty stage. */
  free?: number;
  /** The heading's level: 3 under a feed's pictures. */
  level?: 2 | 3;
};

/**
 * The left of the info row (specs 0104 and 0107): who is on the stage, LIVE, what they share,
 * for how long and who's watching, like YouTube's title row. Or, with nobody live, an
 * invitation with who's here.
 */
export function NowWatching({ sharer, watchers = [], others = [], compact = false, free = STREAM_PLACES, level = 2 }: Props) {
  const elapsed = useElapsed(sharer?.since ?? null);
  const Heading = level === 3 ? "h3" : "h2";
  if (compact) {
    return (
      <div className={`${styles.now} ${styles.compact}`} data-compact>
        {sharer ? (
          <Avatar person={sharer.person} size={30} onAir ring="inside" />
        ) : (
          <span className={styles.nobody} aria-hidden="true" />
        )}
        <div className={styles.text}>
          <Heading className={styles.name}>
            {sharer ? `${sharer.isMe ? "You" : sharer.person.name} · ${whatOf(sharer)}` : "Nobody live"}
          </Heading>
          <p className={styles.meta}>
            {sharer ? (
              <>
                <span className={styles.live}>LIVE</span>
                <span className={styles.elapsed}>{elapsed}</span>
                {watchers.length > 0 && <span className={styles.watchers}>{watchers.length} watching</span>}
              </>
            ) : (
              <span>
                {STREAM_PLACES - free} of {STREAM_PLACES} · {free} free
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }
  if (!sharer) {
    return (
      <div className={styles.now}>
        <div className={styles.text}>
          <h2 className={styles.name}>
            The stage is <em className={styles.yours}>yours</em>.
          </h2>
          <p className={styles.meta}>
            {others.length > 0 && (
              <span className={styles.row}>
                {others.slice(0, MAX_AVATARS).map((p) => (
                  <span key={p.id} data-here className={styles.face}>
                    <Avatar person={p} size={22} />
                  </span>
                ))}
              </span>
            )}
            <span className={styles.here}>{whoIsHere(others.map((p) => p.name))}</span>
          </p>
        </div>
      </div>
    );
  }
  const name = sharer.isMe ? "You" : sharer.person.name;
  return (
    <div className={styles.now}>
      <Avatar person={sharer.person} size={52} onAir ring="inside" />
      <div className={styles.text}>
        <h2 className={styles.name}>{name}</h2>
        <p className={styles.meta}>
          <span className={styles.live}>LIVE</span>
          <span>{whatOf(sharer)}</span>
          <span className={styles.elapsed}>{elapsed}</span>
          {watchers.length > 0 && (
            <span className={styles.watchers} title={watchers.map((p) => p.name).join(", ")}>
              <span className={styles.row}>
                {watchers.slice(0, MAX_AVATARS).map((p) => (
                  <span key={p.id} data-watcher className={styles.face}>
                    <Avatar person={p} size={22} />
                  </span>
                ))}
              </span>
              <span className={styles.count}>{watchers.length} watching</span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
