import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useMediaStore } from "@/state/mediaStore";
import { TimelineStrip } from "@/components/TimelineStrip";
import { toMediaSrc } from "@/lib/mediaUrl";
import { CutSettingsPanel } from "@/components/CutSettingsPanel";

export default function PreviewPane() {
  const { mediaFiles, currentClipId, isPlaying, setPlayhead, setPlaying } =
    useMediaStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentFile = currentClipId
    ? mediaFiles.find((f) => f.id === currentClipId)
    : null;
  // Resolved media source (async because toMediaSrc is now Promise-based)
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    if (!currentFile) {
      setVideoSrc(undefined);
      return;
    }
    (async () => {
      try {
        const src = await toMediaSrc(currentFile.path);
        if (!cancelled) setVideoSrc(src || undefined);
      } catch {
        if (!cancelled) setVideoSrc(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentFile]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const play = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      /* ignore autoplay block */
    });
    setPlaying(true);
    resetControlsTimeout();
  }, [setPlaying]);

  const pause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setPlaying(false);
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  }, [setPlaying]);

  const togglePlayPause = useCallback(() => {
    isPlaying ? pause() : play();
  }, [isPlaying, play, pause]);

  const seek = useCallback(
    (time: number) => {
      const v = videoRef.current;
      if (!v || duration <= 0) return;
      const t = Math.max(0, Math.min(time, duration));
      v.currentTime = t;
      setCurrentTime(t);
      setPlayhead(t);
    },
    [duration, setPlayhead]
  );

  const skipBackward = () => seek(currentTime - 10);
  const skipForward = () => seek(currentTime + 10);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlayPause();
          break;
        case "j":
          e.preventDefault();
          skipBackward();
          break;
        case "l":
          e.preventDefault();
          skipForward();
          break;
        case "[":
          e.preventDefault();
          seek(0);
          break;
        case "]":
          e.preventDefault();
          seek(duration);
          break;
        case "arrowleft":
          e.preventDefault();
          seek(currentTime - 1);
          break;
        case "arrowright":
          e.preventDefault();
          seek(currentTime + 1);
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, duration, togglePlayPause, seek]);

  // Video event handlers
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleLoadedMetadata = () => {
      setDuration(v.duration || 0);
      setError(null);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(v.currentTime || 0);
      setPlayhead(v.currentTime || 0);
    };
    const handlePlay = () => {
      setPlaying(true);
      resetControlsTimeout();
    };
    const handlePause = () => {
      setPlaying(false);
      setShowControls(true);
    };
    const handleError = () => {
      setError("Unable to load video. Format may not be supported.");
      setPlaying(false);
    };

    v.addEventListener("loadedmetadata", handleLoadedMetadata);
    v.addEventListener("timeupdate", handleTimeUpdate);
    v.addEventListener("play", handlePlay);
    v.addEventListener("pause", handlePause);
    v.addEventListener("error", handleError);

    return () => {
      v.removeEventListener("loadedmetadata", handleLoadedMetadata);
      v.removeEventListener("timeupdate", handleTimeUpdate);
      v.removeEventListener("play", handlePlay);
      v.removeEventListener("pause", handlePause);
      v.removeEventListener("error", handleError);
    };
  }, [setPlaying, setPlayhead]);

  // Update video volume
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Video Container */}
      <div
        className="flex-1 relative bg-black group"
        onMouseMove={resetControlsTimeout}
        onMouseLeave={() => {
          if (isPlaying) {
            if (controlsTimeoutRef.current)
              clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(
              () => setShowControls(false),
              1000
            );
          }
        }}
      >
        {currentFile ? (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              playsInline
            />

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center">
                  <p className="text-red-400 mb-2">⚠️ Playback Error</p>
                  <p className="text-sm text-slate-400">{error}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Try converting to a supported format or check codec
                    compatibility
                  </p>
                </div>
              </div>
            )}

            {/* Controls Overlay */}
            <div
              className={`absolute inset-0 transition-opacity duration-300 ${
                showControls ? "opacity-100" : "opacity-0"
              }`}
            >
              {/* Center Play/Pause */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  size="lg"
                  variant="secondary"
                  className="rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8" />
                  ) : (
                    <Play className="h-8 w-8" />
                  )}
                </Button>
              </div>

              {/* Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <div className="mb-4">
                  <Slider
                    value={[currentTime]}
                    max={duration || 1}
                    step={0.1}
                    onValueChange={(val) => seek(val[0] ?? 0)}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={skipBackward}>
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={togglePlayPause}>
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={skipForward}>
                      <SkipForward className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2 ml-4">
                      <Volume2 className="h-4 w-4" />
                      <Slider
                        value={[volume]}
                        max={1}
                        step={0.1}
                        onValueChange={(val) => setVolume(val[0] ?? 0)}
                        className="w-20"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    <Button size="sm" variant="ghost">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-slate-800 rounded-lg flex items-center justify-center">
                <Play className="h-12 w-12 text-slate-500" />
              </div>
              <p className="text-slate-400 mb-2">No media selected</p>
              <p className="text-sm text-slate-500">
                Select a clip from the library to preview
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Strip */}
      <div className="border-t border-slate-700">
        <TimelineStrip />
      </div>

      <CutSettingsPanel />

      {/* Transport Help */}
      <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700">
        <div className="text-xs text-slate-400 text-center">
          Space/K: Play/Pause • J/L: ±10s • ←/→: ±1s • [/]: Start/End
        </div>
      </div>
    </div>
  );
}
