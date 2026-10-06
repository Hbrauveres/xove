import { useEffect, useRef } from "react";
import type { MediaTrack } from "../../types";
import styles from "./ScreenVideo.module.css";

type Props = {
  video?: MediaTrack;
  /** The screen's sound, when it's someone else's and it plays. */
  sound?: MediaTrack;
  label: string;
  /** 0 to 1. */
  volume?: number;
  muted?: boolean;
  /** Hands out the <video> element, for the ambilight to read (spec 0104); null when it goes. */
  onVideo?: (el: HTMLVideoElement | null) => void;
};

/** Plays someone's shared screen or camera (and the screen's sound, if they shared it). */
export function ScreenVideo({ video, sound, label, volume = 1, muted = false, onVideo }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video) return;
    video.attach(el);
    return () => {
      video.detach(el);
    };
  }, [video]);

  useEffect(() => {
    if (!onVideo) return;
    onVideo(videoRef.current);
    return () => onVideo(null);
  }, [onVideo]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !sound) return;
    sound.attach(el);
    return () => {
      sound.detach(el);
    };
  }, [sound]);

  // Only this browser's playback: the sharer and other viewers aren't affected.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted, sound]);

  return (
    <>
      {/* The player has its own controls: no browser picture-in-picture button over it (Edge adds one). */}
      <video
        ref={videoRef}
        className={styles.video}
        aria-label={label}
        autoPlay
        playsInline
        muted
        disablePictureInPicture
      />
      {sound && <audio ref={audioRef} autoPlay />}
    </>
  );
}
