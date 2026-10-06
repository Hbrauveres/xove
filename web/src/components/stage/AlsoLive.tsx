import { useEffect, useRef, useState } from "react";
import type { LiveFeed, Sharer } from "../../types";
import { Avatar } from "../ui/Avatar";
import { ScreenVideo } from "./ScreenVideo";
import styles from "./AlsoLive.module.css";

import { MUTED, type PreviewSound } from "./previewSound";

/** How long a preview's slider waits after the pointer leaves. */
const LEAVE_MS = 150;

type Props = {
  /** Everyone sharing except the person on the stage, longest first. */
  others: Sharer[];
  /** Live streams of the 6, everyone's. */
  liveCount: number;
  /** Places left of the 6. */
  free: number;
  onPick: (personId: string) => void;
  sound: Record<string, PreviewSound>;
  onSoundChange: (personId: string, sound: PreviewSound) => void;
  /** False where the page can't set the volume (iPhones and iPads): mute only. */
  canSetVolume: boolean;
};

const kindOf = (feed: LiveFeed) => (feed.kind === "camera" ? "camera" : "screen");

/**
 * The right of the info row (specs 0104 and 0107): the other live streams as small previews (a
 * click puts one on the stage), then a box with how many of the 6 are live and the places left.
 * Past their room the previews scroll; the box stays put, and goes when nothing is free. Each
 * preview keeps its own sound (spec 0060): muted by default, a speaker to unmute, a slider.
 */
export function AlsoLive({ others, liveCount, free, onPick, sound, onSoundChange, canSetVolume }: Props) {
  return (
    <section className={styles.also} aria-label="Also live">
      <ul className={styles.strip} aria-label="Other streams">
        {others.map((s) => {
          const feed = s.screen ?? s.camera;
          if (!feed) return null;
          const id = s.person.id;
          const mine = sound[id] ?? MUTED;
          const what = kindOf(feed);
          // My own stream plays from my browser; someone else's from LiveKit, once it arrives.
          const video = s.isMe ? feed.local : feed.remote?.video;
          const name = s.isMe ? "You" : s.person.name;
          const whose = s.isMe ? "your" : `${s.person.name}'s`;
          return (
            <li key={id} className={styles.item}>
              <button
                type="button"
                className={styles.preview}
                aria-label={`Watch ${whose} ${what}`}
                onClick={() => onPick(id)}
              >
                <span className={styles.video}>
                  {video ? (
                    <ScreenVideo
                      video={video}
                      sound={s.isMe || mine.muted ? undefined : s.sound}
                      volume={mine.volume}
                      label={`${s.isMe ? "Your" : `${s.person.name}'s`} ${what === "screen" ? "shared screen" : "camera"}`}
                    />
                  ) : (
                    <span className={styles.loading}>Loading…</span>
                  )}
                </span>
                <span className={styles.chip}>
                  <Avatar person={s.person} size={16} />
                  {name} · {what}
                </span>
              </button>
              {!s.isMe && s.hasSound && (
                <PreviewSpeaker
                  name={s.person.name}
                  sound={mine}
                  canSetVolume={canSetVolume}
                  onChange={(next) => onSoundChange(id, next)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {free > 0 && (
        <p className={styles.free} data-free>
          <b>{liveCount} of 6 live</b>
          <span>{free} free · share yours</span>
        </p>
      )}
    </section>
  );
}

/** A preview's speaker: crossed while muted; a click unmutes; pointing at it slides a volume out. */
function PreviewSpeaker({
  name,
  sound,
  canSetVolume,
  onChange,
}: {
  name: string;
  sound: PreviewSound;
  canSetVolume: boolean;
  onChange: (sound: PreviewSound) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const leave = useRef<number | undefined>(undefined);
  const pressing = useRef(false);
  useEffect(() => () => window.clearTimeout(leave.current), []);
  const sliding = canSetVolume && !sound.muted && (hovered || focused);

  return (
    <div
      ref={box}
      className={styles.sound}
      data-open={sliding || undefined}
      onPointerEnter={() => {
        window.clearTimeout(leave.current);
        setHovered(true);
      }}
      onPointerLeave={() => {
        leave.current = window.setTimeout(() => setHovered(false), LEAVE_MS);
      }}
      onPointerDown={() => {
        pressing.current = true;
      }}
      onPointerUp={() => {
        pressing.current = false;
      }}
      // A click focuses the speaker too: only keyboard focus slides the volume out.
      onFocus={() => {
        if (!pressing.current) setFocused(true);
      }}
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <button
        type="button"
        className={styles.speaker}
        aria-label={`${sound.muted ? "Unmute" : "Mute"} ${name}`}
        title={sound.muted ? "Unmute" : "Mute"}
        onClick={() => onChange({ ...sound, muted: !sound.muted })}
      >
        <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
          <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
          {sound.muted ? (
            <path d="M13 8l4 4M17 8l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path
              d="M13 7.5a3.5 3.5 0 0 1 0 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>
      {sliding && (
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={1}
          step={0.05}
          aria-label={`${name}'s volume`}
          aria-orientation="horizontal"
          value={sound.volume}
          onChange={(e) => onChange({ muted: false, volume: Number(e.target.value) })}
        />
      )}
    </div>
  );
}
