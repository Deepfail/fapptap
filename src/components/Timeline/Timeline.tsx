import React, { useRef, useEffect, useState, useCallback } from "react";
import { TimelineCanvas } from "./TimelineCanvas";
import { useTimelineMouse } from "./useTimelineMouse";
import { usePlayerStore } from "@/state/playerStore";

interface TimelineProps {
  className?: string;
}

export function Timeline({ className }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 120 });
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    duration,
    pixelsPerSecond,
    scrollLeft,
    setScrollLeft,
    setPixelsPerSecond,
  } = usePlayerStore();

  const mouseHandlers = useTimelineMouse(containerRef);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: 120 });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Throttled scroll handler
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setScrollLeft(event.currentTarget.scrollLeft);
      }, 16); // ~60fps
    },
    [setScrollLeft]
  );

  // Handle zoom with wheel
  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      // Zoom
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newPixelsPerSecond = Math.max(
        10,
        Math.min(500, pixelsPerSecond * zoomFactor)
      );
      setPixelsPerSecond(newPixelsPerSecond);
    } else {
      // Pan
      const panAmount = event.deltaX || event.deltaY;
      const newScrollLeft = Math.max(0, scrollLeft + panAmount);
      setScrollLeft(newScrollLeft);
    }
  };

  const totalWidth = duration * pixelsPerSecond;

  return (
    <div className={`relative ${className}`}>
      {/* Timeline Header */}
      <div className="flex items-center justify-between p-2 bg-slate-800/50 border-b border-slate-700">
        <div className="text-sm text-slate-400">Timeline</div>
        <div className="flex items-center gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setPixelsPerSecond(Math.max(10, pixelsPerSecond * 0.5))
              }
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >
              −
            </button>
            <span className="text-xs text-slate-400 w-16 text-center">
              {Math.round(pixelsPerSecond)}px/s
            </span>
            <button
              onClick={() =>
                setPixelsPerSecond(Math.min(500, pixelsPerSecond * 2))
              }
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
            >
              +
            </button>
          </div>

          {/* Fit Controls */}
          <button
            onClick={() => {
              if (duration > 0) {
                setPixelsPerSecond(Math.max(10, dimensions.width / duration));
                setScrollLeft(0);
              }
            }}
            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Timeline Container */}
      <div
        ref={containerRef}
        className="relative overflow-auto bg-slate-900 border border-slate-700"
        style={{ height: dimensions.height }}
        onWheel={handleWheel}
        onScroll={handleScroll}
        {...mouseHandlers}
      >
        {/* Scrollable Content */}
        <div
          style={{
            width: Math.max(totalWidth, dimensions.width),
            height: "100%",
          }}
        >
          <TimelineCanvas
            width={dimensions.width}
            height={dimensions.height}
            className="absolute top-0 left-0 pointer-events-none"
          />
        </div>

        {/* Time Ruler */}
        <div className="absolute top-0 left-0 w-full h-8 bg-slate-800/80 border-b border-slate-700">
          <TimeRuler
            duration={duration}
            pixelsPerSecond={pixelsPerSecond}
            scrollLeft={scrollLeft}
            width={dimensions.width}
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="p-2 bg-slate-800/30 border-t border-slate-700">
        <div className="text-xs text-slate-500">
          Click to seek • Drag in cuts lane to create • Drag cut edges to trim •
          Cmd/Ctrl+wheel to zoom • Shift+wheel to pan
        </div>
      </div>
    </div>
  );
}

// Time Ruler Component
interface TimeRulerProps {
  duration: number;
  pixelsPerSecond: number;
  scrollLeft: number;
  width: number;
}

function TimeRuler({
  duration,
  pixelsPerSecond,
  scrollLeft,
  width,
}: TimeRulerProps) {
  const markers = [];

  // Calculate time interval for markers
  const minMarkerSpacing = 80; // pixels
  const timePerPixel = 1 / pixelsPerSecond;
  const minTimeSpacing = minMarkerSpacing * timePerPixel;

  // Round to nice intervals
  let interval = 1;
  if (minTimeSpacing > 60) interval = 300; // 5 minutes
  else if (minTimeSpacing > 30) interval = 60; // 1 minute
  else if (minTimeSpacing > 10) interval = 30; // 30 seconds
  else if (minTimeSpacing > 5) interval = 10; // 10 seconds
  else if (minTimeSpacing > 1) interval = 5; // 5 seconds

  const startTime =
    Math.floor(scrollLeft / pixelsPerSecond / interval) * interval;
  const endTime =
    Math.ceil((scrollLeft + width) / pixelsPerSecond / interval) * interval;

  for (
    let time = startTime;
    time <= Math.min(endTime, duration);
    time += interval
  ) {
    const x = time * pixelsPerSecond - scrollLeft;
    if (x >= -50 && x <= width + 50) {
      markers.push(
        <div
          key={time}
          className="absolute top-0 h-full flex flex-col text-xs text-slate-400"
          style={{ left: x }}
        >
          <div className="w-px h-2 bg-slate-500" />
          <div className="ml-1 mt-1">{formatTimeRuler(time)}</div>
        </div>
      );
    }
  }

  return <div className="relative h-full">{markers}</div>;
}

function formatTimeRuler(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
