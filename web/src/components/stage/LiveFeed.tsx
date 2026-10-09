import type { Friend, LiveFeed as Feed, Sharer } from "../../types";
import { NowWatching, STREAM_PLACES } from "./NowWatching";
import { ScreenVideo } from "./ScreenVideo";
import styles from "./LiveFeed.module.css";

type Props = {
  /** Everyone sharing except the person on the stage, longest first. */
  others: Sharer[];
  /** Live streams of the 6, everyone's. */
  liveCount: number;
  /** Who has this person's stream on their stage (spec 0107). */
  watchersOf: (personId: string) => Friend[];
  onPick: (personId: string) => void;
};

const kindOf = (feed: Feed) => (feed.kind === "camera" ? "camera" : "screen");

/**
 * Under the phone's stage (spec 0158): the other live streams, like the YouTube app's feed. Each
 * is a full-width picture, then who, LIVE, for how long and who's watching. Silent: only the
 * stage plays sound. A tap puts it on the stage.
 */
export function LiveFeed({ others, liveCount, watchersOf, onPick }: Props) {
  return (
    <section className={styles.feed} aria-labelledby="live-now">
      <h2 id="live-now" className={styles.head}>
        <span>Live now</span>
        <span className={styles.count}>
          {liveCount} of {STREAM_PLACES}
        </span>
      </h2>
      <ul className={styles.list}>
        {others.map((s) => {
          const feed = s.screen ?? s.camera;
          if (!feed) return null;
          const id = s.person.id;
          const what = kindOf(feed);
          const video = s.isMe ? feed.local : feed.remote?.video;
          const whose = s.isMe ? "your" : `${s.person.name}'s`;
          return (
            <li key={id} className={styles.card}>
              <button
                type="button"
                className={styles.picture}
                aria-label={`Watch ${whose} ${what}`}
                onClick={() => onPick(id)}
              >
                {video ? (
                  <ScreenVideo
                    video={video}
                    label={`${s.isMe ? "Your" : `${s.person.name}'s`} ${what === "screen" ? "shared screen" : "camera"}`}
                  />
                ) : (
                  <span className={styles.loading}>Loading…</span>
                )}
              </button>
              {/* The line under it opens the stream too; the keyboard uses the picture's button. */}
              <div className={styles.info} onClick={() => onPick(id)}>
                <NowWatching compact level={3} sharer={s} watchers={watchersOf(id)} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
