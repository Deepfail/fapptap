/**
 * Preview Player - Shows proxy/final video with transport controls
 */
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/state/editorStore";
import { toMediaSrc } from "@/lib/mediaUrl";
import { 
  Play, 
  Pause, 
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX
} from "lucide-react";

export function PreviewPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { playhead, setPlayhead, timeline } = useEditor();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Update video source when preview is available
  useEffect(() => {
    const loadPreview = async () => {
      try {
        setIsLoading(true);
        // Try to load the proxy preview
        const previewSrc = await toMediaSrc("render/fapptap_proxy.mp4");
        setCurrentSrc(previewSrc);
      } catch (error) {
        console.log("No proxy preview available yet");
        setCurrentSrc("");
      } finally {
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [timeline]); // Reload when timeline changes

  // Sync video playhead with store
  useEffect(() => {
    const video = videoRef.current;
    if (video && Math.abs(video.currentTime - playhead) > 0.1) {
      video.currentTime = playhead;
    }
  }, [playhead]);

  // Update store playhead when video time changes
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setPlayhead(video.currentTime);
    }
  };

  const handlePlay = () => {
    const video = videoRef.current;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleStop = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);
      setPlayhead(0);
    }
  };

  const handleSeekToStart = () => {
    setPlayhead(0);
  };

  const handleSeekToEnd = () => {
    const video = videoRef.current;
    if (video) {
      setPlayhead(video.duration || 0);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Video Container */}
      <div className="flex-1 flex items-center justify-center bg-black">
        {currentSrc ? (
          <video
            ref={videoRef}
            src={currentSrc}
            className="max-w-full max-h-full"
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onLoadedData={() => setIsLoading(false)}
            controls={false}
          />
        ) : (
          <div className="text-gray-500 text-center">
            {isLoading ? (
              <div>Loading preview...</div>
            ) : (
              <div>
                <div className="text-4xl mb-2">🎬</div>
                <div>Generate a timeline to see preview</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transport Controls */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleSeekToStart}
            size="sm"
            variant="ghost"
            disabled={!currentSrc}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            onClick={handlePlay}
            size="sm"
            disabled={!currentSrc}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          <Button
            onClick={handleStop}
            size="sm"
            variant="ghost"
            disabled={!currentSrc}
          >
            <Square className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleSeekToEnd}
            size="sm"
            variant="ghost"
            disabled={!currentSrc}
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Time Display */}
        <div className="text-sm text-gray-300">
          {currentSrc && videoRef.current ? (
            <span>
              {formatTime(playhead)} / {formatTime(videoRef.current.duration || 0)}
            </span>
          ) : (
            <span>--:-- / --:--</span>
          )}
        </div>

        {/* Volume */}
        <div className="flex items-center space-x-2">
          <Button
            onClick={toggleMute}
            size="sm"
            variant="ghost"
            disabled={!currentSrc}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}