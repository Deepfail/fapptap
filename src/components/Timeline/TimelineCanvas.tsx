import { useRef, useEffect } from "react";
import { usePlayerStore } from "@/state/playerStore";
import { formatTime } from "@/utils/timelineUtils";

interface TimelineCanvasProps {
  width: number;
  height: number;
  className?: string;
}

export function TimelineCanvas({
  width,
  height,
  className,
}: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    currentTime,
    beats,
    cuts,
    selectedCutId,
    pixelsPerSecond,
    scrollLeft,
  } = usePlayerStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Throttle canvas updates during scrolling
    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Clear canvas
      ctx.fillStyle = "#0f172a"; // slate-900
      ctx.fillRect(0, 0, width, height);

      // Calculate visible time range
      const startTime = scrollLeft / pixelsPerSecond;
      const endTime = (scrollLeft + width) / pixelsPerSecond;

      // Only draw if we have valid data
      if (beats.length > 0) {
        drawBeats(
          ctx,
          beats,
          startTime,
          endTime,
          pixelsPerSecond,
          scrollLeft,
          height
        );
      }

      if (cuts.length > 0) {
        drawCuts(
          ctx,
          cuts,
          selectedCutId,
          startTime,
          endTime,
          pixelsPerSecond,
          scrollLeft,
          height
        );
      }

      // Draw playhead
      drawPlayhead(ctx, currentTime, pixelsPerSecond, scrollLeft, height);
    };

    // Use requestAnimationFrame for smoother rendering
    const frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [
    width,
    height,
    currentTime,
    beats,
    cuts,
    selectedCutId,
    pixelsPerSecond,
    scrollLeft,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ width, height }}
    />
  );
}

function drawBeats(
  ctx: CanvasRenderingContext2D,
  beats: any[],
  startTime: number,
  endTime: number,
  pixelsPerSecond: number,
  scrollLeft: number,
  _height: number
) {
  const visibleBeats = beats.filter(
    (b) => b.time >= startTime && b.time <= endTime
  );

  for (const beat of visibleBeats) {
    const x = beat.time * pixelsPerSecond - scrollLeft;
    const isDownbeat = beat.isDownbeat;

    // Beat line
    ctx.strokeStyle = isDownbeat ? "#22d3ee" : "#64748b"; // cyan-400 : slate-500
    ctx.lineWidth = isDownbeat ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x, 30);
    ctx.stroke();

    // Beat dot
    ctx.fillStyle = isDownbeat ? "#22d3ee" : "#64748b";
    ctx.beginPath();
    ctx.arc(x, 20, isDownbeat ? 4 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCuts(
  ctx: CanvasRenderingContext2D,
  cuts: any[],
  selectedCutId: string | undefined,
  startTime: number,
  endTime: number,
  pixelsPerSecond: number,
  scrollLeft: number,
  _height: number
) {
  const visibleCuts = cuts.filter(
    (cut) => cut.end >= startTime && cut.start <= endTime
  );

  for (const cut of visibleCuts) {
    const startX = cut.start * pixelsPerSecond - scrollLeft;
    const endX = cut.end * pixelsPerSecond - scrollLeft;
    const width = endX - startX;
    const isSelected = cut.id === selectedCutId;

    // Cut background
    ctx.fillStyle = isSelected ? "#3b82f6" : "#475569"; // blue-500 : slate-600
    ctx.fillRect(startX, 40, width, 40);

    // Cut border
    ctx.strokeStyle = isSelected ? "#1d4ed8" : "#334155"; // blue-700 : slate-700
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, 40, width, 40);

    // Handle for resizing (left)
    ctx.fillStyle = isSelected ? "#1e40af" : "#334155"; // blue-800 : slate-700
    ctx.fillRect(startX, 40, 8, 40);

    // Handle for resizing (right)
    ctx.fillRect(endX - 8, 40, 8, 40);

    // Cut label
    if (width > 60) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(formatTime(cut.end - cut.start), startX + width / 2, 65);
    }
  }
}

function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  pixelsPerSecond: number,
  scrollLeft: number,
  height: number
) {
  const x = currentTime * pixelsPerSecond - scrollLeft;

  // Playhead line
  ctx.strokeStyle = "#ef4444"; // red-500
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();

  // Playhead handle
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(x - 6, 0);
  ctx.lineTo(x + 6, 0);
  ctx.lineTo(x, 12);
  ctx.closePath();
  ctx.fill();
}
