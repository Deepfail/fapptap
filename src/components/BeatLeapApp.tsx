import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

// Generate Workflow Services
import { createSession } from "@/services/session";
import { runStage } from "@/services/stages";

// UI Components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
  url: string;
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

export default function BeatLeapApp() {
  console.log("BeatLeapApp: Rendering new modern UI component");

  // Test toast on first load
  useEffect(() => {
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

  // Analysis State
  const [beats, setBeats] = useState<Beat[]>([]);
  const [smartCuts, setSmartCuts] = useState<SmartCut[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetectingCuts, setIsDetectingCuts] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

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

  // Handle audio file selection
  const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      const url = URL.createObjectURL(file);
      setSelectedAudio(url);
      toast.success(`Audio selected: ${file.name}`);
    }
    if (audioInputRef.current) {
      audioInputRef.current.value = "";
    }
  };

  // Handle file upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("video/")) continue;

      try {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = async () => {
            try {
              const thumbnail = await generateThumbnail(video);

              const videoItem: VideoItem = {
                id:
                  Date.now().toString() +
                  Math.random().toString(36).substr(2, 9),
                name: file.name,
                url,
                duration: video.duration,
                size: file.size,
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
          video.src = url;
        });
      } catch (error) {
        console.error("Error processing video file:", error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.success(`Added ${Array.from(files).length} videos to library`);
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
      setGenerationStage("Creating session...");

      // Get selected videos
      const selectedVideos = videos.filter((v) => v.selected);

      // 1. Create session
      const session = await createSession(
        selectedVideos.map((v) => v.url), // Using URLs for now
        selectedAudio
      );

      setGenerationProgress(20);
      setGenerationStage("Analyzing beats...");

      // 2. Run beats analysis
      await runStage("beats", { audio: session.audio });

      setGenerationProgress(50);
      setGenerationStage("Building cutlist...");

      // 3. Build cutlist
      await runStage("cutlist", {
        song: session.audio,
        clips: session.clipsDir,
        style: "auto", // Default style
        cutting_mode: "smart",
      });

      setGenerationProgress(80);
      setGenerationStage("Generating preview...");

      // 4. Generate proxy render
      await runStage("render", { proxy: true });

      setGenerationProgress(100);
      setGenerationStage("Complete!");

      toast.success("Generated edit successfully!");
    } catch (error) {
      console.error("Generate error:", error);
      toast.error(`Generation failed: ${error}`);
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStage("");
      }, 2000);
    }
  };

  // AI-powered beat detection (simplified)
  const analyzeAudio = useCallback(async () => {
    if (!currentVideo) return;

    setIsAnalyzing(true);

    try {
      // Generate sample beats for demo (in real implementation, would use audio analysis)
      const sampleBeats: Beat[] = [];
      const beatInterval = 0.6; // ~100 BPM
      for (let time = 0; time < duration; time += beatInterval) {
        sampleBeats.push({
          time,
          confidence: 0.7 + Math.random() * 0.3,
          energy: 0.5 + Math.random() * 0.5,
        });
      }

      setBeats(sampleBeats);
      toast.success(`Detected ${sampleBeats.length} beats`);
    } catch (error) {
      console.error("Error analyzing audio:", error);
      toast.error("Failed to analyze audio");
    } finally {
      setIsAnalyzing(false);
    }
  }, [currentVideo, duration]);

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
    <div className="h-screen flex flex-col bg-background text-foreground">
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
      <div className="flex-1 flex flex-col">
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
                  onClick={() => audioInputRef.current?.click()}
                >
                  <Music size={16} />
                  {selectedAudio ? "Change Audio" : "Select Audio"}
                </Button>
                <Input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                />

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
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload size={16} />
                  {isUploading ? "Importing..." : "Import Videos"}
                </Button>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <ScrollArea className="flex-1">
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
                    onClick={() => fileInputRef.current?.click()}
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
            <div className="h-full p-4">
              <div className="h-full flex flex-col">
                <Card className="flex-1 bg-timeline-bg border-panel-border">
                  <div className="h-full flex items-center justify-center relative">
                    {currentVideo ? (
                      <>
                        <video
                          ref={videoRef}
                          className="max-w-full max-h-full object-contain"
                          controls={false}
                        />

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
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-sm rounded-lg p-3">
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
                          onClick={() => fileInputRef.current?.click()}
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
