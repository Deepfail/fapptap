import { useRef, useEffect, useState } from "react";
import { usePlayerStore } from "@/state/playerStore";

interface PreviewVideoProps {
  src: string;
  className?: string;
}

export function PreviewVideo({ src, className }: PreviewVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const {
    currentTime,
    isPlaying,
    playbackRate,
    setTime,
    playPause,
    loadSource,
  } = usePlayerStore();

  // Sync video time with store
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isLoaded) return;

    // Avoid unnecessary seeks (prevent feedback loop)
    if (Math.abs(video.currentTime - currentTime) > 0.1) {
      video.currentTime = currentTime;
    }
  }, [currentTime, isLoaded]);

  // Sync play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isLoaded) return;

    if (isPlaying) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  }, [isPlaying, isLoaded]);

  // Sync playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = playbackRate;
  }, [playbackRate]);

  // Set up video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setIsLoaded(true);
      // Load mock beats for now - in real app this would come from analysis
      const mockBeats = generateMockBeats(video.duration);
      loadSource(src, mockBeats, video.duration);
    };

    const handleTimeUpdate = () => {
      // Throttled time updates to prevent excessive store updates
      const now = Date.now();
      if (
        !handleTimeUpdate.lastUpdate ||
        now - handleTimeUpdate.lastUpdate > 100
      ) {
        setTime(video.currentTime);
        handleTimeUpdate.lastUpdate = now;
      }
    };
    handleTimeUpdate.lastUpdate = 0;

    const handlePlay = () => {
      // Video started playing - sync with store if needed
      if (!isPlaying) {
        playPause(true);
      }
    };

    const handlePause = () => {
      // Video paused - sync with store if needed
      if (isPlaying) {
        playPause(false);
      }
    };

    const handleEnded = () => {
      playPause(false);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, [src, isPlaying, setTime, playPause, loadSource]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={`block w-full h-full object-contain ${className ?? ""}`}
      controls={false}
      playsInline
      preload="metadata"
      muted
      disableRemotePlayback
      controlsList="nodownload noplaybackrate noremoteplayback nopictureinpicture"
    />
  );
}

// Mock beat generation for development
function generateMockBeats(
  duration: number
): Array<{ time: number; isDownbeat: boolean; confidence: number }> {
  const beats = [];
  const bpm = 128; // Mock BPM
  const beatInterval = 60 / bpm;

  for (let time = 0; time < duration; time += beatInterval) {
    beats.push({
      time,
      isDownbeat: beats.length % 4 === 0, // Every 4th beat is a downbeat
      confidence: 0.8 + Math.random() * 0.2, // Random confidence between 0.8-1.0
    });
  }

  return beats;
}
