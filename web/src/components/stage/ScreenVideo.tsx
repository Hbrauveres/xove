import { useEffect, useRef } from "react";
import type { ScreenTracks } from "../../types";
import styles from "./ScreenVideo.module.css";

type Props = {
  screen: ScreenTracks;
  label: string;
};

/** Plays someone's shared screen (and its sound, if they shared it). */
export function ScreenVideo({ screen, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    const track = screen.video;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [screen.video]);

  useEffect(() => {
    const el = audioRef.current;
    const track = screen.audio;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [screen.audio]);

  return (
    <>
      <video ref={videoRef} className={styles.video} aria-label={label} autoPlay playsInline muted />
      <audio ref={audioRef} autoPlay />
    </>
  );
}
