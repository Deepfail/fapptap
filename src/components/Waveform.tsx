import WaveSurfer from "wavesurfer.js";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Play, Pause, Square } from "lucide-react";

interface WaveformProps {
  audioPath: string;
  beats?: number[];
  downbeats?: number[];
  tempoCurve?: number[];
}

export function Waveform({
  audioPath,
  beats = [],
  downbeats = [],
  tempoCurve = [],
}: WaveformProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!waveformRef.current) return;

    // Initialize WaveSurfer
    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      height: 96,
      waveColor: "#666",
      progressColor: "#ddd",
      cursorColor: "#3b82f6",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });

    // Load audio file
    wavesurferRef.current.load(audioPath);

    // Event handlers
    wavesurferRef.current.on("ready", () => {
      setIsReady(true);
      setDuration(wavesurferRef.current?.getDuration() || 0);

      const wrapper = wavesurferRef.current?.getWrapper();
      if (!wrapper) return;

      // Clear existing markers
      const existingMarkers = wrapper.querySelectorAll(".beat-marker");
      existingMarkers.forEach((marker) => marker.remove());

      // Add beat markers
      beats.forEach((time) => {
        const strength = 1; // Default strength
        const color = `rgb(245, 158, 11, ${strength})`;
        const el = document.createElement("div");
        el.className = "beat-marker";
        el.style.cssText = `position:absolute;top:0;bottom:0;width:1px;background:${color};pointer-events:none;z-index:5;`;
        const px =
          (time / wavesurferRef.current!.getDuration()) * wrapper.clientWidth;
        el.style.left = `${px}px`;
        wrapper.appendChild(el);
      });

      // Add downbeat markers (thicker)
      downbeats.forEach((time) => {
        const el = document.createElement("div");
        el.className = "beat-marker downbeat";
        el.style.cssText =
          "position:absolute;top:0;bottom:0;width:2px;background:#f43f5e;pointer-events:none;z-index:6;";
        const px =
          (time / wavesurferRef.current!.getDuration()) * wrapper.clientWidth;
        el.style.left = `${px}px`;
        wrapper.appendChild(el);
      });
    });

    wavesurferRef.current.on("play", () => setIsPlaying(true));
    wavesurferRef.current.on("pause", () => setIsPlaying(false));
    wavesurferRef.current.on("finish", () => setIsPlaying(false));

    wavesurferRef.current.on("timeupdate", (time) => {
      setCurrentTime(time);
    });

    // Cleanup
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioPath, beats, downbeats]);

  const handlePlayPause = () => {
    if (!wavesurferRef.current) return;

    if (isPlaying) {
      wavesurferRef.current.pause();
    } else {
      wavesurferRef.current.play();
    }
  };

  const handleStop = () => {
    if (!wavesurferRef.current) return;

    wavesurferRef.current.stop();
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative">
      <div ref={waveformRef} className="w-full mb-2" />

      {/* Transport Controls */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handlePlayPause}
            disabled={!isReady}
            variant={isPlaying ? "default" : "outline"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isPlaying ? "Pause" : "Play"}
          </Button>

          <Button
            size="sm"
            onClick={handleStop}
            disabled={!isReady || !isPlaying}
            variant="outline"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Legend */}
      {(beats.length > 0 || downbeats.length > 0) && (
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {beats.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-amber-500 rounded-sm" />
              <span>Beats</span>
            </div>
          )}
          {downbeats.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-rose-500 rounded-sm" />
              <span>Downbeats</span>
            </div>
          )}
          {tempoCurve.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-sm" />
              <span>Tempo</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
