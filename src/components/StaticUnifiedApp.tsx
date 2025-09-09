/**
 * FAPPTap - Static UI with file browser, permanent video player, everything always visible
 */

import { useState, useCallback, useRef, useEffect } from "react";
import AppShell from "@/ui/AppShell";
import { HeaderStatus, HeaderButtons } from "@/ui/Header";
import Sidebar from "@/ui/Sidebar";
import Inspector from "@/ui/Inspector";
import TimelineBar from "@/ui/TimelineBar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEditor } from "@/state/editorStore";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { toMediaSrc } from "@/lib/mediaUrl";
import { onDesktopAvailable } from "@/lib/platform";
import {
  Play,
  Square,
  Music,
  Video,
  Wand2,
  Download,
  Plus,
  Zap,
  Sparkles,
  RotateCcw,
  Folder,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
// theme variables are imported globally from App entry so remove local import here
import { isTauriAvailable } from "@/lib/platform";

// File browser item
interface FileItem {
  path: string;
  name: string;
  type: "video" | "audio" | "folder";
  thumbnail?: string;
  duration?: number;
}

// Video thumbnail component that properly handles file URLs
const VideoThumbnail = ({ filePath }: { filePath: string }) => {
  const [src, setSrc] = useState<string>("");
  const [error, setError] = useState(false);
  const [tauriReady, setTauriReady] = useState(false);

  useEffect(() => {
    const off = onDesktopAvailable(() => setTauriReady(true));
    return off;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resolved = await toMediaSrc(filePath);
        if (!cancelled) {
          setSrc(resolved);
          setError(false);
        }
      } catch (err) {
        console.error("Failed to resolve media src:", err);
        if (!cancelled) {
          setError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filePath, tauriReady]);

  if (error || !src) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <Video className="w-8 h-8 text-white/90" />
      </div>
    );
  }

  return (
    <video
      className="w-full h-full object-cover"
      src={src}
      muted
      preload="metadata"
      onLoadedMetadata={(e) => {
        // Seek to 1 second to get a good thumbnail frame
        const video = e.target as HTMLVideoElement;
        if (video.duration > 1) {
          video.currentTime = 1;
        }
      }}
      onError={() => {
        setError(true);
      }}
    />
  );
};

// App state - everything always visible
interface AppState {
  // File browser
  currentDirectory: string;
  files: FileItem[];

  // Pagination
  currentPage: number;
  itemsPerPage: number;
  totalFiles: number;
  isLoadingFiles: boolean;

  // Selected media (in order)
  selectedVideos: FileItem[];
  selectedAudio: FileItem | null;

  // Video player
  currentVideo: FileItem | null;
  currentVideoUrl: string; // Converted URL for video element
  currentVideoIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;

  // Generation
  isGenerating: boolean;
  generationProgress: number;
  generationStage: string;
  hasTimeline: boolean;

  // Preview
  isPreviewPlaying: boolean;

  // Export
  isExporting: boolean;
  exportProgress: number;

  // Settings (always visible)
  tempo: number;
  cuttingMode: "slow" | "medium" | "fast" | "ultra_fast";
  effects: string[];
  videoFormat: "landscape" | "portrait" | "square";
  // New cut settings exposed to UI
  minCutLength: number; // override in seconds; 0 means use mode default
  beatStride: number;
  snapToShots: boolean;
  snapTolerance: number;

  // Timeline state (cuts now managed by EditorStore)
  isRandomized: boolean;

  // Beat data
  beatData: { time: number; confidence: number }[];
  hasBeatData: boolean;
}

// TimelineCut type removed - timeline is now managed by EditorStore

// Effects available
const AVAILABLE_EFFECTS = [
  { id: "flash", label: "Flash", icon: Zap, color: "bg-yellow-500" },
  { id: "zoom", label: "Zoom", icon: Plus, color: "bg-blue-500" },
  { id: "shake", label: "Shake", icon: RotateCcw, color: "bg-red-500" },
  { id: "prism", label: "Prism", icon: Sparkles, color: "bg-purple-500" },
  { id: "rgb", label: "RGB", icon: Sparkles, color: "bg-green-500" },
  { id: "glitch", label: "Glitch", icon: Zap, color: "bg-pink-500" },
];

const CUTTING_MODES = [
  { value: "slow" as const, label: "Slow" },
  { value: "medium" as const, label: "Medium" },
  { value: "fast" as const, label: "Fast" },
  { value: "ultra_fast" as const, label: "Ultra" },
];

const VIDEO_FORMATS = [
  {
    value: "landscape" as const,
    label: "Landscape",
    icon: "🖥️",
    aspect: "16:9",
  },
  { value: "portrait" as const, label: "Portrait", icon: "📱", aspect: "9:16" },
  { value: "square" as const, label: "Square", icon: "⬜", aspect: "1:1" },
];

export function StaticUnifiedApp() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Use the editor store
  const editor = useEditor();

  // Local UI state (minimal defaults)
  const initialState: AppState = {
    currentDirectory: "",
    files: [],
    currentPage: 0,
    itemsPerPage: 40,
    totalFiles: 0,
    isLoadingFiles: false,
    selectedVideos: [],
    selectedAudio: null,
    currentVideo: null,
    currentVideoUrl: "",
    currentVideoIndex: 0,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isGenerating: false,
    generationProgress: 0,
    generationStage: "",
    hasTimeline: false,
    isPreviewPlaying: false,
    isExporting: false,
    exportProgress: 0,
    tempo: 100,
    cuttingMode: "medium",
    effects: [],
    videoFormat: "landscape",
    minCutLength: 0,
    beatStride: 1,
    snapToShots: false,
    snapTolerance: 0.08,
    isRandomized: false,
    beatData: [],
    hasBeatData: false,
  };

  const [state, setState] = useState<AppState>(initialState);

  // Minimal helper stubs to keep the UI building while we wire the new shell
  const browseFolder = async () => {
    console.debug("browseFolder - stub");
  };
  const selectAudioFile = async () => {
    console.debug("selectAudioFile - stub");
  };
  const selectVideo = (file: FileItem) => {
    setState((prev) => ({ ...prev, currentVideo: file, currentVideoUrl: "" }));
  };
  const selectAudio = (file: FileItem) => {
    console.debug("selectAudio", file.path);
    setState((prev) => ({ ...prev, selectedAudio: file }));
  };
  const getCurrentPageFiles = () => state.files.slice(0, state.itemsPerPage);
  const prevPage = () => setState((p) => ({ ...p, currentPage: Math.max(0, p.currentPage - 1) }));
  const nextPage = () => setState((p) => ({ ...p, currentPage: p.currentPage + 1 }));
  const canPrevPage = state.currentPage > 0;
  const canNextPage = (state.currentPage + 1) * state.itemsPerPage < state.totalFiles;
  const totalPages = Math.max(1, Math.ceil(state.totalFiles / state.itemsPerPage));
  const handleGenerate = async () => {
    console.debug("handleGenerate - stub");
  };
  const handleExport = async () => {
    console.debug("handleExport - stub");
  };
  const loadCutlistIntoEditor = async () => {
    console.debug("loadCutlistIntoEditor - stub");
    return [] as any[];
  };
  const toggleTimelineItemEffect = (id: string) => {
    console.debug("toggleTimelineItemEffect", id);
  };
  const getFileProbeStatus = (path: string) => {
    console.debug("getFileProbeStatus", path);
    return "idle" as string;
  };
  const getFileProbeData = (path: string) => {
    console.debug("getFileProbeData", path);
    return null as any;
  };
  const playVideo = () => setState((p) => ({ ...p, isPlaying: true }));
  const pauseVideo = () => setState((p) => ({ ...p, isPlaying: false }));
  const prevVideo = () => console.debug("prevVideo - stub");
  const nextVideo = () => console.debug("nextVideo - stub");
  const handlePreview = async () => console.debug("handlePreview - stub");

  // Helper that tries several file locations as specified in fix-plan.md
  const readJsonFromCandidates = useCallback(
    async (candidates: string[]): Promise<any | null> => {
      for (const p of candidates) {
        try {
          const txt = await readTextFile(p);
          return JSON.parse(txt);
        } catch {
          // keep trying
        }
      }
      return null;
    },
    []
  );

  // Prepare a fresh session clips directory containing only the selected clips.
  // Returns { sessionId, sessionRoot, clipsDir }
  const prepareSessionClipsDir = useCallback(
    async (selectedPaths: string[]) => {
      console.debug("prepareSessionClipsDir", selectedPaths.length);
      // Minimal implementation for now: compute paths under appDataDir (desktop)
      const baseDir = isTauriAvailable()
        ? (await appDataDir()).replace(/\\+/g, "/")
        : "/tmp/fapptap";
      const sessionId = `session-${Date.now()}`;
      const sessionRoot = `${baseDir}/sessions/${sessionId}`;
      const clipsDir = `${sessionRoot}/clips`;
      return { sessionId, sessionRoot, clipsDir };
    },
    []
  );

  // Temporary: ensure prepareSessionClipsDir is retained by referencing it in an effect
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await prepareSessionClipsDir([]);
        if (mounted) {
          // noop - just reference
          console.debug("prepared session path stub", p.sessionRoot);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [prepareSessionClipsDir]);

  // Load beat data (from cache or appDataDir). This was previously mangled by a bad edit.
  const loadBeatData = useCallback(async () => {
    try {
      let beatJson: any;

      if (isTauriAvailable()) {
        const appDir = (await appDataDir()).replace(/\\+/g, "/");
        beatJson =
          (await readJsonFromCandidates([
            "cache/beats.json",
            `${appDir}/cache/beats.json`,
            "render/beats.json",
            `${appDir}/render/beats.json`,
          ])) || {};
      } else {
        // Browser fallback: read from cache/beats.json
        const response = await fetch("/cache/beats.json");
        if (!response.ok) {
          throw new Error(`Failed to fetch beats: ${response.statusText}`);
        }
        const beatContent = await response.text();
        beatJson = JSON.parse(beatContent);
      }

      // Accept multiple shapes: legacy beats_sec: number[] OR beats: number[] OR beats: [{time}] (advanced)
      let times: number[] = [];

      if (Array.isArray(beatJson.beats_sec) && beatJson.beats_sec.length > 0) {
        times = beatJson.beats_sec.map((n: any) => Number(n));
      } else if (Array.isArray(beatJson.beats) && beatJson.beats.length > 0) {
        // beats may be numbers or objects like {time: number}
        times = beatJson.beats.map((b: any) =>
          typeof b === "number" ? Number(b) : Number(b.time)
        );
      }

      const beats = times.map((t) => ({ time: t, confidence: 1.0 }));

      setState((prev) => ({
        ...prev,
        beatData: beats,
        hasBeatData: beats.length > 0,
      }));

      if (beats.length > 0) {
        toast.success(`Loaded ${beats.length} beats from audio analysis`);
      }
    } catch (error) {
      console.error("Failed to load beat data:", error);
      setState((prev) => ({
        ...prev,
        beatData: [],
        hasBeatData: false,
      }));
    }
  }, [readJsonFromCandidates]);

  // Effect: Load beat data when audio is selected
  useEffect(() => {
    if (state.selectedAudio && !state.hasBeatData) {
      loadBeatData();
    }
  }, [state.selectedAudio, state.hasBeatData, loadBeatData]);

  return (
    <AppShell
      headerLeft={<HeaderStatus text={state.generationStage || ""} />}
      headerRight={<HeaderButtons />}
      sidebar={<Sidebar selectionCount={editor.timeline.length} audioSet={!!state.selectedAudio} />}
      inspector={<Inspector />}
      timeline={<TimelineBar />}
    >
      <div className="h-screen bg-slate-900 text-white flex overflow-hidden">
      {/* Left Column - File Browser (FIXED 25% WIDTH, THUMBNAILS ONLY) */}
      <div className="w-1/4 border-r border-slate-700 bg-slate-800 flex flex-col">
        {/* Browser Header - Select All & Randomize */}
        <div className="p-2 border-b border-slate-700">
          <div className="flex gap-1 justify-center mb-2">
            <Button variant="outline" size="sm" onClick={browseFolder}>
              <Folder className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={selectAudioFile}>
              <Music className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                // Select all videos in current folder
                const videos = state.files.filter((f) => f.type === "video");
                setState((prev) => ({
                  ...prev,
                  selectedVideos: [
                    ...prev.selectedVideos,
                    ...videos.filter(
                      (v) =>
                        !prev.selectedVideos.some((sv) => sv.path === v.path)
                    ),
                  ],
                  currentVideo: prev.currentVideo || videos[0],
                  currentVideoIndex: prev.currentVideo
                    ? prev.currentVideoIndex
                    : 0,
                }));
                if (videos.length > 0)
                  toast.success(`Added ${videos.length} videos`);
              }}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`flex-1 text-xs ${
                state.isRandomized ? "bg-purple-600 text-white" : ""
              }`}
              disabled={!state.hasTimeline || editor.timeline.length === 0}
              onClick={() => {
                // Toggle randomize timeline cuts order
                if (editor.timeline.length > 1) {
                  setState((prev) => {
                    if (prev.isRandomized) {
                      // Un-randomize: sort by original index (using timeline item id)
                      const sorted = [...editor.timeline].sort((a, b) => {
                        const aIndex = parseInt(
                          a.id.replace("timeline-item-", "")
                        );
                        const bIndex = parseInt(
                          b.id.replace("timeline-item-", "")
                        );
                        return aIndex - bIndex;
                      });

                      // Update timeline items with sequential start times
                      const reorderedItems = sorted.map((item, index) => {
                        const duration = item.out - item.in;
                        return {
                          ...item,
                          start: index * duration,
                        };
                      });

                      editor.updateTimelineItems(reorderedItems);
                      return {
                        ...prev,
                        isRandomized: false,
                      };
                    } else {
                      // Randomize
                      const shuffled = [...editor.timeline].sort(
                        () => Math.random() - 0.5
                      );

                      // Update timeline items with sequential start times
                      const reorderedItems = shuffled.map((item, index) => {
                        const duration = item.out - item.in;
                        return {
                          ...item,
                          start: index * duration,
                        };
                      });

                      editor.updateTimelineItems(reorderedItems);
                      return {
                        ...prev,
                        isRandomized: true,
                      };
                    }
                  });
                  toast.success(
                    state.isRandomized
                      ? "Timeline restored to original order!"
                      : "Timeline randomized!"
                  );
                }
              }}
            >
              {state.isRandomized ? "Original" : "Randomize"}
            </Button>
          </div>
        </div>

        {/* Thumbnails Grid - NO NAMES */}
        <div className="flex-1 overflow-y-auto p-1">
          {state.files.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <Folder className="w-12 h-12 mx-auto mb-2 text-slate-500" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={browseFolder}
                  className="text-xs"
                >
                  Browse
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {getCurrentPageFiles().map((file, index) => {
                // Check if this video is selected
                const isSelected =
                  file.type === "video" &&
                  state.selectedVideos.some((v) => v.path === file.path);

                return (
                  <div
                    key={index}
                    className={`relative group cursor-pointer rounded overflow-hidden border transition-all ${
                      file.type === "video"
                        ? isSelected
                          ? "border-green-400 bg-green-900/50 shadow-lg shadow-green-400/25" // Selected state
                          : "border-slate-600 bg-slate-800 hover:border-green-400"
                        : "border-slate-600 bg-slate-700 hover:border-purple-400"
                    }`}
                    onClick={() => {
                      if (file.type === "video") {
                        selectVideo(file);
                      } else if (file.type === "audio") {
                        selectAudio(file);
                      }
                    }}
                  >
                    {/* Show actual video thumbnails */}
                    <div className="aspect-square bg-slate-900 flex items-center justify-center relative overflow-hidden">
                      {file.type === "video" ? (
                        <div className="relative w-full h-full">
                          <VideoThumbnail filePath={file.path} />
                          {/* Fallback gradient background */}
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center -z-10">
                            <Video className="w-8 h-8 text-white/90" />
                          </div>
                          {/* Play overlay */}
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <Play className="w-6 h-6 text-white/90 drop-shadow-lg" />
                          </div>
                          <div className="absolute bottom-1 left-1 text-xs text-white/90 bg-black/50 px-1 rounded">
                            VIDEO
                          </div>
                          {/* Selection indicator */}
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                              <svg
                                className="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                      ) : file.type === "audio" ? (
                        <>
                          <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center">
                            <Music className="w-8 h-8 text-white/90" />
                          </div>
                          <div className="absolute bottom-1 left-1 text-xs text-white/90 bg-black/50 px-1 rounded">
                            AUDIO
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                            <Folder className="w-8 h-8 text-white/90" />
                          </div>
                          <div className="absolute bottom-1 left-1 text-xs text-white/90 bg-black/50 px-1 rounded">
                            FOLDER
                          </div>
                        </>
                      )}

                      {/* Selection indicator */}
                      {((file.type === "video" &&
                        state.selectedVideos.some(
                          (v) => v.path === file.path
                        )) ||
                        (file.type === "audio" &&
                          state.selectedAudio?.path === file.path)) && (
                        <div className="absolute inset-0 border-3 border-blue-400 bg-blue-400/20 rounded"></div>
                      )}

                      {/* Tiny type indicator with probe status */}
                      <div className="absolute top-1 right-1 flex flex-col gap-1">
                        {file.type === "video" && (
                          <>
                            <div className="bg-green-500 w-3 h-3 rounded-full border border-white/50"></div>
                            {(() => {
                              const probeStatus = getFileProbeStatus(file.path);
                              const probeColor =
                                probeStatus === "completed"
                                  ? "bg-green-400"
                                  : probeStatus === "pending"
                                  ? "bg-yellow-400"
                                  : probeStatus === "failed"
                                  ? "bg-red-400"
                                  : "bg-gray-400";
                              return (
                                <div
                                  className={`w-2 h-2 rounded-full ${probeColor}`}
                                  title={`Probe: ${probeStatus || "idle"}`}
                                />
                              );
                            })()}
                          </>
                        )}
                        {file.type === "audio" && (
                          <div className="bg-purple-500 w-3 h-3 rounded-full border border-white/50"></div>
                        )}
                      </div>

                      {/* Duration overlay from probe data */}
                      {file.type === "video" &&
                        (() => {
                          const probeData = getFileProbeData(file.path);
                          return probeData?.duration ? (
                            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
                              {Math.round(probeData.duration)}s
                            </div>
                          ) : null;
                        })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-2 flex items-center justify-between px-2 py-1 bg-slate-800/50 rounded">
              <Button
                variant="outline"
                size="sm"
                onClick={prevPage}
                disabled={!canPrevPage}
                className="w-8 h-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="text-xs text-slate-400">
                {state.currentPage + 1} / {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={nextPage}
                disabled={!canNextPage}
                className="w-8 h-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Bottom - Just Counter */}
        <div className="p-2 border-t border-slate-700 bg-slate-900">
          <div className="text-xs text-slate-400 text-center">
            Videos: {state.selectedVideos.length} | Audio:{" "}
            {state.selectedAudio ? "1" : "0"}
          </div>
        </div>
      </div>

      {/* Center - Video Player (ALWAYS PRESENT) */}
      <div className="flex-1 flex flex-col relative min-h-0">
        {/* Top Right Overlay - Format, Generate Preview & Export Final */}
        <div className="absolute top-4 right-4 z-10 flex gap-2 items-center">
          {/* Video Format Dropdown */}
          <div className="bg-slate-800 border border-slate-600 rounded-md">
            <Select
              value={state.videoFormat}
              onValueChange={(value: "landscape" | "portrait" | "square") =>
                setState((prev) => ({ ...prev, videoFormat: value }))
              }
            >
              <SelectTrigger className="w-32 h-10 bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {VIDEO_FORMATS.map((format) => (
                  <SelectItem
                    key={format.value}
                    value={format.value}
                    className="text-white hover:bg-slate-700 focus:bg-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <span>{format.icon}</span>
                      <span>{format.label}</span>
                      <span className="text-slate-400 text-xs">
                        ({format.aspect})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={
              !state.selectedAudio ||
              state.selectedVideos.length === 0 ||
              state.isGenerating
            }
            className="bg-brand-fuchsia hover:bg-brand-fuchsia-600"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {state.isGenerating ? "Generating..." : "Generate Preview"}
          </Button>

          <Button
            onClick={handleExport}
            disabled={!state.hasTimeline || state.isExporting}
            className="bg-neon-amber hover:brightness-95"
          >
            <Download className="w-4 h-4 mr-2" />
            {state.isExporting ? "Exporting..." : "Export Final"}
          </Button>

          {/* Explicit controls to avoid auto-loading stale timelines on mount */}
          <Button
            onClick={async () => {
              try {
                const items = await loadCutlistIntoEditor();
                setState((prev) => ({
                  ...prev,
                  hasTimeline: items.length > 0,
                }));
                if (items.length > 0)
                  toast.success(`Loaded ${items.length} cuts`);
                else toast.info("No cutlist found to load");
              } catch (err) {
                console.error("Failed to load last cutlist:", err);
                toast.error("Failed to load last cutlist");
              }
            }}
            disabled={state.isGenerating}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Load Last Cutlist
          </Button>

          <Button
            onClick={async () => {
              // Clear editor timeline and UI state explicitly
              try {
                editor.updateTimelineItems([]);
                editor.selectTimelineItem("");
              } catch (e) {
                // ignore selection errors
              }
              setState((prev) => ({
                ...prev,
                hasTimeline: false,
                isRandomized: false,
              }));
              toast.success("Cleared timeline");
            }}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Clear Timeline
          </Button>
        </div>

        {/* Generation Progress Overlay */}
        {state.isGenerating && (
          <div className="absolute top-16 right-4 z-10 bg-slate-800 border border-slate-600 rounded p-3 min-w-48">
            <div className="text-sm text-white mb-2">
              {state.generationStage}
            </div>
            <Progress value={state.generationProgress} className="h-2" />
          </div>
        )}

        {/* Export Progress Overlay */}
        {state.isExporting && (
          <div className="absolute top-16 right-4 z-10 bg-slate-800 border border-slate-600 rounded p-3 min-w-48">
            <div className="text-sm text-white mb-2">Exporting...</div>
            <Progress value={state.exportProgress} className="h-2" />
          </div>
        )}
        {/* Video Player */}
        <div className="flex-1 bg-black relative flex items-center justify-center p-4 min-h-0">
          {/* Video Container with Dynamic Aspect Ratio */}
          <div
            className={`relative bg-black/20 border border-white/10 rounded-lg overflow-hidden ${
              state.videoFormat === "landscape"
                ? "aspect-video w-full max-h-full"
                : state.videoFormat === "portrait"
                ? "aspect-[9/16] max-h-full max-w-full"
                : "aspect-square w-full max-h-full"
            }`}
            style={{
              maxWidth:
                state.videoFormat === "portrait" ? "min(60vh, 80vw)" : "100%",
              maxHeight: "calc(100vh - 120px)", // Reserve space for bottom controls
            }}
          >
            {state.currentVideo && state.currentVideoUrl ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                src={state.currentVideoUrl}
                onTimeUpdate={(e) => {
                  const video = e.target as HTMLVideoElement;
                  setState((prev) => ({
                    ...prev,
                    currentTime: video.currentTime,
                    duration: video.duration || 0,
                  }));
                }}
                onPlay={() =>
                  setState((prev) => ({ ...prev, isPlaying: true }))
                }
                onPause={() =>
                  setState((prev) => ({ ...prev, isPlaying: false }))
                }
              />
            ) : (
              // Static placeholder when no video selected
              <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                <div className="text-center">
                  <Video className="w-24 h-24 mx-auto mb-4 text-slate-500" />
                  <p className="text-slate-400 text-lg">
                    Select videos from file browser
                  </p>
                  <p className="text-slate-500 text-sm">
                    Videos will play here in order
                  </p>
                </div>
              </div>
            )}

            {/* Video Controls Overlay - Centered */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 rounded-lg p-4 flex items-center gap-6">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={prevVideo}
                  disabled={state.currentVideoIndex <= 0}
                  className="bg-black/40 border-white/20 hover:bg-black/60"
                >
                  <SkipBack className="w-8 h-8 text-white" />
                </Button>

                {/* Play button doubles as Preview when timeline exists */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={
                    state.hasTimeline
                      ? handlePreview
                      : state.isPlaying
                      ? pauseVideo
                      : playVideo
                  }
                  disabled={!state.currentVideo && !state.hasTimeline}
                  className={`bg-black/40 border-white/20 hover:bg-black/60 w-16 h-16 ${
                    state.hasTimeline ? "border-purple-400" : ""
                  }`}
                >
                  {state.isPreviewPlaying ? (
                    <Square className="w-10 h-10 text-white" />
                  ) : (
                    <Play className="w-10 h-10 text-white" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={nextVideo}
                  disabled={
                    state.currentVideoIndex >= state.selectedVideos.length - 1
                  }
                  className="bg-black/40 border-white/20 hover:bg-black/60"
                >
                  <SkipForward className="w-8 h-8 text-white" />
                </Button>
              </div>
            </div>

            {/* Progress Bar - Bottom Overlay */}
            {state.currentVideo && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="mb-2">
                  <Progress
                    value={(state.currentTime / state.duration) * 100}
                    className="h-3 bg-slate-600"
                  />
                  <div className="flex justify-between text-sm text-slate-300 mt-2">
                    <span>{Math.floor(state.currentTime)}s</span>
                    <span>{Math.floor(state.duration)}s</span>
                  </div>
                </div>

                {/* Current video info */}
                <div className="text-center">
                  <div className="text-sm font-medium text-white">
                    {state.currentVideo.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {state.currentVideoIndex + 1} of{" "}
                    {state.selectedVideos.length}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* New Effects Toolbar - prominent, below the video */}
        <div className="w-full flex items-center justify-center py-3 bg-slate-900 border-t border-slate-800">
          <div className="flex items-center gap-3">
            {AVAILABLE_EFFECTS.map((effect) => {
              const Icon = effect.icon;
              const selectedItemEffects = editor.selectedTimelineItemId
                ? editor.getTimelineItemEffects(editor.selectedTimelineItemId)
                : [];
              const isActive = selectedItemEffects.some(
                (e) =>
                  !!e && typeof e.id === "string" && e.id.includes(effect.id)
              );

              return (
                <button
                  key={effect.id}
                  onClick={() => toggleTimelineItemEffect(effect.id)}
                  disabled={!editor.selectedTimelineItemId}
                  title={effect.label}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform transform ${
                    isActive
                      ? "scale-110 bg-[var(--brand-fuchsia)] text-black shadow-neon-fuchsia ring-2 ring-[var(--neon-amber)]"
                      : "bg-[var(--brand-fuchsia)]/90 hover:scale-105"
                  }`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline - Always Visible */}
        <div className="bg-slate-800 border-t border-slate-700 p-3">
          {/* Timeline Header */}
          <div className="text-xs text-slate-400 mb-2 text-center">
            {state.hasTimeline && editor.timeline.length > 0 ? (
              <>
                Timeline ({editor.timeline.length} cuts)
                {state.isRandomized && (
                  <span className="ml-2 text-purple-400">• Randomized</span>
                )}
              </>
            ) : state.hasBeatData && state.beatData.length > 0 ? (
              <>
                Timeline ({state.beatData.length} beats detected)
                <span className="ml-2 text-green-400">
                  • Ready for preview generation
                </span>
              </>
            ) : state.selectedAudio ? (
              "Timeline (analyzing audio beats...)"
            ) : (
              "Timeline (select audio to load beats)"
            )}
          </div>

          {/* Timeline Content - Dot visualization for beats/cuts */}
          <div className="flex gap-1 overflow-x-auto pb-2 min-h-[60px] items-center">
            {state.hasTimeline && editor.timeline.length > 0 ? (
              // Show cuts after preview generation
              // Render timeline as dots (cuts)
              editor.timeline.map((item, index) => {
                const duration = item.out - item.in;
                const isSelected = editor.selectedTimelineItemId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => editor.selectTimelineItem(item.id)}
                    title={`Cut ${index + 1} — ${duration.toFixed(2)}s`}
                    className={`w-6 h-6 rounded-full mx-1 flex-shrink-0 transition-transform transform ${
                      isSelected
                        ? "scale-125 bg-[var(--brand-fuchsia)] ring-2 ring-[var(--neon-amber)]"
                        : "bg-[var(--brand-fuchsia)]/80 hover:scale-110"
                    }`}
                  />
                );
              })
            ) : state.hasBeatData && state.beatData.length > 0 ? (
              // Show beats as dots
              <div className="flex items-center gap-2 px-2">
                {state.beatData.slice(0, 200).map((beat, index) => {
                  const intensity = Math.min(1, beat.confidence || 0.5);
                  const size = 6 + intensity * 10;
                  return (
                    <div
                      key={index}
                      title={`Beat ${index + 1} — ${beat.time.toFixed(2)}s`}
                      className={`rounded-full flex-shrink-0 ${
                        intensity > 0.9
                          ? "bg-[var(--neon-green)]"
                          : intensity > 0.75
                          ? "bg-[var(--neon-amber)]"
                          : "bg-slate-500"
                      }`}
                      style={{ width: `${size}px`, height: `${size}px` }}
                    />
                  );
                })}
                {state.beatData.length > 200 && (
                  <div className="text-xs text-slate-400 ml-2">
                    +{state.beatData.length - 200} more
                  </div>
                )}
              </div>
            ) : state.selectedAudio ? (
              // Show loading state for beats
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <div className="text-sm">🎵 Loading beat analysis...</div>
                  <div className="text-xs mt-1">
                    Audio selected: {state.selectedAudio.name}
                  </div>
                </div>
              </div>
            ) : (
              // Show empty state
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <div className="text-sm">📱 Select audio file</div>
                  <div className="text-xs mt-1">
                    Audio beats will appear here
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Effects Bar */}
        <div className="bg-slate-800 border-t border-slate-700 p-3">
          <div className="flex items-center justify-center gap-4">
            {/* Cutting Mode */}
            <div className="flex gap-1">
              <span className="text-xs text-slate-400 mr-2">Mode:</span>
              {CUTTING_MODES.map((mode) => (
                <Button
                  key={mode.value}
                  variant={
                    state.cuttingMode === mode.value ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    setState((prev) => ({ ...prev, cuttingMode: mode.value }))
                  }
                  className="text-xs px-2"
                >
                  {mode.label}
                </Button>
              ))}
            </div>

            {/* Cut Settings Panel */}
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-400">Cut Settings:</div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-300">Min cut (s)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  className="w-20 bg-slate-700 text-white text-xs px-2 py-1 rounded"
                  value={state.minCutLength}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      minCutLength: Number(e.target.value || 0),
                    }))
                  }
                  title="Override minimum cut duration (0 = use mode default)"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-300">Beat stride</label>
                <select
                  className="bg-slate-700 text-white text-xs px-2 py-1 rounded"
                  value={state.beatStride}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      beatStride: Number(e.target.value || 1),
                    }))
                  }
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-300">Snap to shots</label>
                <input
                  type="checkbox"
                  checked={state.snapToShots}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      snapToShots: e.target.checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-300">Snap tol (s)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-20 bg-slate-700 text-white text-xs px-2 py-1 rounded"
                  value={state.snapTolerance}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      snapTolerance: Number(e.target.value || 0.08),
                    }))
                  }
                />
              </div>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-600"></div>

            {/* Effects placeholder removed from bottom bar - rendered below video */}

            {/* Timeline Item Effects (EditorStore Test) */}
            {editor.selectedTimelineItemId && (
              <>
                <div className="w-px h-6 bg-slate-600"></div>
                <div className="flex gap-1">
                  <span className="text-xs text-yellow-400 mr-2">
                    Item Effects:
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTimelineItemEffect("speed_up")}
                    className="text-xs px-2"
                    title="Toggle Speed Up effect on selected timeline item"
                    disabled={!editor.selectedTimelineItemId}
                  >
                    ⚡
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTimelineItemEffect("blur")}
                    className="text-xs px-2"
                    title="Toggle Blur effect on selected timeline item"
                    disabled={!editor.selectedTimelineItemId}
                  >
                    🌫️
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTimelineItemEffect("grayscale")}
                    className="text-xs px-2"
                    title="Toggle Grayscale effect on selected timeline item"
                    disabled={!editor.selectedTimelineItemId}
                  >
                    ⚫
                  </Button>
                </div>
              </>
            )}

            {/* Divider */}
            <div className="w-px h-6 bg-slate-600"></div>

            {/* Tempo */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Tempo:</span>
              <span className="text-xs text-white w-12">{state.tempo}%</span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      tempo: Math.max(50, prev.tempo - 10),
                    }))
                  }
                  className="text-xs px-1"
                >
                  -
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      tempo: Math.min(200, prev.tempo + 10),
                    }))
                  }
                  className="text-xs px-1"
                >
                  +
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

        <Toaster />
      </div>
    </AppShell>
  );
}

export default StaticUnifiedApp;
