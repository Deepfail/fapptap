/**
 * Beat Strip - Shows beat markers and allows scrubbing
 */
import { useRef, useEffect, useState } from "react";
import { useEditor } from "@/state/editorStore";

interface Beat {
  time: number;
  isDownbeat?: boolean;
}

export function BeatStrip() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { playhead, setPlayhead, pixelsPerSecond } = useEditor();
  const [beats, setBeats] = useState<Beat[]>([]);
  const [duration, setDuration] = useState(120); // Default 2 minutes
  const [isDragging, setIsDragging] = useState(false);

  // Load beats from cache when available
  useEffect(() => {
    const loadBeats = async () => {
      try {
        const response = await fetch("/cache/beats.json");
        if (response.ok) {
          const beatsData = await response.json();
          const beatArray: Beat[] = beatsData.beats.map((b: any, index: number) => ({
            time: b.time,
            isDownbeat: index % 4 === 0, // Simple downbeat detection
          }));
          setBeats(beatArray);
          
          // Set duration based on last beat + some padding
          if (beatArray.length > 0) {
            const lastBeat = beatArray[beatArray.length - 1];
            setDuration(lastBeat.time + 10);
          }
        }
      } catch (error) {
        console.log("No beats data available yet");
      }
    };

    loadBeats();
  }, []);

  // Draw the beat strip
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = "#1f2937"; // gray-800
    ctx.fillRect(0, 0, width, height);

    // Draw beats
    beats.forEach((beat) => {
      const x = beat.time * pixelsPerSecond;
      if (x >= 0 && x <= width) {
        ctx.strokeStyle = beat.isDownbeat ? "#3b82f6" : "#6b7280"; // blue-500 or gray-500
        ctx.lineWidth = beat.isDownbeat ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    });

    // Draw playhead
    const playheadX = playhead * pixelsPerSecond;
    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = "#ef4444"; // red-500
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }

    // Draw time markers every 10 seconds
    ctx.fillStyle = "#9ca3af"; // gray-400
    ctx.font = "10px monospace";
    for (let t = 0; t <= duration; t += 10) {
      const x = t * pixelsPerSecond;
      if (x >= 0 && x <= width) {
        const minutes = Math.floor(t / 60);
        const seconds = Math.floor(t % 60);
        const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        ctx.fillText(timeText, x + 2, height - 4);
      }
    }
  }, [beats, playhead, pixelsPerSecond, duration]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updatePlayhead(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      updatePlayhead(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updatePlayhead = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newTime = Math.max(0, x / pixelsPerSecond);
    setPlayhead(Math.min(newTime, duration));
  };

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="absolute top-2 left-2 text-xs text-gray-400">
        {beats.length > 0 ? `${beats.length} beats detected` : "No beats data"}
      </div>
    </div>
  );
}