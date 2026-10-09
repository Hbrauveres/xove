import type { LiveFeed as Feed, Sharer } from "../../types";
import { STREAM_PLACES } from "./NowWatching";
import { ScreenVideo } from "./ScreenVideo";
import styles from "./StreamsRow.module.css";

type Props = {
  /** Everyone sharing except the person on the stage, longest first. */
  others: Sharer[];
  /** Live streams of the 6, everyone's. */
  liveCount: number;
  open: boolean;
  /** The tab's tap. */
  onOpen: () => void;
  onPick: (personId: string) => void;
};

const kindOf = (feed: Feed) => (feed.kind === "camera" ? "camera" : "screen");

/**
 * Sideways (spec 0160): the other live streams in one row of small pictures along the bottom,
 * over a black gradient. Silent, like the upright feed. It slides up when open; while closed, a
 * small tab at the bottom edge opens it.
 */
export function StreamsRow({ others, liveCount, open, onOpen, onPick }: Props) {
  return (
    <>
      {!open && (
        <button type="button" className={styles.tab} data-no-swipe aria-label="Show the other streams" onClick={onOpen} />
      )}
      <section
        className={styles.row}
        data-open={open || undefined}
        data-no-swipe
        aria-labelledby="streams-row"
        aria-hidden={!open}
        inert={!open}
      >
        <h2 id="streams-row" className={styles.head}>
          <span>Live now</span>
          <span className={styles.count}>
            {liveCount} of {STREAM_PLACES}
          </span>
        </h2>
        <ul className={styles.list}>
          {others.map((s) => {
            const feed = s.screen ?? s.camera;
            if (!feed) return null;
            const what = kindOf(feed);
            const video = s.isMe ? feed.local : feed.remote?.video;
            const name = s.isMe ? "You" : s.person.name;
            const whose = s.isMe ? "your" : `${s.person.name}'s`;
            return (
              <li key={s.person.id}>
                <button
                  type="button"
                  className={styles.picture}
                  aria-label={`Watch ${whose} ${what}`}
                  onClick={() => onPick(s.person.id)}
                >
                  {video && (
                    <ScreenVideo
                      video={video}
                      label={`${s.isMe ? "Your" : `${s.person.name}'s`} ${what === "screen" ? "shared screen" : "camera"}`}
                    />
                  )}
                  <span className={styles.name}>{name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
