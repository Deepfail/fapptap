import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Maximize2 } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { useMediaStore } from "../state/mediaStore";
import { TimelineStrip } from "./TimelineStrip";

export function PreviewPane() {
  const {
    mediaFiles,
    currentClipId,
    isPlaying,
    setPlayhead,
    setPlaying
  } = useMediaStore();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  
  const currentFile = currentClipId ? mediaFiles.find(f => f.id === currentClipId) : null;
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const play = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play();
      setPlaying(true);
      resetControlsTimeout();
    }
  }, [setPlaying]);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [setPlaying]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (videoRef.current && duration > 0) {
      const clampedTime = Math.max(0, Math.min(time, duration));
      videoRef.current.currentTime = clampedTime;
      setCurrentTime(clampedTime);
      setPlayhead(clampedTime);
    }
  }, [duration, setPlayhead]);

  const skipBackward = () => seek(currentTime - 10);
  const skipForward = () => seek(currentTime + 10);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'j':
          e.preventDefault();
          skipBackward();
          break;
        case 'l':
          e.preventDefault();
          skipForward();
          break;
        case '[':
          e.preventDefault();
          seek(0);
          break;
        case ']':
          e.preventDefault();
          seek(duration);
          break;
        case 'arrowleft':
          e.preventDefault();
          seek(currentTime - 1);
          break;
        case 'arrowright':
          e.preventDefault();
          seek(currentTime + 1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentTime, duration, togglePlayPause, seek]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setError(null);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setPlayhead(video.currentTime);
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
      setError('Unable to load video. Format may not be supported.');
      setPlaying(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
    };
  }, [setPlaying, setPlayhead]);

  // Update video volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  // Mouse movement detection for controls
  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  const handleMouseLeave = () => {
    if (isPlaying && controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 1000);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Video Container */}
      <div 
        className="flex-1 relative bg-black group"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {currentFile ? (
          <>
            <video
              ref={videoRef}
              src={currentFile.path}
              className="w-full h-full object-contain"
              playsInline
            />
            
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center">
                  <p className="text-red-400 mb-2">⚠️ Playback Error</p>
                  <p className="text-sm text-slate-400">{error}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Try converting to a supported format or check codec compatibility
                  </p>
                </div>
              </div>
            )}
            
            {/* Video Controls Overlay */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}>
              {/* Center Play/Pause Button */}
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
                {/* Progress Bar */}
                <div className="mb-4">
                  <Slider
                    value={[currentTime]}
                    max={duration || 1}
                    step={0.1}
                    onValueChange={([value]) => seek(value)}
                    className="w-full"
                  />
                </div>

                {/* Control Buttons */}
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
                        onValueChange={([value]) => setVolume(value)}
                        className="w-20"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
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
              <p className="text-sm text-slate-500">Select a clip from the library to preview</p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Strip */}
      <div className="border-t border-slate-700">
        <TimelineStrip />
      </div>

      {/* Transport Help */}
      <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700">
        <div className="text-xs text-slate-400 text-center">
          Space/K: Play/Pause • J/L: ±10s • ←/→: ±1s • [/]: Start/End
        </div>
      </div>
    </div>
  );
}