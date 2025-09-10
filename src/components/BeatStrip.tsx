import React from "react";

interface BeatStripProps {
  beats: { time: number; confidence: number }[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  snapEnabled?: boolean;
  selectedBeats?: number[];
  onBeatSelect?: (beatIndex: number) => void;
  className?: string;
}

export function BeatStrip({
  beats,
  duration,
  currentTime,
  onSeek,
  snapEnabled = true,
  selectedBeats = [],
  onBeatSelect,
  className = "",
}: BeatStripProps) {
  const stripRef = React.useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (!stripRef.current) return;

    const rect = stripRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickTime = (clickX / rect.width) * duration;

    if (snapEnabled && beats.length > 0) {
      // Find nearest beat
      const nearestBeat = beats.reduce(
        (closest, beat, index) => {
          const distance = Math.abs(beat.time - clickTime);
          return distance < closest.distance
            ? { beat, distance, index }
            : closest;
        },
        { beat: beats[0], distance: Infinity, index: 0 }
      );

      // Snap if within 0.5 seconds
      if (nearestBeat.distance < 0.5) {
        onSeek(nearestBeat.beat.time);
        onBeatSelect?.(nearestBeat.index);
        return;
      }
    }

    onSeek(clickTime);
  };

  const getCurrentPosition = () => {
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  };

  const getBeatPosition = (beatTime: number) => {
    return duration > 0 ? (beatTime / duration) * 100 : 0;
  };

  const getBeatIntensity = (confidence: number) => {
    // Map confidence to visual intensity
    if (confidence > 0.9) return "high";
    if (confidence > 0.7) return "medium";
    return "low";
  };

  return (
    <div
      className={`relative h-8 bg-slate-800 border border-slate-600 rounded cursor-pointer ${className}`}
    >
      {/* Background track */}
      <div
        ref={stripRef}
        className="absolute inset-0 rounded"
        onClick={handleClick}
      />

      {/* Beats visualization */}
      {beats.map((beat, index) => {
        const position = getBeatPosition(beat.time);
        const intensity = getBeatIntensity(beat.confidence);
        const isSelected = selectedBeats.includes(index);

        return (
          <div
            key={index}
            className={`absolute top-1/2 transform -translate-y-1/2 rounded-full transition-all ${
              intensity === "high"
                ? "w-2 h-6 bg-green-400"
                : intensity === "medium"
                ? "w-1.5 h-4 bg-yellow-400"
                : "w-1 h-2 bg-slate-500"
            } ${isSelected ? "ring-2 ring-blue-400 scale-125" : ""}`}
            style={{ left: `${position}%` }}
            title={`Beat ${index + 1} - ${beat.time.toFixed(
              2
            )}s (${beat.confidence.toFixed(2)})`}
          />
        );
      })}

      {/* Current time indicator */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
        style={{ left: `${getCurrentPosition()}%` }}
      />

      {/* Time markers every 10 seconds */}
      {duration > 10 &&
        Array.from(
          { length: Math.floor(duration / 10) },
          (_, i) => (i + 1) * 10
        ).map((time) => (
          <div
            key={time}
            className="absolute top-0 bottom-0 w-px bg-slate-600"
            style={{ left: `${getBeatPosition(time)}%` }}
            title={`${time}s`}
          />
        ))}

      {/* Snap indicator */}
      {snapEnabled && (
        <div className="absolute top-0 right-0 px-1 py-0.5 bg-blue-600 text-white text-xs rounded-bl">
          SNAP
        </div>
      )}
    </div>
  );
}
