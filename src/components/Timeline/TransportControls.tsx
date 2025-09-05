import { useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/state/playerStore";
import { formatTime } from "@/utils/timelineUtils";

interface TransportControlsProps {
  className?: string;
}

export function TransportControls({ className }: TransportControlsProps) {
  const {
    duration,
    currentTime,
    isPlaying,
    playbackRate,
    setTime,
    playPause,
    setPlaybackRate,
    snapToBeats,
    setSnapToBeats,
  } = usePlayerStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.code) {
        case "Space":
        case "KeyK":
          event.preventDefault();
          playPause();
          break;

        case "KeyJ":
          event.preventDefault();
          setTime(Math.max(0, currentTime - 10));
          break;

        case "KeyL":
          event.preventDefault();
          setTime(Math.min(duration, currentTime + 10));
          break;

        case "ArrowLeft":
          event.preventDefault();
          setTime(Math.max(0, currentTime - 1));
          break;

        case "ArrowRight":
          event.preventDefault();
          setTime(Math.min(duration, currentTime + 1));
          break;

        case "BracketLeft": // [
          event.preventDefault();
          // Mark in - could trigger cut creation
          break;

        case "BracketRight": // ]
          event.preventDefault();
          // Mark out - could trigger cut creation
          break;

        case "KeyS":
          event.preventDefault();
          // Split at playhead - could trigger cut split
          break;

        case "Delete":
        case "Backspace":
          event.preventDefault();
          // Delete selected cut
          break;

        case "Comma":
          event.preventDefault();
          // Nudge -1 frame (assuming 30fps)
          setTime(Math.max(0, currentTime - 1 / 30));
          break;

        case "Period":
          event.preventDefault();
          // Nudge +1 frame
          setTime(Math.min(duration, currentTime + 1 / 30));
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, duration, playPause, setTime]);

  const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div
      className={`flex items-center gap-4 p-4 bg-slate-800 border-t border-slate-700 ${className}`}
    >
      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setTime(Math.max(0, currentTime - 10))}
          title="Skip back 10s (J)"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant={isPlaying ? "default" : "secondary"}
          onClick={() => playPause()}
          title="Play/Pause (Space/K)"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setTime(Math.min(duration, currentTime + 10))}
          title="Skip forward 10s (L)"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Time Display */}
      <div className="flex items-center gap-2 text-sm text-slate-300 font-mono">
        <span>{formatTime(currentTime)}</span>
        <span>/</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Playback Rate */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Speed:</span>
        <select
          value={playbackRate}
          onChange={(e) => setPlaybackRate(Number(e.target.value))}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
        >
          {playbackRates.map((rate) => (
            <option key={rate} value={rate}>
              {rate}x
            </option>
          ))}
        </select>
      </div>

      {/* Snap Toggle */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={snapToBeats}
            onChange={(e) => setSnapToBeats(e.target.checked)}
            className="rounded"
          />
          Snap to Beats
        </label>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Help Text */}
      <div className="text-xs text-slate-500">
        Space/K: Play • J/L: ±10s • ←/→: ±1s • ,/.: ±1 frame • [/]: Mark • S:
        Split
      </div>
    </div>
  );
}
