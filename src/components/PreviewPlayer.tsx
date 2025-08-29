import { useRef, useEffect, useState, useCallback } from "react";
import { useEditor } from "../state/editorStore";
import { Button } from "./ui/button";

export const PreviewPlayer = ({ src }: { src?: string }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { selectedTimelineItemId, timeline, clips, playhead, setPlayhead } = useEditor();
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const selectedItem = timeline.find((t) => t.id === selectedTimelineItemId);
  const clip = selectedItem
    ? clips.find((c) => c.id === selectedItem.clipId)
    : null;
  const playSrc = clip ? clip.path : src;

  // Transport controls
  const play = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }, []);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (playing) {
      pause();
    } else {
      play();
    }
  }, [playing, play, pause]);

  const seek = useCallback((time: number) => {
    if (videoRef.current && duration > 0) {
      const clampedTime = Math.max(0, Math.min(time, duration));
      videoRef.current.currentTime = clampedTime;
      setCurrentTime(clampedTime);
      // Update global playhead based on timeline position
      if (selectedItem) {
        setPlayhead(selectedItem.start + clampedTime);
      }
    }
  }, [duration, selectedItem, setPlayhead]);

  // Keyboard shortcuts: J/K/L, [ ]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key.toLowerCase()) {
        case 'j':
          e.preventDefault();
          seek(currentTime - 1); // Back 1 second
          break;
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'l':
          e.preventDefault();
          seek(currentTime + 1); // Forward 1 second
          break;
        case '[':
          e.preventDefault();
          if (selectedItem) {
            seek(selectedItem.in || 0); // Jump to in point
          } else {
            seek(0);
          }
          break;
        case ']':
          e.preventDefault();
          if (selectedItem) {
            seek(selectedItem.out || duration); // Jump to out point
          } else {
            seek(duration);
          }
          break;
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentTime, duration, selectedItem, togglePlayPause, seek]);

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      
      // Update global playhead to reflect video position
      if (selectedItem) {
        setPlayhead(selectedItem.start + time);
      }
    }
  }, [selectedItem, setPlayhead]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  }, []);

  const handlePlay = useCallback(() => {
    setPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    if (selectedItem && videoRef.current) {
      // seek to in point
      videoRef.current.currentTime = selectedItem.in || 0;
      // autoplay on selection
      play();
      return;
    }

    // If playhead was set externally (e.g., drop), jump to that time
    if (typeof playhead === "number" && videoRef.current && selectedItem) {
      try {
        const localTime = playhead - selectedItem.start;
        if (localTime >= 0 && localTime <= (selectedItem.out - selectedItem.in)) {
          videoRef.current.currentTime = selectedItem.in + localTime;
        }
      } catch (e) {
        // ignore invalid seeks
      }
      play();
      return;
    }

    if (playing) {
      play();
    } else {
      pause();
    }
  }, [playSrc, selectedItem, playhead, playing, play, pause]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-black rounded-md h-64 flex flex-col">
      <div className="flex-1 flex items-center justify-center text-white w-full">
        {playSrc ? (
          <video
            ref={videoRef}
            src={playSrc}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handlePlay}
            onPause={handlePause}
          />
        ) : (
          <div className="text-sm text-muted-foreground">No clip selected</div>
        )}
      </div>
      <div className="p-2 flex items-center justify-between">
        <div className="text-sm text-white">
          {clip ? clip.name : src ? "Preview" : "No clip"}
        </div>
        <div className="flex items-center gap-2 text-xs text-white">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={togglePlayPause}>
            {playing ? "Pause (K)" : "Play (K)"}
          </Button>
          <Button
            size="sm"
            onClick={() => seek(0)}
          >
            Reset
          </Button>
        </div>
      </div>
      <div className="px-2 pb-2">
        <div className="text-xs text-muted-foreground mb-1">
          J: -1s | K: Play/Pause | L: +1s | [: In | ]: Out | Space: Play/Pause
        </div>
      </div>
    </div>
  );
};
