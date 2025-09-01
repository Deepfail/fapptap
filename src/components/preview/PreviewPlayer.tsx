import { useEffect, useMemo, useRef, useState } from "react";
import { toMediaSrc } from "@/lib/mediaUrl";

type PreviewPlayerProps = {
  /** Absolute path to a local video file */
  srcPath?: string;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  /** Called on time updates (rAF-friendly) */
  onTime?: (t: number) => void;
  /** Called when metadata is ready */
  onDuration?: (d: number) => void;
};

// tiny classnames helper (so we don't depend on "@/lib/utils")
const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export default function PreviewPlayer({
  srcPath,
  autoPlay,
  muted = true,
  className,
  onTime,
  onDuration,
}: PreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState<boolean>(!!autoPlay);
  const [duration, setDuration] = useState<number>(0);
  const [current, setCurrent] = useState<number>(0);

  const src = useMemo(() => toMediaSrc(srcPath || ""), [srcPath]);

  // metadata
  const handleLoaded = () => {
    const d = videoRef.current?.duration ?? 0;
    const dur = Number.isFinite(d) ? d : 0;
    setDuration(dur);
    onDuration?.(dur);
  };

  // time updates via rAF when playing (keeps everything in sync cleanly)
  useEffect(() => {
    let raf: number | null = null;
    const tick = () => {
      const t = videoRef.current?.currentTime ?? 0;
      setCurrent(t);
      onTime?.(t);
      raf = requestAnimationFrame(tick);
    };
    if (playing) raf = requestAnimationFrame(tick);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [playing, onTime]);

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      await v.play().catch(() => {
        /* autoplay might be blocked */
      });
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const seek = (deltaSec: number) => {
    const v = videoRef.current;
    if (!v) return;
    const next = Math.max(
      0,
      Math.min((v.currentTime || 0) + deltaSec, duration || 0)
    );
    v.currentTime = next;
    setCurrent(next);
    onTime?.(next);
  };

  return (
    <div
      className={cx(
        "w-full h-full relative rounded-xl overflow-hidden bg-black/70",
        className
      )}
    >
      {src ? (
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain bg-black"
          onLoadedMetadata={handleLoaded}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          controls={false}
          playsInline
          muted={muted}
          autoPlay={autoPlay}
          preload="metadata"
        />
      ) : (
        <div className="grid place-items-center w-full h-full text-sm text-neutral-400">
          Select a clip to preview.
        </div>
      )}

      {/* simple transport overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-neutral-900/70 backdrop-blur px-3 py-2 flex items-center gap-2 text-neutral-100">
        <button
          type="button"
          onClick={togglePlay}
          className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-sm"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => seek(-0.5)}
          className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-sm"
          title="Back 0.5s"
        >
          -0.5s
        </button>
        <button
          type="button"
          onClick={() => seek(+0.5)}
          className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-sm"
          title="Forward 0.5s"
        >
          +0.5s
        </button>
        <div className="ml-auto text-xs tabular-nums">
          {formatTime(current)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
}

function formatTime(t: number) {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
