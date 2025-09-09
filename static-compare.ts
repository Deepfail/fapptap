/**
 * FAPPTap - Static UI with file browser, permanent video player, everything always visible
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { useProbeStore } from "@/state/probeStore";
import {
  Play,
  Square,
  Music,
  Video,
  Wand2,
  Download,
  Folder,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PythonWorker } from "@/lib/worker";
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

  // Timeline cuts (for visualization)
  timelineCuts: TimelineCut[];
  isRandomized: boolean;
}

interface TimelineCut {
  id: string;
  src: string;
  fileName: string;
  inTime: number;
  outTime: number;
  duration: number;
  effects: string[];
}

// const CUTTING_MODES = [
//   { value: 'slow' as const, label: 'Slow' },
//   { value: 'medium' as const, label: 'Medium' },
//   { value: 'fast' as const, label: 'Fast' },
//   { value: 'ultra_fast' as const, label: 'Ultra' },
// ];

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

  // Use the existing probe store
  const {
    requestFileProbe,
    getFileProbeStatus,
    getFileProbeData,
    probeStatuses,
    probeCache,
  } = useProbeStore();

  const [state, setState] = useState<AppState>({
    currentDirectory: "Sample Files",
    files: [
      {
        path: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        name: "Sample Video 1",
        type: "video",
      },
      {
        path: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        name: "Sample Video 2",
        type: "video",
      },
      {
        path: "https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3",
        name: "Sample Audio",
        type: "audio",
      },
    ],

    // Pagination
    currentPage: 0,
    itemsPerPage: 100,
    totalFiles: 3,
    isLoadingFiles: false,

    selectedVideos: [],
    selectedAudio: null,
    currentVideo: null,
    currentVideoUrl: "",
    currentVideoIndex: 0,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
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
    timelineCuts: [],
    isRandomized: false,
  });

  // Effect: Update UI when probe data becomes available
  useEffect(() => {
    // Force re-render when probe statuses change to show updated metadata
    setState((prev) => ({ ...prev }));
  }, [probeStatuses, probeCache]);

  // Effect: Convert video path to URL when currentVideo changes
  useEffect(() => {
    if (state.currentVideo) {
      toMediaSrc(state.currentVideo.path)
        .then((url) => {
          setState((prev) => ({ ...prev, currentVideoUrl: url }));
        })
        .catch((err) => {
          console.error("Failed to convert video path to URL:", err);
          setState((prev) => ({ ...prev, currentVideoUrl: "" }));
        });
    } else {
      setState((prev) => ({ ...prev, currentVideoUrl: "" }));
    }
  }, [state.currentVideo]);

  // Get current page files for pagination (excluding folders)
  const getCurrentPageFiles = useCallback(() => {
    // Filter out folders - only show media files
    const mediaFiles = state.files.filter((file) => file.type !== "folder");
    const startIndex = state.currentPage * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    return mediaFiles.slice(startIndex, endIndex);
  }, [state.files, state.currentPage, state.itemsPerPage]);

  // Pagination controls (based on media files only)
  const mediaFilesCount = state.files.filter(
    (file) => file.type !== "folder"
  ).length;
  const totalPages = Math.ceil(mediaFilesCount / state.itemsPerPage);
  const canPrevPage = state.currentPage > 0;
  const canNextPage = state.currentPage < totalPages - 1;

  const nextPage = useCallback(() => {
    if (canNextPage) {
      setState((prev) => ({ ...prev, currentPage: prev.currentPage + 1 }));
    }
  }, [canNextPage]);

  const prevPage = useCallback(() => {
    if (canPrevPage) {
      setState((prev) => ({ ...prev, currentPage: prev.currentPage - 1 }));
    }
  }, [canPrevPage]);

  // Load files from directory
  const loadDirectory = useCallback(
    async (dirPath?: string) => {
      if (!isTauriAvailable()) {
        // Browser fallback - show sample files
        const sampleFiles = [
          {
            path: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            name: "Sample Video 1",
            type: "video" as const,
          },
          {
            path: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            name: "Sample Video 2",
            type: "video" as const,
          },
          {
            path: "https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3",
            name: "Sample Audio",
            type: "audio" as const,
          },
        ];

        setState((prev) => ({
          ...prev,
          currentDirectory: "Sample Files",
          files: sampleFiles,
          totalFiles: sampleFiles.length,
          currentPage: 0,
          isLoadingFiles: false,
        }));

        // Request probes for video files in browser mode
        sampleFiles.forEach((file) => {
          if (file.type === "video") {
            requestFileProbe(file.path);
          }
        });

        return;
      }

      try {
        // Set loading state
        setState((prev) => ({ ...prev, isLoadingFiles: true }));

        // Only load directory if explicitly requested with a path
        if (!dirPath) {
          setState((prev) => ({
            ...prev,
            currentDirectory: "Select a folder to browse files",
            files: [],
            totalFiles: 0,
            currentPage: 0,
            isLoadingFiles: false,
          }));
          return;
        }

        const { readDir } = await import("@tauri-apps/plugin-fs");

        const entries = await readDir(dirPath);

        const files: FileItem[] = [];

        for (const entry of entries) {
          const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(entry.name);
          const isAudio = /\.(mp3|wav|flac|m4a|aac)$/i.test(entry.name);

          if (entry.isDirectory) {
            files.push({
              path: `${dirPath}/${entry.name}`,
              name: entry.name,
              type: "folder",
            });
          } else if (isVideo) {
            const fullPath = `${dirPath}/${entry.name}`;
            files.push({
              path: fullPath,
              name: entry.name,
              type: "video",
              thumbnail: `asset://localhost/${dirPath}/${entry.name}`, // Use asset protocol for thumbnails
            });

            // Request probe for video file
            requestFileProbe(fullPath);
          } else if (isAudio) {
            files.push({
              path: `${dirPath}/${entry.name}`,
              name: entry.name,
              type: "audio",
            });
          }
        }

        setState((prev) => ({
          ...prev,
          currentDirectory: dirPath,
          files: files.sort((a, b) => {
            if (a.type === "folder" && b.type !== "folder") return -1;
            if (a.type !== "folder" && b.type === "folder") return 1;
            return a.name.localeCompare(b.name);
          }),
          totalFiles: files.length,
          currentPage: 0,
          isLoadingFiles: false,
        }));
      } catch (error) {
        console.error("Failed to load directory:", error);
        setState((prev) => ({ ...prev, isLoadingFiles: false }));
        toast.error("Failed to load directory");
      }
    },
    [requestFileProbe]
  );

  // Select audio file
  const selectAudioFile = useCallback(async () => {
    if (!isTauriAvailable()) {
      toast.info("Audio selection not available in browser mode");
      return;
    }

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({
        title: "Select Audio File",
        filters: [
          { name: "Audio", extensions: ["mp3", "wav", "flac", "m4a", "aac"] },
        ],
      });

      if (file) {
        setState((prev) => ({
          ...prev,
          selectedAudio: {
            path: file,
            name: file.split("/").pop()?.split("\\").pop() || "Audio",
            type: "audio",
          },
        }));
        toast.success(`Selected: ${file.split("/").pop()?.split("\\").pop()}`);
      }
    } catch (error) {
      console.error("Failed to select audio:", error);
      toast.error("Failed to select audio file");
    }
  }, []);

  // Browse for folder
  const browseFolder = useCallback(async () => {
    if (!isTauriAvailable()) {
      loadDirectory(); // Load sample files in browser
      return;
    }

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === "string") {
        loadDirectory(selected);
      }
    } catch (error) {
      console.error("Failed to browse folder:", error);
      toast.error("Failed to browse folder");
    }
  }, [loadDirectory]);

  // Select video (toggle selection, prevent duplicates)
  const selectVideo = useCallback(
    (file: FileItem) => {
      if (file.type !== "video") return;

      setState((prev) => {
        // Check if already selected
        const isAlreadySelected = prev.selectedVideos.some(
          (v) => v.path === file.path
        );

        if (isAlreadySelected) {
          // Remove from selection
          const newSelected = prev.selectedVideos.filter(
            (v) => v.path !== file.path
          );
          const newCurrentIndex =
            prev.currentVideoIndex >= newSelected.length
              ? 0
              : prev.currentVideoIndex;

          return {
            ...prev,
            selectedVideos: newSelected,
            currentVideo:
              newSelected.length > 0 ? newSelected[newCurrentIndex] : null,
            currentVideoIndex: newCurrentIndex,
          };
        } else {
          // Add to selection
          const newSelected = [...prev.selectedVideos, file];
          return {
            ...prev,
            selectedVideos: newSelected,
            currentVideo: prev.currentVideo || file, // Set as current if none selected
            currentVideoIndex: prev.currentVideo ? prev.currentVideoIndex : 0,
          };
        }
      });

      // Check current state for toast message
      const isCurrentlySelected = state.selectedVideos.some(
        (v) => v.path === file.path
      );
      if (isCurrentlySelected) {
        toast.success(`Removed ${file.name} from playlist`);
      } else {
        toast.success(`Added ${file.name} to playlist`);
      }
    },
    [state.selectedVideos]
  );

  // Select audio
  const selectAudio = useCallback((file: FileItem) => {
    if (file.type !== "audio") return;

    setState((prev) => ({
      ...prev,
      selectedAudio: file,
    }));

    toast.success(`Selected ${file.name} as audio track`);
  }, []);

  // Video player controls
  const playVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play();
      setState((prev) => ({ ...prev, isPlaying: true }));
    }
  }, []);

  const pauseVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const nextVideo = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentVideoIndex + 1;
      if (nextIndex < prev.selectedVideos.length) {
        return {
          ...prev,
          currentVideoIndex: nextIndex,
          currentVideo: prev.selectedVideos[nextIndex],
        };
      }
      return prev;
    });
  }, []);

  const prevVideo = useCallback(() => {
    setState((prev) => {
      const prevIndex = prev.currentVideoIndex - 1;
      if (prevIndex >= 0) {
        return {
          ...prev,
          currentVideoIndex: prevIndex,
          currentVideo: prev.selectedVideos[prevIndex],
        };
      }
      return prev;
    });
  }, []);

  // Load timeline cuts from cutlist.json
  const loadTimelineCuts = useCallback(async (): Promise<TimelineCut[]> => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const cutlistContent = await invoke<string>("read_cutlist");
      const cutlistData = JSON.parse(cutlistContent);

      const cuts: TimelineCut[] =
        cutlistData.events?.map((event: any, index: number) => ({
          id: `cut-${index}`,
          src: event.src,
          fileName:
            event.src.split("/").pop() ||
            event.src.split("\\").pop() ||
            `Cut ${index + 1}`,
          inTime: event.in || 0,
          outTime: event.out || 0,
          duration: (event.out || 0) - (event.in || 0),
          effects: event.effects || [],
        })) || [];

      return cuts;
    } catch (error) {
      console.error("Failed to load timeline cuts:", error);
      return [];
    }
  }, []);

  // Effect: Test cutlist reading on mount (for validation)
  useEffect(() => {
    const testCutlistReading = async () => {
      if (isTauriAvailable()) {
        try {
          const cuts = await loadTimelineCuts();
          console.log(
            "✅ Cutlist reading test successful:",
            cuts.length,
            "cuts loaded"
          );
          if (cuts.length > 0) {
            setState((prev) => ({
              ...prev,
              hasTimeline: true,
              timelineCuts: cuts,
            }));
          }
        } catch (error) {
          console.log("❌ Cutlist reading test failed:", error);
        }
      }
    };
    testCutlistReading();
  }, [loadTimelineCuts]);

  // Generate preview (not final render)
  const handleGenerate = useCallback(async () => {
    if (!state.selectedAudio || state.selectedVideos.length === 0) {
      toast.error("Select audio and videos first");
      return;
    }

    setState((prev) => ({
      ...prev,
      isGenerating: true,
      generationProgress: 0,
    }));

    try {
      const worker = new PythonWorker();

      // Step 1: Analyze audio
      setState((prev) => ({
        ...prev,
        generationStage: "Analyzing audio...",
        generationProgress: 20,
      }));
      await worker.runStage("beats", {
        song: state.selectedAudio.path, // Already checked that it's not null
        engine: "advanced",
      });

      // Step 2: Prepare clips
      setState((prev) => ({
        ...prev,
        generationStage: "Preparing clips...",
        generationProgress: 40,
      }));

      const { mkdir, copyFile } = await import("@tauri-apps/plugin-fs");
      const { appDataDir } = await import("@tauri-apps/api/path");

      const appDir = await appDataDir();
      const tempDir = `${appDir}/temp_clips`;

      await mkdir(tempDir, { recursive: true });

      // Copy videos with safe names
      for (let i = 0; i < state.selectedVideos.length; i++) {
        const video = state.selectedVideos[i];
        const destPath = `${tempDir}/video_${i + 1}.mp4`;
        await copyFile(video.path, destPath);
      }

      // Step 3: Generate cutlist (preview mode)
      setState((prev) => ({
        ...prev,
        generationStage: "Generating preview...",
        generationProgress: 70,
      }));
      await worker.runStage("cutlist", {
        song: state.selectedAudio.path,
        clips: tempDir,
        preset: state.videoFormat, // Use selected format instead of hardcoded 'landscape'
        cutting_mode: state.cuttingMode,
        enable_shot_detection: false,
      });

      // Step 4: Load timeline cuts from cutlist.json
      setState((prev) => ({
        ...prev,
        generationStage: "Loading timeline...",
        generationProgress: 85,
      }));
      const timelineCuts = await loadTimelineCuts();

      // Step 5: Create preview video (low quality, fast)
      setState((prev) => ({
        ...prev,
        generationStage: "Creating preview...",
        generationProgress: 90,
      }));
      await worker.runStage("render", {
        proxy: true,
      });

      setState((prev) => ({
        ...prev,
        isGenerating: false,
        generationProgress: 100,
        hasTimeline: true,
        timelineCuts: timelineCuts,
        generationStage: "Preview ready!",
      }));

      toast.success(
        "Preview generated! Review and make edits, then Export for final render."
      );
    } catch (error) {
      setState((prev) => ({ ...prev, isGenerating: false }));
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(`Preview generation failed: ${errorMessage}`);
    }
  }, [
    state.selectedAudio,
    state.selectedVideos,
    state.cuttingMode,
    state.videoFormat,
  ]);

  // Preview
  const handlePreview = useCallback(async () => {
    if (!state.hasTimeline) {
      toast.error("Generate timeline first");
      return;
    }

    try {
      setState((prev) => ({ ...prev, isPreviewPlaying: true }));

      const { Command } = await import("@tauri-apps/plugin-shell");
      const command = Command.sidecar("binaries/ffplaybin", [
        "render/fapptap_proxy.mp4",
        "-autoexit",
        "-x",
        "640",
        "-y",
        "360",
      ]);

      await command.spawn();
      toast.success("Preview started!");
    } catch (error) {
      setState((prev) => ({ ...prev, isPreviewPlaying: false }));
      toast.error("Preview failed");
    }
  }, [state.hasTimeline]);

  // Export final high-quality render
  const handleExport = useCallback(async () => {
    if (!state.hasTimeline) {
      toast.error("Generate preview first");
      return;
    }

    try {
      setState((prev) => ({ ...prev, isExporting: true, exportProgress: 0 }));

      const { save } = await import("@tauri-apps/plugin-dialog");
      const { copyFile } = await import("@tauri-apps/plugin-fs");

      const savePath = await save({
        filters: [{ name: "Video Files", extensions: ["mp4"] }],
        defaultPath: "fapptap_export.mp4",
      });

      if (savePath) {
        // Run final high-quality render
        setState((prev) => ({ ...prev, exportProgress: 20 }));

        const worker = new PythonWorker();

        // Apply current effects and settings to cutlist
        setState((prev) => ({ ...prev, exportProgress: 40 }));
        await worker.runStage("cutlist", {
          song: state.selectedAudio!.path, // We already checked hasTimeline which requires audio
          clips: "temp_clips", // Using previously prepared clips
          preset: state.videoFormat, // Use selected format from dropdown
          cutting_mode: state.cuttingMode,
          enable_shot_detection: false,
          effects: state.effects.join(","), // Convert array to comma-separated string
          tempo: state.tempo.toString(), // Convert number to string
        });

        // Final render with high quality
        setState((prev) => ({ ...prev, exportProgress: 70 }));
        await worker.runStage("render", {
          proxy: false,
        });

        // Copy to user's chosen location
        setState((prev) => ({ ...prev, exportProgress: 90 }));
        await copyFile("render/fapptap_final.mp4", savePath);

        setState((prev) => ({
          ...prev,
          isExporting: false,
          exportProgress: 100,
        }));
        toast.success(`High-quality video exported to: ${savePath}`);
      } else {
        setState((prev) => ({ ...prev, isExporting: false }));
      }
    } catch (error) {
      setState((prev) => ({ ...prev, isExporting: false }));
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error(`Export failed: ${errorMessage}`);
    }
  }, [
    state.hasTimeline,
    state.selectedAudio,
    state.cuttingMode,
    state.effects,
    state.tempo,
    state.videoFormat,
  ]);

  // Toggle effect
  // const toggleEffect = useCallback((effectId: string) => {
  //   setState(prev => ({
  //     ...prev,
  //     effects: prev.effects.includes(effectId)
  //       ? prev.effects.filter(id => id !== effectId)
  //       : [...prev.effects, effectId]
  //   }));
  // }, []);

  return (
    <div className="h-screen text-white overflow-hidden flex">
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
              disabled={!state.hasTimeline || state.timelineCuts.length === 0}
              onClick={() => {
                // Toggle randomize timeline cuts order
                if (state.timelineCuts.length > 1) {
                  setState((prev) => {
                    if (prev.isRandomized) {
                      // Un-randomize: sort by original index (using cut id)
                      const sorted = [...prev.timelineCuts].sort((a, b) => {
                        const aIndex = parseInt(a.id.replace("cut-", ""));
                        const bIndex = parseInt(b.id.replace("cut-", ""));
                        return aIndex - bIndex;
                      });
                      return {
                        ...prev,
                        timelineCuts: sorted,
                        isRandomized: false,
                      };
                    } else {
                      // Randomize
                      const shuffled = [...prev.timelineCuts].sort(
                        () => Math.random() - 0.5
                      );
                      return {
                        ...prev,
                        timelineCuts: shuffled,
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
                                probeStatus?.status === "cached-fast" ||
                                probeStatus?.status === "cached-deep"
                                  ? "bg-green-400"
                                  : probeStatus?.status === "probing"
                                  ? "bg-yellow-400"
                                  : probeStatus?.status === "error"
                                  ? "bg-red-400"
                                  : "bg-gray-400";
                              return (
                                <div
                                  className={`w-2 h-2 rounded-full ${probeColor}`}
                                  title={`Probe: ${
                                    probeStatus?.status || "pending"
                                  }`}
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
                          return probeData?.duration_sec ? (
                            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
                              {Math.round(probeData.duration_sec)}s
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
      <div className="flex-1 flex flex-col">
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
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {state.isGenerating ? "Generating..." : "Generate Preview"}
          </Button>

          <Button
            onClick={handleExport}
            disabled={!state.hasTimeline || state.isExporting}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            {state.isExporting ? "Exporting..." : "Export Final"}
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
        <div className="flex-1 bg-black flex items-center justify-center p-4">
          {/* Video Container with Dynamic Aspect Ratio */}
          <div
            className={`relative bg-black/20 border border-white/10 rounded-lg overflow-hidden ${
              state.videoFormat === "landscape"
                ? "aspect-video w-full max-h-full"
                : state.videoFormat === "portrait"
                ? "aspect-[9/16] h-full max-w-full"
                : "aspect-square w-full max-h-full"
            }`}
            style={{
              maxWidth: state.videoFormat === "portrait" ? "60vh" : "100%",
              maxHeight: state.videoFormat === "landscape" ? "70vh" : "100%",
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

        {/* Timeline Cuts Visualization */}
        {state.hasTimeline && state.timelineCuts.length > 0 && (
          <div className="bg-slate-800 border-t border-slate-700 p-3">
            <div className="text-xs text-slate-400 mb-2 text-center">
              Timeline ({state.timelineCuts.length} cuts)
              {state.isRandomized && (
                <span className="ml-2 text-purple-400">• Randomized</span>
              )}
            </div>
            <div className="flex gap-1 overflow-x-auto pb-2">
              {state.timelineCuts.map((cut, index) => (
                <div
                  key={cut.id}
                  className="flex-shrink-0 bg-slate-700 rounded p-2 min-w-[120px] border border-slate-600"
                  title={`${cut.fileName}\nDuration: ${cut.duration.toFixed(
                    2
                  )}s\nEffects: ${
                    cut.effects.length > 0 ? cut.effects.join(", ") : "None"
                  }`}
                >
                  <div className="text-xs font-medium text-white truncate">
                    {cut.fileName}
                  </div>
                  <div className="text-xs text-slate-400">
                    {cut.duration.toFixed(2)}s
                  </div>
                  {cut.effects.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {cut.effects.slice(0, 3).map((effect, i) => (
                        <div
                          key={i}
                          className="text-xs bg-purple-600 text-white px-1 rounded"
                        >
                          {effect.split(":")[0]}
                        </div>
                      ))}
                      {cut.effects.length > 3 && (
                        <div className="text-xs text-slate-400">
                          +{cut.effects.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mt-1">
                    #{index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Effects Bar - Fixed Overlay at Bottom - OUTSIDE MAIN CONTAINER */}
      <div className="fixed bottom-0 left-0 right-0 bg-red-500 text-white p-3 z-50">
        <div className="text-center">EFFECTS BAR TEST</div>
      </div>

      <Toaster />
    </div>
  );
}

export default StaticUnifiedApp;
