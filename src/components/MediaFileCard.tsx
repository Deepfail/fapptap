import { useState, useRef, useEffect } from "react";
import { Play, Pause, Check, Clock, HardDrive } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useMediaStore } from "../state/mediaStore";
import { MediaFile } from "../state/mediaStore";
import { cn } from "../lib/utils";
import { toMediaUrl } from "../lib/mediaUrl";

interface MediaFileCardProps {
  file: MediaFile;
  viewMode: 'grid' | 'list';
}

export function MediaFileCard({ file, viewMode }: MediaFileCardProps) {
  const {
    selectedClipIds,
    currentClipId,
    toggleClipSelection,
    setCurrentClip,
  } = useMediaStore();
  
  const [isHovering, setIsHovering] = useState(false);
  const [quickPlaying, setQuickPlaying] = useState(false);
  const [hoverProgress, setHoverProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const isSelected = selectedClipIds.has(file.id);
  const isCurrent = currentClipId === file.id;
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
      return `${mb.toFixed(1)}MB`;
    }
    return `${(mb / 1024).toFixed(1)}GB`;
  };
  
  const getResolutionBadge = () => {
    if (!file.width || !file.height) return null;
    
    if (file.height >= 2160) return "4K";
    if (file.height >= 1440) return "1440p";
    if (file.height >= 1080) return "1080p";
    if (file.height >= 720) return "720p";
    return `${file.height}p`;
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    setCurrentClip(file.id);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (quickPlaying) {
      setQuickPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  };

  const handleQuickPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!videoRef.current) return;
    
    if (quickPlaying) {
      videoRef.current.pause();
      setQuickPlaying(false);
    } else {
      videoRef.current.play();
      setQuickPlaying(true);
    }
  };

  const handleSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleClipSelection(file.id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current || viewMode === 'list') return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    setHoverProgress(progress);
    
    // TODO: Implement hover-scrub with thumbnail sprite
    // For now, just update progress indicator
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true; // Quick-play should be muted
    }
  }, []);

  if (viewMode === 'list') {
    return (
      <Card
        ref={cardRef}
        className={cn(
          "p-3 cursor-pointer transition-all duration-200 hover:bg-slate-700/50",
          isSelected && "ring-2 ring-blue-500",
          isCurrent && "bg-slate-700/30"
        )}
        onClick={() => setCurrentClip(file.id)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex items-center gap-3">
          {/* Thumbnail */}
          <div className="relative w-16 h-9 bg-slate-800 rounded overflow-hidden flex-shrink-0">
            {file.thumbnail && (
              <img
                src={toMediaUrl(file.thumbnail)}
                alt={file.name}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-80 hover:opacity-100"
                onClick={handleQuickPlay}
              >
                {quickPlaying ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium truncate">{file.name}</h4>
              <div className="flex items-center gap-1">
                {getResolutionBadge() && (
                  <Badge variant="secondary" className="text-xs py-0">
                    {getResolutionBadge()}
                  </Badge>
                )}
                {file.fps && (
                  <Badge variant="secondary" className="text-xs py-0">
                    {file.fps}fps
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(file.duration)}
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {formatFileSize(file.size)}
              </span>
            </div>
          </div>
          
          {/* Selection */}
          <Button
            size="sm"
            variant={isSelected ? "default" : "ghost"}
            className="h-8 w-8 p-0"
            onClick={handleSelection}
          >
            {isSelected ? (
              <Check className="h-4 w-4" />
            ) : (
              <div className="h-4 w-4 border-2 border-slate-400 rounded" />
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      ref={cardRef}
      className={cn(
        "relative cursor-pointer transition-all duration-200 overflow-hidden",
        "hover:ring-2 hover:ring-blue-400",
        isSelected && "ring-2 ring-blue-500",
        isCurrent && "ring-2 ring-purple-500"
      )}
      onClick={() => setCurrentClip(file.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* Thumbnail/Video */}
      <div className="aspect-video bg-slate-800 relative overflow-hidden">
        {file.thumbnail && (
          <img
            src={toMediaUrl(file.thumbnail)}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Hidden video for quick-play */}
        <video
          ref={videoRef}
          src={toMediaUrl(file.path)}
          className="absolute inset-0 w-full h-full object-cover opacity-0"
          muted
          playsInline
        />
        
        {/* Quick-play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full bg-black/50 hover:bg-black/70"
            onClick={handleQuickPlay}
          >
            {quickPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
          </Button>
        </div>
        
        {/* Hover progress indicator */}
        {isHovering && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div
              className="h-full bg-blue-500 transition-all duration-100"
              style={{ width: `${hoverProgress * 100}%` }}
            />
          </div>
        )}
        
        {/* Quick-play progress ring */}
        {quickPlaying && (
          <div className="absolute top-2 right-2">
            <div className="w-6 h-6 rounded-full border-2 border-white/30">
              <div className="w-full h-full rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </div>
          </div>
        )}
        
        {/* Selection checkbox */}
        <div className="absolute top-2 left-2">
          <Button
            size="sm"
            variant={isSelected ? "default" : "secondary"}
            className={cn(
              "h-6 w-6 p-0 rounded",
              isSelected ? "bg-blue-500 hover:bg-blue-600" : "bg-black/50 hover:bg-black/70"
            )}
            onClick={handleSelection}
          >
            {isSelected ? (
              <Check className="h-3 w-3" />
            ) : (
              <div className="h-3 w-3 border border-white/70 rounded" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Info */}
      <div className="p-3">
        <h4 className="text-sm font-medium truncate mb-2">{file.name}</h4>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(file.duration)}
            </span>
            {getResolutionBadge() && (
              <Badge variant="secondary" className="text-xs py-0">
                {getResolutionBadge()}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {file.fps && (
              <Badge variant="secondary" className="text-xs py-0">
                {file.fps}fps
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}