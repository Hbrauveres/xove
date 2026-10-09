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
  /** The arrow button, closed: opens the row. */
  onOpen: () => void;
  /** The arrow button, open: closes it. */
  onClose: () => void;
  onPick: (personId: string) => void;
};

const kindOf = (feed: Feed) => (feed.kind === "camera" ? "camera" : "screen");

/** A round button with a chevron: up opens the row, down closes it. */
function ArrowButton({ up, onClick, className }: { up: boolean; onClick: () => void; className: string }) {
  return (
    <button
      type="button"
      className={className}
      data-no-swipe
      data-fades={up || undefined}
      data-arrow={up ? "up" : "down"}
      aria-label={up ? "Show the other streams" : "Hide the other streams"}
      onClick={onClick}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path
          d={up ? "M5 12.5 10 7.5l5 5" : "M5 7.5 10 12.5l5-5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * Sideways (spec 0160): the other live streams in one row of small pictures along the bottom,
 * over a black gradient. Silent, like the upright feed. It slides up when open. A swipe opens
 * and closes it, and so does a round button at the bottom left: an arrow up while it's closed,
 * an arrow down on the row while it's open.
 */
export function StreamsRow({ others, liveCount, open, onOpen, onClose, onPick }: Props) {
  return (
    <>
      {!open && <ArrowButton up className={styles.toggle} onClick={onOpen} />}
      <section
        className={styles.row}
        data-open={open || undefined}
        data-no-swipe
        aria-labelledby="streams-row"
        aria-hidden={!open}
        inert={!open}
      >
        <h2 id="streams-row" className={styles.head}>
          {open && <ArrowButton up={false} className={styles.toggleOpen} onClick={onClose} />}
          <span className={styles.title}>Live now</span>
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
