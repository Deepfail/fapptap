import React from "react";

interface Beat {
  time: number;
  confidence: number;
  energy: number;
}

interface Props {
  beats: Beat[];
  duration: number;
  currentTime: number;
  onSeek: (t: number) => void;
}

export default function DotTimeline({
  beats,
  duration,
  currentTime,
  onSeek,
}: Props) {
  if (!duration || beats.length === 0) {
    return (
      <div className="h-12 flex items-center justify-center text-sm text-muted-foreground">
        No beats loaded
      </div>
    );
  }

  return (
    <div className="dot-timeline h-12 px-3 flex items-center space-x-2 overflow-x-auto">
      <div className="flex items-center gap-2">
        {beats.map((b, i) => {
          const left = (b.time / duration) * 100;
          const isActive = Math.abs(currentTime - b.time) < 0.25;
          return (
            <button
              key={i}
              title={`Beat ${i} - ${b.time.toFixed(2)}s`}
              onClick={() => onSeek(b.time)}
              className={`dot ${isActive ? "dot-active" : ""}`}
              aria-label={`seek-beat-${i}`}
            />
          );
        })}
      </div>
    </div>
  );
}
