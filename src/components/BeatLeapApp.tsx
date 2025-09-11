import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

// Generate Workflow Services
import { createSession } from "@/services/session";
import { runStage } from "@/services/stages";
import { hydrateEditorFromSessionCutlist } from "@/services/cutlist";

// Tauri APIs
import { join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";

// Editor Store
import { useEditor } from "@/state/editorStore";

// UI Components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";

// Icons
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Upload,
  Volume,
  Wand2,
  Scissors,
  Plus,
  X,
  CheckSquare,
  Square,
  Music,
  Clock,
  FileVideo,
} from "lucide-react";

// (No additional services needed for this standalone component)

interface VideoItem {
  id: string;
  name: string;
  url: string; // Display URL (blob URL for thumbnail generation)
  filePath?: string; // Actual file path for Tauri operations
  duration: number;
  size: number;
  createdAt: number;
  thumbnail?: string;
  selected?: boolean;
}

interface Beat {
  time: number;
  confidence: number;
  energy: number;
}

interface SmartCut {
  time: number;
  type: "scene_change" | "action" | "face_close_up" | "motion_peak";
  confidence: number;
  description: string;
}

// Beats sanity check function
function assertBeatsSane(beatsSec: number[], audioDurSec?: number) {
  if (!audioDurSec) return;
  const bpmGuess = (beatsSec.length / audioDurSec) * 60;
  if (beatsSec.length > audioDurSec * 6 || bpmGuess > 220) {
    throw new Error(
      `Beats look wrong: ${
        beatsSec.length
      } beats over ${audioDurSec}s (~${bpmGuess.toFixed(1)} BPM)`
    );
  }
}

export default function BeatLeapApp() {
  console.log("BeatLeapApp: Rendering new modern UI component");

  // Get editor from EditorProvider
  const editor = useEditor();

  // Add startup logging
  useEffect(() => {
    console.log("=".repeat(60));
    console.log("FAPPTAP APP STARTED - " + new Date().toISOString());
    console.log("=".repeat(60));
    console.log("User Agent:", navigator.userAgent);
    console.log("Platform:", navigator.platform);
    console.log("Language:", navigator.language);
    console.log("Screen:", window.screen.width + "x" + window.screen.height);
    console.log("Viewport:", window.innerWidth + "x" + window.innerHeight);
    console.log("=".repeat(60));

    toast.success("BeatLeap UI loaded successfully!");
  }, []);

  // Video Library State
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  // Generate State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<
    "landscape" | "portrait" | "square"
  >("landscape");
  const [timeoutOccurred, setTimeoutOccurred] = useState(false);

  // Analysis State
  const [beats, setBeats] = useState<Beat[]>([]);
  const [smartCuts, setSmartCuts] = useState<SmartCut[]>([]);

  // Session State
  const [sessionRoot, setSessionRoot] = useState<string | null>(null);
  const [clipsDir, setClipsDir] = useState<string | null>(null);
  const [audioFsPath, setAudioFsPath] = useState<string | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number | undefined>(
    undefined
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetectingCuts, setIsDetectingCuts] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fixed thumbnail size for consistent 2-column layout
  const thumbnailSize = 150;

  // Calculate selected videos count
  const selectedCount = videos.filter((v) => v.selected).length;
  const allSelected = videos.length > 0 && selectedCount === videos.length;

  // Format time display
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // (formatFileSize removed - not used in this component)

  // Format duration
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Generate thumbnail from video
  const generateThumbnail = useCallback(
    async (video: HTMLVideoElement): Promise<string> => {
      return new Promise((resolve) => {
        video.currentTime = Math.min(video.duration * 0.1, 10); // 10% in or 10s max

        video.addEventListener(
          "seeked",
          function onSeeked() {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            canvas.width = 160;
            canvas.height = 160;

            if (ctx) {
              // Calculate square crop from center of video
              const videoAspect = video.videoWidth / video.videoHeight;
              let sourceX = 0,
                sourceY = 0,
                sourceSize = 0;

              if (videoAspect > 1) {
                // Video is wider than tall - crop from center width
                sourceSize = video.videoHeight;
                sourceX = (video.videoWidth - sourceSize) / 2;
              } else {
                // Video is taller than wide - crop from center height
                sourceSize = video.videoWidth;
                sourceY = (video.videoHeight - sourceSize) / 2;
              }

              ctx.drawImage(
                video,
                sourceX,
                sourceY,
                sourceSize,
                sourceSize,
                0,
                0,
                canvas.width,
                canvas.height
              );
              resolve(canvas.toDataURL("image/jpeg", 0.8));
            }

            video.removeEventListener("seeked", onSeeked);
          },
          { once: true }
        );
      });
    },
    []
  );

  // Handle audio file selection using Tauri dialog
  const handleAudioUpload = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");

      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Audio",
            extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "wma"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        console.log("Audio file selected:", selected);
        setSelectedAudio(selected); // Store the actual file path

        // Extract filename for display
        const filename = selected.split(/[\\/]/).pop() || "Unknown file";
        toast.success(`Audio selected: ${filename}`);
      }
    } catch (error) {
      console.error("Audio selection failed:", error);
      toast.error("Failed to select audio file");
    }
  };

  // Handle file upload using Tauri file dialog
  const handleFileUpload = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readFile } = await import("@tauri-apps/plugin-fs");

      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Video",
            extensions: ["mp4", "mov", "avi", "mkv", "webm", "m4v"],
          },
        ],
      });

      if (!selected || (Array.isArray(selected) && selected.length === 0)) {
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];
      setIsUploading(true);

      for (const filePath of filePaths) {
        try {
          // Read file and create blob URL for display (preserves thumbnail generation)
          const fileBytes = await readFile(filePath);
          const blob = new Blob([fileBytes], { type: "video/mp4" });
          const blobUrl = URL.createObjectURL(blob);

          const video = document.createElement("video");

          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = async () => {
              try {
                const thumbnail = await generateThumbnail(video);
                const fileName = filePath.split(/[\\/]/).pop() || "unknown.mp4";

                const videoItem: VideoItem = {
                  id:
                    Date.now().toString() +
                    Math.random().toString(36).substr(2, 9),
                  name: fileName,
                  url: blobUrl, // Blob URL for display/thumbnails
                  filePath: filePath, // Real file path for Tauri operations
                  duration: video.duration,
                  size: fileBytes.length,
                  createdAt: Date.now(),
                  thumbnail,
                  selected: false,
                };

                setVideos((currentVideos) => [...currentVideos, videoItem]);
                resolve();
              } catch (error) {
                reject(error);
              }
            };
            video.onerror = reject;
            video.src = blobUrl; // Use blob URL for loading metadata
          });
        } catch (error) {
          console.error("Error processing video file:", error);
          toast.error(`Failed to process ${filePath}`);
        }
      }

      setIsUploading(false);
      toast.success(`Added ${filePaths.length} videos to library`);
    } catch (error) {
      console.error("Error opening file dialog:", error);
      toast.error("Failed to open file dialog");
      setIsUploading(false);
    }
  };

  // Toggle video selection
  const toggleVideoSelection = (videoId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setVideos((currentVideos) =>
      currentVideos.map((v) =>
        v.id === videoId ? { ...v, selected: !v.selected } : v
      )
    );
  };

  // Select all videos
  const toggleSelectAll = () => {
    const newState = !allSelected;
    setVideos((currentVideos) =>
      currentVideos.map((v) => ({ ...v, selected: newState }))
    );
  };

  // Select video for editing
  const selectVideo = (video: VideoItem) => {
    setCurrentVideo(video);
  };

  // Remove video from library
  const removeVideo = (videoId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setVideos((currentVideos) => {
      const videoToRemove = currentVideos.find((v) => v.id === videoId);
      const updatedVideos = currentVideos.filter((v) => v.id !== videoId);
      // If the removed video was currently selected, clear selection
      if (
        currentVideo &&
        videoToRemove &&
        currentVideo.url === videoToRemove.url
      ) {
        setCurrentVideo(null);
      }
      return updatedVideos;
    });
  };

  // Playback controls
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skipBackward = () => {
    seekTo(Math.max(0, currentTime - 10));
  };

  const skipForward = () => {
    seekTo(Math.min(duration, currentTime + 10));
  };

  // Generate Edit workflow function
  const handleGenerate = async () => {
    if (!selectedAudio || videos.filter((v) => v.selected).length === 0) {
      toast.error("Select audio and video files first");
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationProgress(0);

      console.log("=== GENERATION STARTED ===");

      // Get selected videos
      const selectedVideos = videos.filter((v) => v.selected);
      console.log("Selected videos:", selectedVideos.length);
      console.log("Audio file:", selectedAudio);

      setGenerationStage("Creating session...");
      console.log("Stage: Creating session");

      // 1. Create session with timeout protection
      const sessionPromise = createSession(
        selectedVideos.map((v) => v.filePath || v.url), // Use filePath if available, fallback to url
        selectedAudio
      );

      const session = (await Promise.race([
        sessionPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Session creation timeout")), 30000)
        ),
      ])) as any;

      console.log("Session created:", session);
      setGenerationProgress(20);

      setGenerationStage("Analyzing beats...");
      console.log("Stage: Analyzing beats");

      // 2. Run beats analysis with timeout
      const beatsPromise = runStage("beats", {
        audio: session.audio,
        base_dir: session.root,
      });
      await Promise.race([
        beatsPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Beats analysis timeout")), 300000)
        ),
      ]);

      console.log("Beats analysis completed");
      setGenerationProgress(50);

      setGenerationStage("Building cutlist...");
      console.log("Stage: Building cutlist");

      // 3. Build cutlist with timeout
      const cutlistPromise = runStage("cutlist", {
        song: session.audio,
        clips: session.clipsDir,
        preset: selectedPreset,
        cutting_mode: "medium",
        engine: "advanced",
        enable_shot_detection: true,
        base_dir: session.root,
      });

      await Promise.race([
        cutlistPromise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Cutlist generation timeout")),
            600000
          )
        ),
      ]);

      console.log("Cutlist completed");
      setGenerationProgress(80);

      // 4. Show immediate preview placeholder
      setGenerationStage("Preparing preview...");
      console.log("Stage: Preparing preview");
      
      if (videoRef.current) {
        // Load the original video immediately as a placeholder
        console.log("Loading original video as preview placeholder");
        const firstVideo = videos.find(v => v.selected);
        if (firstVideo) {
          videoRef.current.src = firstVideo.url;
          videoRef.current.load();
          console.log("Placeholder video loaded:", firstVideo.name);
        }
      }

      setGenerationStage("Rendering final preview...");
      console.log("Stage: Rendering final preview");

      // 5. Generate proxy render and load into player
      if (videoRef.current) {
        console.log("=== STARTING PROXY RENDER AND LOAD ===");
        console.log("Session root:", session.root);
        console.log("Selected preset:", selectedPreset);
        console.log("Video element:", videoRef.current);

        const { renderProxyAndLoad } = await import("@/services/preview");
        const renderPromise = renderProxyAndLoad(
          session.root,
          videoRef.current,
          selectedPreset
        );
        await Promise.race([
          renderPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Render timeout")), 600000)
          ),
        ]);

        console.log("=== PROXY RENDER AND LOAD COMPLETED ===");
      } else {
        console.error("No video element available for proxy loading");
        throw new Error("Video element not available");
      }

      console.log("Render completed");
      setGenerationProgress(100);
      setGenerationStage("Complete!");

      console.log("=== GENERATION COMPLETED SUCCESSFULLY ===");
      toast.success("Generated edit successfully!");
    } catch (error) {
      console.error("=== GENERATION FAILED ===");
      console.error("Generate error:", error);

      const err = error as Error;
      console.error("Error details:", {
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
      });

      // More specific error messages
      let errorMessage = "Generation failed";
      if (err?.message?.includes("timeout")) {
        errorMessage = `Generation timed out during: ${err.message}. The process might still be running. Check if the proxy video was generated.`;
        // Set a flag to show "Check Result" button
        setTimeoutOccurred(true);
      } else if (err?.message?.includes("Worker binary not available")) {
        errorMessage =
          "Worker binary is not available or not properly configured";
      } else if (err?.message?.includes("exit code")) {
        errorMessage = `Worker process failed: ${err.message}`;
      } else {
        errorMessage = `Generation failed: ${err?.message || String(error)}`;
      }

      toast.error(errorMessage);
    } finally {
      console.log("=== GENERATION CLEANUP ===");
      setIsGenerating(false);
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStage("");
        if (!timeoutOccurred) {
          setTimeoutOccurred(false);
        }
      }, 2000);
    }
  };

  const onCreateSession = useCallback(
    async (videoPaths: string[], audioPath: string) => {
      try {
        const session = await createSession(videoPaths, audioPath);
        setSessionRoot(session.root);
        setClipsDir(session.clipsDir);
        setAudioFsPath(session.audio);

        // Set audio duration if available (would come from probe in real implementation)
        setAudioDurationSec(duration > 0 ? duration : undefined);

        toast.success(`Created session with ${videoPaths.length} videos`);
      } catch (error) {
        console.error("Failed to create session:", error);
        toast.error("Failed to create session");
      }
    },
    [duration]
  );

  // Generate workflow: beats -> cutlist -> hydrate -> render -> load
  const onGenerate = useCallback(async () => {
    if (!sessionRoot || !clipsDir || !audioFsPath) {
      toast.error(
        "No session created yet. Please select videos and audio first."
      );
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      // Step 1: Generate beats
      setGenerationStage("Analyzing beats...");
      setGenerationProgress(20);
      await runStage("beats", { sessionRoot, audio: audioFsPath });

      // Step 2: Generate cutlist
      setGenerationStage("Building cutlist...");
      setGenerationProgress(50);
      await runStage("cutlist", {
        sessionRoot,
        song: audioFsPath,
        clipsDir,
        preset: "landscape",
        cutting_mode: "fast",
      });

      // Step 3: Hydrate editor timeline (REPLACE, don't append)
      setGenerationStage("Loading timeline...");
      setGenerationProgress(70);
      await hydrateEditorFromSessionCutlist(sessionRoot, {
        updateTimelineItems: (items) => editor.updateTimelineItems(items),
        selectTimelineItem: (id) => editor.selectTimelineItem(id),
      });

      // Note: Proxy rendering and loading is handled above in the main workflow

      setGenerationProgress(100);
      toast.success("Generation completed successfully!");
    } catch (error) {
      console.error("Generation failed:", error);
      toast.error(`Generation failed: ${error}`);
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStage("");
      }, 2000);
    }
  }, [sessionRoot, clipsDir, audioFsPath, editor]);

  // Load beats from session (replace existing analyzeAudio)
  const analyzeAudio = useCallback(async () => {
    if (!sessionRoot) return;
    setIsAnalyzing(true);

    try {
      const beatsPath = await join(sessionRoot, "cache", "beats.json");
      if (!(await exists(beatsPath))) {
        throw new Error(`beats.json not found at ${beatsPath}`);
      }

      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const raw = await readTextFile(beatsPath);
      const json = JSON.parse(raw);

      // Accept both shapes
      let times: number[] = [];
      if (Array.isArray(json.beats_sec)) {
        times = json.beats_sec.map(Number);
      } else if (Array.isArray(json.beats)) {
        times = json.beats.map((b: any) =>
          typeof b === "number" ? Number(b) : Number(b.time)
        );
      }

      if (times.length === 0) throw new Error("No beats found in beats.json");
      if (audioDurationSec) assertBeatsSane(times, audioDurationSec);

      // REPLACE beats state (don't append)
      setBeats(times.map((time) => ({ time, confidence: 0.9, energy: 0.7 })));

      toast.success(`Loaded ${times.length} beats from session`);
    } catch (error) {
      console.error("Failed to load beats:", error);
      setBeats([]); // Replace with empty (don't leave stale data)
      toast.error(`Failed to load beats: ${error}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [sessionRoot, audioDurationSec]);

  // Smart cut detection
  const detectSmartCuts = useCallback(async () => {
    if (!currentVideo) return;

    setIsDetectingCuts(true);

    try {
      // Generate sample smart cuts (in real implementation, would use AI)
      const sampleCuts: SmartCut[] = [];
      for (let i = 0; i < duration; i += 15) {
        const types: SmartCut["type"][] = [
          "scene_change",
          "action",
          "face_close_up",
          "motion_peak",
        ];
        sampleCuts.push({
          time: i,
          type: types[Math.floor(Math.random() * types.length)],
          confidence: 0.6 + Math.random() * 0.4,
          description: `Auto-detected cut at ${formatTime(i)}`,
        });
      }

      setSmartCuts(sampleCuts);
      toast.success(`Detected ${sampleCuts.length} smart cuts`);
    } catch (error) {
      console.error("Smart cut detection failed:", error);
      toast.error("Failed to detect smart cuts");
    } finally {
      setIsDetectingCuts(false);
    }
  }, [currentVideo, duration]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideo) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      // Auto-analyze when video loads
      setTimeout(() => {
        analyzeAudio();
        detectSmartCuts();
      }, 1000);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    // Reset states when loading new video
    setCurrentTime(0);
    setIsPlaying(false);

    video.src = currentVideo.url;
    video.volume = volume;
    video.load();

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [currentVideo, volume, analyzeAudio, detectSmartCuts]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-panel-border bg-card px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            BeatLeap PC
          </h1>
          <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded">
            v2.0.0
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
          {isAnalyzing
            ? "Analyzing..."
            : isDetectingCuts
            ? "Detecting cuts..."
            : "Ready to edit"}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Panel - Video Library */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <div className="h-full flex flex-col bg-card border-r border-panel-border min-w-0">
              <div className="p-4 border-b border-panel-border flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-foreground">
                    Video Library
                  </h2>
                </div>

                {/* Select Audio Button */}
                <Button
                  className="w-full gap-2 mb-3 bg-accent hover:bg-accent/90 text-accent-foreground"
                  onClick={handleAudioUpload}
                >
                  <Music size={16} />
                  {selectedAudio ? "Change Audio" : "Select Audio"}
                </Button>

                {/* Select All Button */}
                {videos.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 mb-3"
                    onClick={toggleSelectAll}
                  >
                    {allSelected ? (
                      <CheckSquare size={16} />
                    ) : (
                      <Square size={16} />
                    )}
                    {allSelected ? `Deselect All` : `Select All`}
                    {selectedCount > 0 && ` (${selectedCount})`}
                  </Button>
                )}

                <Button
                  className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handleFileUpload}
                  disabled={isUploading}
                >
                  <Upload size={16} />
                  {isUploading ? "Importing..." : "Import Videos"}
                </Button>
                {/* File input removed - using Tauri dialog instead */}
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 grid grid-cols-2 gap-1">
                  {videos.map((video) => (
                    <div
                      key={video.id}
                      className={`relative cursor-pointer transition-all border rounded-md group overflow-hidden aspect-square ${
                        currentVideo?.url === video.url
                          ? "bg-primary/10 border-primary/50 glow-primary"
                          : video.selected
                          ? "bg-accent/10 border-accent/50"
                          : "hover:bg-muted/50 border-border/50 hover:border-accent/30"
                      }`}
                      onClick={() => selectVideo(video)}
                      style={{
                        width: `${thumbnailSize}px`,
                        height: `${thumbnailSize}px`,
                      }}
                    >
                      {/* Selection checkbox */}
                      <button
                        onClick={(e) => toggleVideoSelection(video.id, e)}
                        className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white rounded p-1"
                      >
                        {video.selected ? (
                          <CheckSquare size={14} />
                        ) : (
                          <Square size={14} />
                        )}
                      </button>

                      {/* Remove button */}
                      <button
                        onClick={(e) => removeVideo(video.id, e)}
                        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-full p-1"
                      >
                        <X size={12} />
                      </button>

                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt={video.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                          <FileVideo
                            size={Math.min(32, thumbnailSize * 0.3)}
                            className="text-muted-foreground"
                          />
                        </div>
                      )}

                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="bg-primary/90 rounded-full p-2">
                          <Play
                            size={Math.min(20, thumbnailSize * 0.2)}
                            className="text-primary-foreground ml-0.5"
                          />
                        </div>
                      </div>

                      {/* Duration badge */}
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Clock size={8} />
                        {formatDuration(video.duration)}
                      </div>

                      {/* Current indicator */}
                      {currentVideo?.url === video.url && (
                        <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                          Current
                        </div>
                      )}

                      {/* Selection indicator */}
                      {video.selected && (
                        <div className="absolute inset-0 bg-accent/20 border-2 border-accent rounded-md"></div>
                      )}
                    </div>
                  ))}

                  {/* Add more videos card */}
                  <div
                    className="border-dashed border-2 border-muted cursor-pointer hover:border-accent/50 transition-colors flex items-center justify-center overflow-hidden aspect-square rounded-md"
                    style={{
                      width: `${thumbnailSize}px`,
                      height: `${thumbnailSize}px`,
                    }}
                    onClick={handleFileUpload}
                  >
                    <div className="text-center">
                      <Plus
                        className="mx-auto mb-2 text-muted-foreground"
                        size={24}
                      />
                      <p className="text-xs text-muted-foreground">Add more</p>
                    </div>
                  </div>

                  {/* Empty state */}
                  {videos.length === 0 && (
                    <div className="col-span-full text-center py-8">
                      <FileVideo
                        size={48}
                        className="mx-auto mb-4 text-muted-foreground"
                      />
                      <p className="text-sm text-muted-foreground mb-2">
                        No videos in your library
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Import video files to start creating beat-synced edits
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-px bg-panel-border hover:bg-accent/50 transition-colors" />

          {/* Center Panel - Video Player */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full p-4 min-h-0">
              <div className="h-full flex flex-col">
                <Card className="flex-1 bg-timeline-bg border-panel-border overflow-hidden">
                  <div className="h-full flex items-center justify-center relative p-4">
                    {/* Always render video element for proxy playback */}
                    <video
                      ref={videoRef}
                      className={`w-full h-full object-contain ${!currentVideo ? 'opacity-0' : ''}`}
                      style={{ maxWidth: "100%", maxHeight: "100%" }}
                      controls={true}
                      onLoadedData={() =>
                        console.log("Video loaded successfully")
                      }
                      onError={(e) => console.error("Video error:", e)}
                      onCanPlay={() => console.log("Video can play")}
                    />

                    {currentVideo ? (
                      <>

                        {/* AI Analysis Status */}
                        {(isAnalyzing || isDetectingCuts) && (
                          <div className="absolute top-4 right-4 bg-primary/20 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2">
                            <Wand2 size={14} className="animate-spin" />
                            {isDetectingCuts
                              ? "Detecting smart cuts..."
                              : "Analyzing audio..."}
                          </div>
                        )}

                        {/* Current Video Name */}
                        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
                          {currentVideo.name}
                        </div>

                        {/* Smart Cuts Indicator */}
                        {smartCuts.length > 0 && (
                          <div className="absolute top-12 left-4 bg-accent/20 text-accent px-3 py-1 rounded-full text-sm flex items-center gap-2">
                            <Scissors size={14} />
                            {smartCuts.length} smart cuts detected
                          </div>
                        )}

                        {/* Video Controls Overlay */}
                        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-sm rounded-lg p-3 z-10">
                          <div className="flex items-center gap-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-white hover:text-primary"
                              onClick={skipBackward}
                            >
                              <SkipBack size={18} />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-primary hover:bg-primary/90 text-primary-foreground"
                              onClick={togglePlay}
                            >
                              {isPlaying ? (
                                <Pause size={18} />
                              ) : (
                                <Play size={18} />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-white hover:text-primary"
                              onClick={skipForward}
                            >
                              <SkipForward size={18} />
                            </Button>
                            <div className="w-px h-6 bg-white/30 mx-1"></div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-white hover:text-primary"
                            >
                              <Volume size={18} />
                            </Button>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={volume}
                              onChange={(e) =>
                                setVolume(parseFloat(e.target.value))
                              }
                              className="w-16 accent-primary"
                            />
                            <div className="w-px h-6 bg-white/30 mx-1"></div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-white hover:text-primary"
                              onClick={detectSmartCuts}
                              disabled={isDetectingCuts}
                            >
                              <Wand2 size={18} />
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      // Empty state
                      <div className="text-center text-muted-foreground">
                        <div className="w-24 h-24 mx-auto mb-4 bg-muted/50 rounded-full flex items-center justify-center">
                          <Upload size={32} />
                        </div>
                        <p className="text-lg font-medium mb-2">
                          Select a video to start editing
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Choose from your library on the left or import new
                          videos
                        </p>
                        <Button
                          onClick={handleFileUpload}
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Upload size={16} className="mr-2" />
                          Import New Video
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Smart Cuts Timeline */}
                {smartCuts.length > 0 && (
                  <div className="h-16 mt-2">
                    <Card className="h-full bg-timeline-bg border-panel-border p-2">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-medium text-foreground">
                          Smart Cuts
                        </h4>
                        <div className="flex gap-1">
                          {smartCuts.slice(0, 5).map((cut, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-accent/20"
                              onClick={() => seekTo(cut.time)}
                            >
                              {cut.type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="relative h-6 bg-muted/30 rounded">
                        {smartCuts.map((cut, index) => (
                          <div
                            key={index}
                            className="absolute h-full w-1 bg-accent rounded cursor-pointer hover:w-2 transition-all"
                            style={{ left: `${(cut.time / duration) * 100}%` }}
                            onClick={() => seekTo(cut.time)}
                            title={`${
                              cut.description
                            } (${cut.confidence.toFixed(2)})`}
                          />
                        ))}
                        <div
                          className="absolute h-full w-0.5 bg-primary"
                          style={{ left: `${(currentTime / duration) * 100}%` }}
                        />
                      </div>
                    </Card>
                  </div>
                )}

                {/* Beat Timeline */}
                {beats.length > 0 && (
                  <div className="h-20 mt-2">
                    <Card className="h-full bg-timeline-bg border-panel-border p-2">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-foreground">
                          Timeline & Beats
                        </h3>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </div>
                      </div>
                      <div
                        className="relative h-12 bg-muted/20 rounded cursor-pointer"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const time = (x / rect.width) * duration;
                          seekTo(time);
                        }}
                      >
                        {/* Beat markers */}
                        {beats.map((beat, index) => (
                          <div
                            key={index}
                            className="absolute h-full bg-beat-active rounded"
                            style={{
                              left: `${(beat.time / duration) * 100}%`,
                              width: "2px",
                              opacity: beat.confidence,
                            }}
                          />
                        ))}
                        {/* Current time indicator */}
                        <div
                          className="absolute h-full w-1 bg-primary rounded"
                          style={{ left: `${(currentTime / duration) * 100}%` }}
                        />
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-px bg-panel-border hover:bg-accent/50 transition-colors" />

          {/* Right Panel - Settings */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={25}>
            <div className="h-full p-4 bg-card">
              <h3 className="text-lg font-semibold mb-4">Settings</h3>

              {/* Audio Status */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Music size={16} />
                  <span className="text-sm font-medium">Audio Track</span>
                </div>
                <div
                  className={`text-xs p-2 rounded ${
                    selectedAudio
                      ? "bg-accent/20 text-accent"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {selectedAudio ? "Audio loaded" : "No audio selected"}
                </div>
              </div>

              {/* Video Selection Status */}
              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Selected Videos</div>
                <div className="text-xs text-muted-foreground">
                  {selectedCount} of {videos.length} videos selected
                </div>
              </div>

              {/* Analysis Status */}
              {beats.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Analysis</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Beats detected: {beats.length}</div>
                    <div>Smart cuts: {smartCuts.length}</div>
                  </div>
                </div>
              )}

              {/* Preset Selector */}
              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Video Format</div>
                <Select
                  value={selectedPreset}
                  onValueChange={(value) =>
                    setSelectedPreset(
                      value as "landscape" | "portrait" | "square"
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">
                      📺 Landscape (16:9)
                    </SelectItem>
                    <SelectItem value="portrait">📱 Portrait (9:16)</SelectItem>
                    <SelectItem value="square">⬜ Square (1:1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!selectedAudio || selectedCount === 0 || isGenerating}
                onClick={handleGenerate}
              >
                <Wand2 size={16} className="mr-2" />
                {isGenerating
                  ? `${generationStage} (${generationProgress}%)`
                  : "Generate Edit"}
              </Button>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
