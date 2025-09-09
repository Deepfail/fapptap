/**
 * Embedded Video Player for Live FFPlay Mode
 * Alternative to external ffplay - renders preview files as HTML5 video
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, Volume2, Maximize } from 'lucide-react';
import { Timeline } from '@/preview/types';
import { isTauriAvailable } from '@/lib/platform';

interface EmbeddedVideoPlayerProps {
  timeline: Timeline | null;
  previewPath?: string; // Path to generated preview video
  disabled?: boolean;
}

export function EmbeddedVideoPlayer({ 
  timeline, 
  previewPath, 
  disabled = false 
}: EmbeddedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [error, setError] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  // Convert Tauri path to URL for video element
  useEffect(() => {
    if (!previewPath) {
      setVideoSrc(null);
      return;
    }

    const loadVideo = async () => {
      try {
        if (isTauriAvailable()) {
          // For Tauri, convert file path to asset URL
          const { convertFileSrc } = await import('@tauri-apps/api/core');
          const assetUrl = convertFileSrc(previewPath);
          setVideoSrc(assetUrl);
        } else {
          // Browser mode - assume blob URL or relative path
          setVideoSrc(previewPath);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to load video:', err);
        setError('Failed to load video file');
      }
    };

    loadVideo();
  }, [previewPath]);

  // Video event handlers
  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const canPlay = videoSrc && !disabled;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Embedded Video Player</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Video Player */}
        <div className="relative bg-black rounded-md overflow-hidden mb-4">
          {videoSrc ? (
            <video
              ref={videoRef}
              className="w-full h-auto max-h-96"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onError={() => setError('Video playback error')}
              preload="metadata"
            >
              <source src={videoSrc} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="w-full h-48 flex items-center justify-center text-muted-foreground">
              {error ? error : 'No preview available - generate timeline first'}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePlay}
              disabled={!canPlay || isPlaying}
              variant="default"
              size="sm"
            >
              <Play className="h-4 w-4" />
            </Button>
            
            <Button
              onClick={handlePause}
              disabled={!canPlay || !isPlaying}
              variant="outline"
              size="sm"
            >
              <Pause className="h-4 w-4" />
            </Button>
            
            <Button
              onClick={handleStop}
              disabled={!canPlay}
              variant="outline"
              size="sm"
            >
              <Square className="h-4 w-4" />
            </Button>

            <Button
              onClick={handleFullscreen}
              disabled={!canPlay}
              variant="outline"
              size="sm"
            >
              <Maximize className="h-4 w-4" />
            </Button>

            {/* Time Display */}
            <span className="text-sm text-muted-foreground ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Progress Bar */}
          {duration > 0 && (
            <div 
              className="w-full h-2 bg-muted rounded-full cursor-pointer relative"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-primary rounded-full"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          )}

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="flex-1 h-2"
            />
            <span className="text-sm text-muted-foreground w-8">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* Timeline Info */}
        {timeline && (
          <div className="mt-3 pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Timeline: {timeline.clips.length} clips • {timeline.fps} FPS • Tempo: {timeline.globalTempo.toFixed(1)}x
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Feature Note */}
        <div className="mt-3 text-xs text-muted-foreground">
          Note: This embedded player requires pre-rendered video files. 
          Use external FFplay for real-time preview during editing.
        </div>
      </CardContent>
    </Card>
  );
}