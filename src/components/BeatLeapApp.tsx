import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

// Generate Workflow Services
import { createSession } from "@/services/session";
import { runStage } from "@/services/stages";

// Tauri APIs

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

// Icons
import {
  Upload,
  Wand2,
  Plus,
  X,
  CheckSquare,
  Square,
  Music,
  Clock,
  FileVideo,
  Sparkles,
  MonitorPlay,
  Play,
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

// Beats sanity check function

export default function BeatLeapApp() {
  console.log("BeatLeapApp: Rendering new modern UI component");

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
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  // Player State (for big screen only - generated content)

  // Generate State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState("");
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<
    "landscape" | "portrait" | "square"
  >("landscape");
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(
    null
  );

  // Analysis State

  // Session State (simplified - these were for the old workflow)
  const [sessionRoot, setSessionRoot] = useState<string | null>(null);
  const [isAnalyzing] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  // Refs
  const bigScreenVideoRef = useRef<HTMLVideoElement>(null);

  // Bigger thumbnail size for video playback
  const thumbnailSize = 180;

  // Calculate selected videos count
  const selectedCount = videos.filter((v) => v.selected).length;
  const allSelected = videos.length > 0 && selectedCount === videos.length;

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

  // Remove video from library
  const removeVideo = (videoId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setVideos((currentVideos) => {
      return currentVideos.filter((v) => v.id !== videoId);
    });
  };

  // Handle thumbnail hover/click for visual feedback only
  const handleThumbnailHover = (videoId: string, enter: boolean) => {
    setHoveredVideo(enter ? videoId : null);
  };

  // Handle thumbnail click to mark as "playing" (just visual indicator)
  const handleThumbnailClick = (video: VideoItem, event?: React.MouseEvent) => {
    // Don't interfere with selection/remove buttons
    if (event?.target !== event?.currentTarget) return;

    // Toggle playing visual state
    if (playingVideo === video.id) {
      setPlayingVideo(null);
    } else {
      setPlayingVideo(video.id);
    }
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
      setSessionRoot(session.root); // Update UI to show active session
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
        transition_effects: selectedEffects.join(","),
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

      setGenerationStage("Generating preview...");
      console.log("Stage: Generating preview");

      // 4. Generate proxy render
      console.log("=== STARTING PROXY RENDER ===");
      console.log("Session root:", session.root);
      console.log("Selected preset:", selectedPreset);

      // Run render stage to generate proxy
      await runStage("render", {
        proxy: true,
        base_dir: session.root,
        preset: selectedPreset || "landscape",
        effects: selectedEffects.join(","),
      });

      // Get proxy path and convert to blob URL for reliable playback
      const { getProxyPath } = await import("@/services/preview");
      const proxyPath = await getProxyPath(session.root);

      try {
        // Read the generated video file and create blob URL (same approach as video uploads)
        const { readFile } = await import("@tauri-apps/plugin-fs");
        console.log("Reading generated video from:", proxyPath);
        const fileBytes = await readFile(proxyPath);
        const blob = new Blob([fileBytes], { type: "video/mp4" });
        const blobUrl = URL.createObjectURL(blob);

        setGeneratedVideoUrl(blobUrl);
        console.log("=== PROXY RENDER COMPLETED ===");
        console.log("Generated video blob URL:", blobUrl);
      } catch (error) {
        console.error("Failed to load generated video as blob:", error);
        // Fallback to convertFileSrc (might not work in browser but worth trying)
        const { convertFileSrc } = await import("@tauri-apps/api/core");
        const fallbackUrl = convertFileSrc(proxyPath) + `?t=${Date.now()}`;
        setGeneratedVideoUrl(fallbackUrl);
        console.log("Using fallback URL:", fallbackUrl);
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
        errorMessage = `Generation timed out during: ${err.message}. The process might still be running.`;
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
      }, 2000);
    }
  };

  // UI Event Handlers

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
            : isGenerating
            ? "Generating..."
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
                        video.selected
                          ? "bg-accent/10 border-accent/50 ring-2 ring-accent/30"
                          : hoveredVideo === video.id
                          ? "bg-primary/10 border-primary/50"
                          : "hover:bg-muted/50 border-border/50 hover:border-accent/30"
                      }`}
                      onMouseEnter={() => handleThumbnailHover(video.id, true)}
                      onMouseLeave={() => handleThumbnailHover(video.id, false)}
                      onClick={(e) => handleThumbnailClick(video, e)}
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

                      {/* Always show thumbnail - no inline videos */}
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

                      {/* Play overlay - show when not playing */}
                      {playingVideo !== video.id && (
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="bg-primary/90 rounded-full p-2">
                            <Play
                              size={Math.min(20, thumbnailSize * 0.2)}
                              className="text-primary-foreground ml-0.5"
                            />
                          </div>
                        </div>
                      )}

                      {/* Playing indicator */}
                      {playingVideo === video.id && (
                        <div className="absolute inset-0 bg-primary/20 border-2 border-primary rounded flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full px-2 py-1 text-xs font-medium">
                            ▶ Playing
                          </div>
                        </div>
                      )}

                      {/* Duration badge */}
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Clock size={8} />
                        {formatDuration(video.duration)}
                      </div>

                      {/* Green checkmark for selected */}
                      {video.selected && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-accent text-accent-foreground rounded-full p-2 z-20">
                          <CheckSquare size={24} />
                        </div>
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

          {/* Center Panel - Big Screen (Reserved for Generated Edits) */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full p-4 min-h-0">
              <div className="h-full flex flex-col">
                <Card className="flex-1 bg-timeline-bg border-panel-border overflow-hidden">
                  <div className="h-full flex items-center justify-center relative p-4">
                    {generatedVideoUrl ? (
                      <>
                        <video
                          ref={bigScreenVideoRef}
                          className="w-full h-full object-contain"
                          style={{ maxWidth: "100%", maxHeight: "100%" }}
                          controls={true}
                          src={generatedVideoUrl}
                          onLoadedData={() =>
                            console.log("Generated video loaded successfully")
                          }
                          onError={(e) =>
                            console.error("Generated video error:", e)
                          }
                          onCanPlay={() =>
                            console.log("Generated video can play")
                          }
                        />

                        {/* Generated Video Label */}
                        <div className="absolute top-4 left-4 bg-accent/20 text-accent px-3 py-1 rounded-full text-sm flex items-center gap-2">
                          <Sparkles size={14} />
                          Generated Edit
                        </div>
                      </>
                    ) : isGenerating ? (
                      // Generation in progress
                      <div className="text-center text-muted-foreground">
                        <div className="w-24 h-24 mx-auto mb-4 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                          <Wand2
                            size={32}
                            className="animate-spin text-primary"
                          />
                        </div>
                        <p className="text-lg font-medium mb-2">
                          Generating Your Edit...
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Creating montage from{" "}
                          {videos.filter((v) => v.selected).length} selected
                          clips
                        </p>
                        <div className="w-64 bg-muted rounded-full h-2 mx-auto">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${generationProgress}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {generationProgress}% complete
                        </div>
                      </div>
                    ) : (
                      // Empty state - ready to generate
                      <div className="text-center text-muted-foreground">
                        <div className="w-24 h-24 mx-auto mb-4 bg-muted/50 rounded-full flex items-center justify-center">
                          <MonitorPlay size={32} />
                        </div>
                        <p className="text-lg font-medium mb-2">
                          Big Screen Ready
                        </p>
                        <p className="text-sm text-muted-foreground mb-6">
                          Your generated edit will appear here
                        </p>
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            1. Select clips from video library →
                          </p>
                          <p className="text-xs text-muted-foreground">
                            2. Choose audio track ↓
                          </p>
                          <p className="text-xs text-muted-foreground">
                            3. Click CREATE to generate montage
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-px bg-panel-border hover:bg-accent/50 transition-colors" />

          {/* Right Panel - CREATE Button & Settings */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={25}>
            <div className="h-full p-4 bg-card">
              <div className="space-y-6">
                {/* CREATE Button */}
                <div className="space-y-3">
                  <Button
                    onClick={() => {
                      console.log("CREATE button clicked");
                      console.log("selectedAudio:", selectedAudio);
                      console.log("videos:", videos);
                      console.log(
                        "selected videos:",
                        videos.filter((v) => v.selected)
                      );
                      handleGenerate();
                    }}
                    disabled={
                      !selectedAudio ||
                      videos.filter((v) => v.selected).length === 0 ||
                      isGenerating
                    }
                    className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold text-lg"
                  >
                    {isGenerating ? (
                      <>
                        <Wand2 className="w-5 h-5 mr-2 animate-spin" />
                        {generationStage || "Generating..."}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        CREATE
                      </>
                    )}
                  </Button>

                  {(!selectedAudio ||
                    videos.filter((v) => v.selected).length === 0) && (
                    <p className="text-xs text-muted-foreground text-center">
                      Select audio & video clips to enable
                    </p>
                  )}
                </div>

                <div className="h-px bg-border"></div>

                {/* Audio Status */}
                <div>
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
                <div>
                  <div className="text-sm font-medium mb-2">
                    Selected Videos
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedCount} of {videos.length} videos selected
                  </div>
                </div>

                {/* Session Status */}
                <div>
                  <div className="text-sm font-medium mb-2">Status</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Session: {sessionRoot ? "Active" : "None"}</div>
                    <div>
                      Videos: {videos.filter((v) => v.selected).length} selected
                    </div>
                  </div>
                </div>

                {/* Preset Selector */}
                <div>
                  <div className="text-sm font-medium mb-2">Video Format</div>
                  <Select
                    value={selectedPreset}
                    onValueChange={(value) =>
                      setSelectedPreset(
                        value as "landscape" | "portrait" | "square"
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landscape">
                        📺 Landscape (16:9)
                      </SelectItem>
                      <SelectItem value="portrait">
                        📱 Portrait (9:16)
                      </SelectItem>
                      <SelectItem value="square">⬜ Square (1:1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Multi-Effect Selector */}
                <div>
                  <div className="text-sm font-medium mb-2">
                    Transition Effects
                  </div>
                  <div className="space-y-2">
                    {[
                      {
                        id: "flash",
                        name: "⚡ Flash",
                        desc: "50ms brightness flash",
                      },
                      {
                        id: "punch_in",
                        name: "🎯 Punch In",
                        desc: "Quick zoom entrance",
                      },
                      {
                        id: "fade_in",
                        name: "🌅 Fade In",
                        desc: "Smooth fade entrance",
                      },
                      {
                        id: "zoom_in",
                        name: "🔍 Zoom In",
                        desc: "Gradual zoom effect",
                      },
                      {
                        id: "slide_left",
                        name: "👈 Slide Left",
                        desc: "Left slide entrance",
                      },
                      {
                        id: "slide_right",
                        name: "👉 Slide Right",
                        desc: "Right slide entrance",
                      },
                    ].map((effect) => (
                      <label
                        key={effect.id}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEffects.includes(effect.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEffects([
                                ...selectedEffects,
                                effect.id,
                              ]);
                            } else {
                              setSelectedEffects(
                                selectedEffects.filter((id) => id !== effect.id)
                              );
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{effect.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({effect.desc})
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedEffects.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Selected effects will be randomly distributed across all
                      cuts (one per cut)
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
