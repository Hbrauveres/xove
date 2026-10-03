import { useEffect, useRef } from "react";
import type { ScreenTracks } from "../../types";
import styles from "./ScreenVideo.module.css";

type Props = {
  screen: ScreenTracks;
  label: string;
  /** 0 to 1. */
  volume?: number;
  muted?: boolean;
};

/** Plays someone's shared screen (and its sound, if they shared it). */
export function ScreenVideo({ screen, label, volume = 1, muted = false }: Props) {
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

  // Only this browser's playback: the sharer and other viewers aren't affected.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted, screen.audio]);

  return (
    <>
      <video ref={videoRef} className={styles.video} aria-label={label} autoPlay playsInline muted />
      <audio ref={audioRef} autoPlay />
    </>
  );
}
