import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { toMediaSrc } from "@/lib/mediaUrl";
import { onDesktopAvailable, isTauri } from "@/lib/platform";
import { useMediaStore } from "@/state/mediaStore";
import { useProbeStore } from "@/state/probeStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Grid3X3,
  Grid2X2,
  LayoutGrid,
  Folder,
  List,
  FileAudio,
} from "lucide-react";
import SelectedVideosTimeline from "./SelectedVideosTimeline";
import {
  getAspectRatioClasses,
  getObjectFitStyle,
  getObjectPosition,
  estimateAspectRatioFromVideo,
  type AspectRatio,
} from "@/lib/aspectRatio";

const VIDEO_EXT = new Set(["mp4", "mov", "mkv", "webm", "avi", "m4v"]);

type Clip = {
  path: string; // absolute path
  name: string; // file name
  ext: string; // lowercased extension
};

type LibraryPaneProps = {
  onSelectClip?: (absPath: string) => void;
  initialDir?: string;
  onDirChange?: (dir: string) => void;
};

export default function LibraryPane({
  onSelectClip,
  initialDir,
  onDirChange,
}: LibraryPaneProps) {
  const [dir, setDir] = useState<string | undefined>(initialDir);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [_inlinePlayback] = useState(true); // Always enabled as requested
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "compact" | "thumbnail">(
    "grid"
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [activeTab, setActiveTab] = useState<"browser" | "timeline">("browser");
  const CLIPS_PER_PAGE = 100; // Limit to prevent performance issues

  const {
    setClipsDir,
    setSongPath,
    songPath,
    selectedClipIds,
    toggleClipSelection,
    clearSelection,
    setSelectedClips,
  } = useMediaStore();

  // Probe store for media analysis
  const { requestFileProbe, getFileProbeStatus } = useProbeStore();

  // Trigger probing when clips are selected
  const handleClipSelection = useCallback(
    (clipPath: string) => {
      toggleClipSelection(clipPath);

      // Set as current clip for video editor when selected
      if (!selectedClipIds.has(clipPath)) {
        onSelectClip?.(clipPath);
      }

      // Start probing the file when it's selected (if not already probed/probing)
      const status = getFileProbeStatus(clipPath);
      if (!status || status.status === "error") {
        requestFileProbe(clipPath);
      }
    },
    [
      toggleClipSelection,
      requestFileProbe,
      getFileProbeStatus,
      selectedClipIds,
      onSelectClip,
    ]
  );

  // Paginated clips
  const paginatedClips = useMemo(() => {
    const startIndex = currentPage * CLIPS_PER_PAGE;
    return clips.slice(startIndex, startIndex + CLIPS_PER_PAGE);
  }, [clips, currentPage, CLIPS_PER_PAGE]);

  const totalPages = Math.ceil(clips.length / CLIPS_PER_PAGE);
  const hasMultiplePages = totalPages > 1;

  // Select all clips functionality
  const selectAllVisible = () => {
    const allVisiblePaths = paginatedClips.map((c) => c.path);
    const newSelection = new Set([...selectedClipIds, ...allVisiblePaths]);
    setSelectedClips([...newSelection]);
  };

  const chooseDir = useCallback(async () => {
    // In browser mode, set a mock directory
    if (!isTauri()) {
      const mockDir = "media_samples"; // Use sample media folder
      setDir(mockDir);
      onDirChange?.(mockDir);
      setClipsDir(mockDir);
      return;
    }

    // Real Tauri directory picker
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked === "string" && picked.length) {
      setDir(picked);
      onDirChange?.(picked);
      setClipsDir(picked);
    }
  }, [onDirChange, setClipsDir]);

  const loadAudioFile = useCallback(async () => {
    // In browser mode, set a mock audio file
    if (!isTauri()) {
      const mockAudio = "media_samples/audio/sample.mp3";
      console.log("Browser mode: Mock audio file selected:", mockAudio);
      setSongPath(mockAudio);
      return;
    }

    // Real Tauri file picker
    const picked = await open({
      multiple: false,
      filters: [
        {
          name: "Audio Files",
          extensions: ["mp3", "wav", "flac", "aac", "ogg", "m4a"],
        },
      ],
    });
    if (typeof picked === "string" && picked.length) {
      console.log("Audio file selected:", picked);
      setSongPath(picked);
      // Audio loaded but beat analysis NOT started automatically to prevent freezing
      // User can manually start beat analysis from the timeline
    }
  }, [setSongPath]);

  useEffect(() => {
    if (!dir) {
      setClips([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Load mock clips in browser mode
        if (!isTauri()) {
          console.log("Browser mode: Loading mock clips");
          const mockClips = [
            {
              path: "media_samples/anime-1.mp4",
              name: "Anime Video.mp4",
              ext: "mp4",
            },
            {
              path: "media_samples/at-work_001.mp4",
              name: "At Work 1.mp4",
              ext: "mp4",
            },
            {
              path: "media_samples/cumshot-dance.mp4",
              name: "Dance Video.mp4",
              ext: "mp4",
            },
            {
              path: "media_samples/FINAL_00001.mp4",
              name: "Final Video 1.mp4",
              ext: "mp4",
            },
            {
              path: "media_samples/video.mp4",
              name: "Sample Video.mp4",
              ext: "mp4",
            },
          ];

          if (!cancelled) {
            setClips(mockClips);
          }
          setLoading(false);
          return;
        }

        // Real Tauri file loading
        const entries = await readDir(dir);

        const allFiles = entries
          .filter((e) => !!e.name) // ignore weird entries
          .map((e) => {
            const name = e.name;
            const ext = (name.split(".").pop() || "").toLowerCase();
            // Construct full path from directory and entry name
            const path = `${dir}/${name}`;
            return { path, name, ext };
          });

        const videoFiles = allFiles
          .filter((f) => VIDEO_EXT.has(f.ext))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!cancelled) {
          setClips(videoFiles);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dir]);

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-slate-700 bg-slate-900/50">
        <div className="flex">
          <button
            onClick={() => setActiveTab("browser")}
            className={`flex-1 px-3 py-2 text-sm flex items-center justify-center gap-2 transition-colors ${
              activeTab === "browser"
                ? "bg-slate-800 text-white border-b-2 border-blue-500"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Folder className="h-4 w-4" />
            Browse
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`flex-1 px-3 py-2 text-sm flex items-center justify-center gap-2 transition-colors ${
              activeTab === "timeline"
                ? "bg-slate-800 text-white border-b-2 border-blue-500"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <List className="h-4 w-4" />
            Timeline ({selectedClipIds.size})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "browser" ? (
        <div className="h-full flex flex-col">
          {/* Fixed header section */}
          <div className="flex-shrink-0 space-y-3 mb-2 p-3 bg-slate-900/50 border-b border-slate-700">
            {/* Top row: Directory and Audio selection - side by side layout */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={chooseDir} className="flex-1">
                Add Videos
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={loadAudioFile}
                className="flex-1 flex items-center justify-center gap-1"
              >
                <FileAudio className="h-3 w-3" />
                Add Music
              </Button>
            </div>

            {/* Directory path */}
            <div className="text-xs text-neutral-400 truncate">
              {dir || "No folder selected"}
            </div>

            {/* Audio file status */}
            {songPath && (
              <Badge variant="secondary" className="text-xs">
                {songPath.split("/").pop()?.split("\\").pop() || "Audio loaded"}
              </Badge>
            )}

            {/* Selection controls */}
            {clips.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllVisible}
                    className="text-xs"
                  >
                    Select All ({paginatedClips.length})
                  </Button>
                  {selectedClipIds.size > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSelection}
                      className="text-xs"
                    >
                      Clear ({selectedClipIds.size})
                    </Button>
                  )}
                </div>

                {/* View mode toggle */}
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={viewMode === "grid" ? "default" : "outline"}
                    onClick={() => setViewMode("grid")}
                    className="text-xs px-2"
                    title="Grid View"
                  >
                    <Grid3X3 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "compact" ? "default" : "outline"}
                    onClick={() => setViewMode("compact")}
                    className="text-xs px-2"
                    title="Compact View"
                  >
                    <Grid2X2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "thumbnail" ? "default" : "outline"}
                    onClick={() => setViewMode("thumbnail")}
                    className="text-xs px-2"
                    title="Thumbnail View"
                  >
                    <LayoutGrid className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Selection status */}
            {selectedClipIds.size > 0 && (
              <div className="text-xs text-green-400">
                {selectedClipIds.size} of {clips.length} clips selected
              </div>
            )}

            {/* Pagination controls */}
            {hasMultiplePages && (
              <div className="flex items-center justify-between">
                <div className="text-xs text-neutral-400">
                  Page {currentPage + 1} of {totalPages} ({clips.length} total)
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    className="text-xs px-2"
                  >
                    ←
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
                    }
                    disabled={currentPage === totalPages - 1}
                    className="text-xs px-2"
                  >
                    →
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable content area - constrained to parent width */}
          <div className="flex-1 min-h-0 rounded-lg border border-neutral-800 overflow-y-auto overflow-x-hidden p-2 bg-neutral-950">
            {loading && (
              <div className="p-4 text-neutral-400 text-sm">
                Scanning directory...
              </div>
            )}
            {err && (
              <div className="p-4 text-rose-300 text-sm">Error: {err}</div>
            )}
            {!loading && !err && clips.length === 0 && (
              <div className="p-4 text-neutral-400 text-sm">
                No videos in this folder.
              </div>
            )}

            {/* Grid with fixed small sizes to prevent stretching */}
            {!loading && !err && clips.length > 0 && (
              <div
                className={`grid gap-2 w-full ${
                  viewMode === "thumbnail"
                    ? "grid-cols-[repeat(auto-fill,60px)]"
                    : viewMode === "compact"
                    ? "grid-cols-[repeat(auto-fill,80px)]"
                    : "grid-cols-[repeat(auto-fill,120px)]"
                }`}
              >
                {paginatedClips.map((c) => {
                  const normPath = c.path.replace(/\\/g, "/");
                  const playing = currentlyPlaying === normPath;

                  return (
                    <ClipTile
                      key={normPath}
                      clip={{ ...c, path: normPath }}
                      isSelected={selectedClipIds.has(normPath)}
                      onToggleSelect={() => handleClipSelection(normPath)}
                      onPreview={() => onSelectClip?.(normPath)} // always update main preview
                      enableInlinePlayback={true} // keep inline playback
                      isPlaying={playing}
                      onPlayStateChange={(next) => {
                        if (next) setCurrentlyPlaying(normPath);
                        else if (playing) setCurrentlyPlaying(null);
                      }}
                      compact={
                        viewMode === "compact" || viewMode === "thumbnail"
                      }
                      thumbnail={viewMode === "thumbnail"}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Fixed bottom bar for key actions */}
          {selectedClipIds.size > 0 && (
            <div className="flex-shrink-0 p-3 bg-slate-900/50 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-green-400">
                  {selectedClipIds.size} videos ready for editing
                </div>
                <Button size="sm" className="text-xs">
                  Create Video →
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <SelectedVideosTimeline onSelectClip={onSelectClip} />
      )}
    </div>
  );
}

function ClipTile({
  clip,
  isSelected,
  onToggleSelect,
  onPreview,
  enableInlinePlayback = false,
  isPlaying = false,
  onPlayStateChange,
  compact = false,
  thumbnail = false,
}: {
  clip: Clip;
  isSelected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  enableInlinePlayback?: boolean;
  isPlaying?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
  compact?: boolean;
  thumbnail?: boolean;
}) {
  const [src, setSrc] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("landscape");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [tauriReadyTick, setTauriReadyTick] = useState(0);

  // Detect aspect ratio when video metadata loads
  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      const detectedRatio = estimateAspectRatioFromVideo(videoRef.current);
      setAspectRatio(detectedRatio);
    }
  };

  // Effect to handle video playback state
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying && enableInlinePlayback) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isPlaying, enableInlinePlayback]);

  useEffect(() => {
    const off = onDesktopAvailable(() => setTauriReadyTick((t) => t + 1));
    return off;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resolved = await toMediaSrc(clip.path);
        if (!cancelled) setSrc(resolved);
      } catch {
        if (!cancelled) setSrc("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clip.path, tauriReadyTick]);

  return (
    <div
      className={`group relative rounded-md overflow-hidden bg-neutral-900 border-2 transition-all cursor-pointer w-full max-w-[200px] ${
        isSelected
          ? "border-green-500 shadow-lg shadow-green-500/20"
          : "border-transparent hover:border-neutral-600"
      }`}
      onClick={() => {
        onToggleSelect(); // toggle selection (checkmark)
        onPreview(); // update main preview
        if (enableInlinePlayback) {
          onPlayStateChange?.(!isPlaying); // keep inline playback behavior
        }
      }}
      title={clip.name}
    >
      {/* Selection indicator - checkmark only */}
      {isSelected && (
        <div
          className={`absolute ${
            thumbnail ? "top-1 right-1 w-8 h-8" : "top-2 right-2 w-12 h-12"
          } z-50 rounded-full bg-green-500 flex items-center justify-center shadow-2xl border-4 border-white animate-bounce`}
          style={{ backgroundColor: "#10b981" }}
        >
          <svg
            className={`${
              thumbnail ? "w-4 h-4" : "w-8 h-8"
            } text-white drop-shadow-lg font-bold`}
            fill="currentColor"
            viewBox="0 0 20 20"
            style={{ filter: "drop-shadow(0 0 4px rgba(0,0,0,0.8))" }}
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      {/* Preview button/video */}
      <div className="relative w-full">
        {enableInlinePlayback ? (
          // Inline playable video
          <>
            {src ? (
              <video
                ref={videoRef}
                src={src}
                preload="metadata"
                muted={!isPlaying}
                playsInline
                loop
                className={`w-full ${getObjectFitStyle()} bg-black ${getAspectRatioClasses(
                  aspectRatio,
                  thumbnail
                )}`}
                style={{
                  objectPosition: getObjectPosition(aspectRatio, thumbnail),
                }}
                controls={false}
                onLoadedMetadata={handleVideoLoadedMetadata}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(); // ensure checkmark toggles when video is clicked
                  onPreview(); // update main preview
                  onPlayStateChange?.(!isPlaying); // keep inline playback
                }}
              />
            ) : (
              <div
                className={`w-full grid place-items-center text-neutral-500 text-xs bg-black ${getAspectRatioClasses(
                  aspectRatio,
                  thumbnail
                )}`}
              >
                Loading...
              </div>
            )}

            {/* Play indicator */}
            {isPlaying && (
              <div className="absolute top-2 left-2 w-6 h-6 bg-black bg-opacity-60 rounded-full flex items-center justify-center z-10">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            )}
          </>
        ) : (
          // Preview button (original behavior)
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="group/preview relative w-full focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {/* Video preview with proper aspect ratio */}
            {src ? (
              <video
                src={src}
                preload="metadata"
                muted
                playsInline
                className={`w-full ${getObjectFitStyle()} bg-black ${getAspectRatioClasses(
                  aspectRatio,
                  thumbnail
                )}`}
                style={{
                  objectPosition: getObjectPosition(aspectRatio, thumbnail),
                }}
                onLoadedMetadata={handleVideoLoadedMetadata}
              />
            ) : (
              <div
                className={`w-full grid place-items-center text-neutral-500 bg-black ${getAspectRatioClasses(
                  aspectRatio,
                  thumbnail
                )} ${thumbnail ? "text-xs" : compact ? "text-xs" : "text-sm"}`}
              >
                no preview
              </div>
            )}
          </button>
        )}

        {/* Filename overlay - smaller overlay text */}
        <div className="absolute bottom-0 left-0 right-0 text-left px-2 py-1 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          <span
            className={`text-white/90 truncate block ${
              thumbnail
                ? "text-xs font-medium"
                : compact
                ? "text-xs font-medium"
                : "text-sm font-medium"
            }`}
          >
            {thumbnail
              ? clip.name.split(".")[0].substring(0, 8) + "..."
              : clip.name}
          </span>
        </div>
      </div>
    </div>
  );
}
