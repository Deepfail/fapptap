import { useEffect, useRef, useState, useCallback } from "react";
import { toMediaSrc, isMediaFile, toFileUrl } from "@/lib/mediaUrl";
import { IS_DESKTOP, onDesktopAvailable } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize2,
} from "lucide-react";
import { TimelineStrip } from "@/components/TimelineStrip";

type PreviewPlayerProps = {
  /** Absolute path to a local video file */
  srcPath?: string;
  autoPlay?: boolean;
  muted?: boolean;
  /** Called when playback starts */
  onPlay?: () => void;
  /** Called when playback pauses */
  onPause?: () => void;
  className?: string;
  /** Called on time updates (rAF-friendly) */
  onTime?: (t: number) => void;
  /** Called when metadata is ready */
  onDuration?: (d: number) => void;
  /** Called on load error */
  onError?: (err: string) => void;
  /** Show overlay transport controls */
  showOverlay?: boolean;
  /** Enable global keyboard shortcuts (space/k play-pause, j/l skip, arrows nudge, [/] ends) */
  enableShortcuts?: boolean;
  /** Include timeline strip beneath player */
  showTimelineStrip?: boolean;
  /** Auto hide controls after N ms while playing (0 disables) */
  autoHideMs?: number;
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
  onPlay,
  onPause,
  onError,
  showOverlay = true,
  enableShortcuts = true,
  showTimelineStrip = false,
  autoHideMs = 3000,
}: PreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState<boolean>(!!autoPlay);
  const [duration, setDuration] = useState<number>(0);
  const [current, setCurrent] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.5);
  const [error, setError] = useState<string | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string>("");
  const [resolving, setResolving] = useState<boolean>(false);
  const srcTokenRef = useRef(0); // race token to avoid stale async resolutions

  // ---- helpers ----
  const scheduleHide = useCallback(() => {
    if (!showOverlay || autoHideMs <= 0) return;
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, autoHideMs);
  }, [playing, showOverlay, autoHideMs]);

  const revealControls = useCallback(() => {
    if (!showOverlay) return;
    setShowControls(true);
    scheduleHide();
  }, [showOverlay, scheduleHide]);

  const handleLoaded = useCallback(() => {
    const d = videoRef.current?.duration ?? 0;
    const dur = Number.isFinite(d) ? d : 0;
    setDuration(dur);
    onDuration?.(dur);
    setError(null);
  }, [onDuration]);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    onPlay?.();
    revealControls();
  }, [revealControls, onPlay]);

  const handlePause = useCallback(() => {
    setPlaying(false);
    onPause?.();
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setShowControls(true);
  }, [onPause]);

  const handleError = useCallback(() => {
    let msg = "Unable to load video.";
    const mediaErr = (videoRef.current as any)?.error;
    if (mediaErr) {
      switch (mediaErr.code) {
        case mediaErr.MEDIA_ERR_ABORTED:
          msg = "Media load aborted";
          break;
        case mediaErr.MEDIA_ERR_NETWORK:
          msg = "Network error while fetching media";
          break;
        case mediaErr.MEDIA_ERR_DECODE:
          msg = "Decode error: unsupported codec or corrupt file";
          break;
        case mediaErr.MEDIA_ERR_SRC_NOT_SUPPORTED:
          msg = "Source not supported or permission denied";
          break;
        default:
          msg = "Unknown media error";
      }
    }
    // Fallback to file:// if asset: failed with connection refused
    if (
      msg.includes("Network error") &&
      resolvedSrc.startsWith("asset:") &&
      srcPath
    ) {
      const fileUrl = toFileUrl(srcPath);
      console.debug("Falling back to file:// URL", fileUrl);
      setResolvedSrc(fileUrl);
      return; // Don't set error yet, try file://
    }
    setError(msg);
    setPlaying(false);
    onError?.(msg);
    setShowControls(true);
  }, [onError, resolvedSrc, srcPath]);

  // rAF time updates (only when playing)
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

  const play = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (!playing) {
      await v.play().catch(() => {});
    }
    setPlaying(true);
    revealControls();
  }, [playing, revealControls]);

  const pause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setPlaying(false);
    setShowControls(true);
  }, []);

  const togglePlay = useCallback(() => {
    playing ? pause() : play();
  }, [playing, play, pause]);

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v || !Number.isFinite(duration)) return;
      const clamped = Math.max(0, Math.min(t, duration || 0));
      v.currentTime = clamped;
      setCurrent(clamped);
      onTime?.(clamped);
    },
    [duration, onTime]
  );

  const nudge = useCallback(
    (delta: number) => seekTo(current + delta),
    [current, seekTo]
  );

  // Volume persistence (localStorage for now; could move to store prefs)
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
    try {
      localStorage.setItem("fapptap-volume", String(volume));
    } catch {}
  }, [volume]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fapptap-volume");
      if (saved !== null) {
        const v = parseFloat(saved);
        if (!Number.isNaN(v)) setVolume(Math.min(1, Math.max(0, v)));
      }
    } catch {}
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    if (!enableShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "j":
          e.preventDefault();
          nudge(-10);
          break;
        case "l":
          e.preventDefault();
          nudge(+10);
          break;
        case "arrowleft":
          e.preventDefault();
          nudge(-1);
          break;
        case "arrowright":
          e.preventDefault();
          nudge(+1);
          break;
        case "[":
          e.preventDefault();
          seekTo(0);
          break;
        case "]":
          e.preventDefault();
          seekTo(duration);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enableShortcuts, togglePlay, nudge, seekTo, duration]);

  // cleanup timers
  useEffect(
    () => () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    },
    []
  );

  // Resolve source (async) when path changes
  const [tauriReadyTick, setTauriReadyTick] = useState(0);
  useEffect(() => {
    const off = onDesktopAvailable(() => setTauriReadyTick((t) => t + 1));
    return off;
  }, []);

  useEffect(() => {
    const token = ++srcTokenRef.current;
    if (!srcPath) {
      setResolvedSrc("");
      setCurrent(0);
      setDuration(0);
      return;
    }
    if (!isMediaFile(srcPath)) {
      setResolvedSrc("");
      setError("Unsupported media type");
      return;
    }
    setResolving(true);
    setError(null);
    (async () => {
      try {
        const resolved = await toMediaSrc(srcPath);
        if (token !== srcTokenRef.current) return; // stale
        console.debug("PreviewPlayer resolved src", {
          original: srcPath,
          resolved,
        });
        setResolvedSrc(resolved);
      } catch (e: any) {
        if (token !== srcTokenRef.current) return;
        const msg = e?.message || "Failed to resolve media path";
        setError(msg);
        onError?.(msg);
      } finally {
        if (token === srcTokenRef.current) setResolving(false);
      }
    })();
  }, [srcPath, tauriReadyTick, onError]);

  // If the video errors with an asset localhost refusal, attempt one retry after slight delay.
  const retriedRef = useRef(false);
  useEffect(() => {
    if (!error || retriedRef.current) return;
    if (/connection refused/i.test(error)) {
      retriedRef.current = true;
      setTimeout(async () => {
        try {
          const forced = await toMediaSrc(srcPath || "");
          console.debug("Retrying video source after error", { forced });
          setResolvedSrc(forced);
          setError(null);
        } catch {}
      }, 400);
    }
  }, [error, srcPath]);

  return (
    <div
      className={cx(
        "w-full h-full relative rounded-xl overflow-hidden bg-black/70 flex flex-col",
        className
      )}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (playing && autoHideMs > 0 && showOverlay) scheduleHide();
      }}
    >
      {/* Video region */}
      <div className="relative flex-1 bg-black" style={{ maxHeight: '80vh' }}>
        {resolvedSrc ? (
          <video
            ref={videoRef}
            src={resolvedSrc}
            className="w-full h-full object-contain bg-black"
            onLoadedMetadata={handleLoaded}
            onPlay={handlePlay}
            onPause={handlePause}
            onError={handleError}
            controls={false}
            playsInline
            muted={muted}
            autoPlay={autoPlay}
            preload="metadata"
          />
        ) : resolving ? (
          <div className="grid place-items-center w-full h-full text-sm text-neutral-400">
            Resolving media path...
          </div>
        ) : (
          <div className="grid place-items-center w-full h-full text-sm text-neutral-400">
            Select a clip to preview.
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center">
            <div>
              <p className="text-red-400 mb-2">⚠ Playback Error</p>
              <p className="text-xs text-neutral-300">{error}</p>
            </div>
          </div>
        )}

        {showOverlay && (
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Center play/pause */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Button
                size="lg"
                variant="secondary"
                className="rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm pointer-events-auto"
                onClick={togglePlay}
              >
                {playing ? (
                  <Pause className="h-8 w-8" />
                ) : (
                  <Play className="h-8 w-8" />
                )}
              </Button>
            </div>

            {/* Bottom transport */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 space-y-3">
              {/* Seek */}
              <Slider
                value={[current]}
                max={duration || 0}
                step={0.05}
                onValueChange={(v) => seekTo(v[0] ?? 0)}
              />
              <div className="flex items-center justify-between text-neutral-100 gap-4">
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => nudge(-10)}>
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={togglePlay}>
                    {playing ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => nudge(+10)}>
                    <SkipForward className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2 ml-3">
                    <Volume2 className="h-4 w-4" />
                    <Slider
                      value={[volume]}
                      max={1}
                      step={0.05}
                      onValueChange={(v) => setVolume(v[0] ?? 0)}
                      className="w-24"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs tabular-nums">
                  <span>
                    {formatTime(current)} / {formatTime(duration)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const v = videoRef.current;
                      if (!v) return;
                      if (IS_DESKTOP) {
                        try {
                          const { getCurrentWindow } = await import(
                            "@tauri-apps/api/window"
                          );
                          const win = getCurrentWindow();
                          const maximized = await win.isMaximized();
                          maximized
                            ? await win.unmaximize()
                            : await win.maximize();
                        } catch {}
                      } else if (document.fullscreenElement) {
                        await document.exitFullscreen().catch(() => {});
                      } else {
                        await v.requestFullscreen?.().catch(() => {});
                      }
                    }}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-[10px] text-neutral-400 text-center">
                Space/K Play/Pause • J/L ±10s • ←/→ ±1s • [/ ] Ends
              </div>
            </div>
          </div>
        )}
      </div>

      {showTimelineStrip && (
        <div className="border-t border-neutral-700">
          <TimelineStrip />
        </div>
      )}
    </div>
  );
}

function formatTime(t: number) {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
