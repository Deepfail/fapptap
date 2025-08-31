import { useState, useEffect } from 'react';
import { isTauriAvailable } from '../lib/worker';
import { toMediaUrl } from '../lib/mediaUrl';

interface ThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  clipId?: string;
  videoPath?: string;
  timestamp?: number; // seconds into video for frame extraction
}

export const Thumbnail = ({
  src,
  alt,
  className = '',
  clipId,
  videoPath,
  timestamp = 0
}: ThumbnailProps) => {
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadThumbnail = async () => {
      // First try the provided src
      try {
        setLoading(true);
        const mediaSrc = toMediaUrl(src);
        const response = await fetch(mediaSrc);
        if (response.ok) {
          setThumbnailSrc(mediaSrc);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Fall through to generation logic
      }

      // If Tauri is available and we have video path, try to generate thumbnail
      if (isTauriAvailable() && videoPath && clipId) {
        try {
          await generateThumbnail(videoPath, clipId, timestamp);
        } catch (e) {
          console.warn('Failed to generate thumbnail:', e);
          setError(true);
        }
      } else {
        // Browser fallback - use a placeholder
        setThumbnailSrc(createPlaceholderThumbnail(alt));
      }
      setLoading(false);
    };

    loadThumbnail();
  }, [src, videoPath, clipId, timestamp, alt]);

  const generateThumbnail = async (videoPath: string, clipId: string, timestamp: number) => {
    if (!isTauriAvailable()) return;

    try {
      const { Command } = await import('@tauri-apps/plugin-shell');
      const { exists } = await import('@tauri-apps/plugin-fs');
      
      // Create cache directory if it doesn't exist
      const cacheDir = 'cache/thumbnails';
      const thumbnailPath = `${cacheDir}/${clipId}_${timestamp}.jpg`;
      
      if (await exists(thumbnailPath)) {
        setThumbnailSrc(toMediaUrl(thumbnailPath));
        return;
      }

      // Generate thumbnail using ffmpeg
      const command = Command.create('ffmpeg', [
        '-i', videoPath,
        '-ss', timestamp.toString(),
        '-vframes', '1',
        '-q:v', '3',
        '-y',
        thumbnailPath
      ]);

      const output = await command.execute();
      
      if (output.code === 0) {
        setThumbnailSrc(toMediaUrl(thumbnailPath));
      } else {
        throw new Error(`FFmpeg failed with code ${output.code}`);
      }
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      setError(true);
      setThumbnailSrc(createPlaceholderThumbnail(alt));
    }
  };

  const createPlaceholderThumbnail = (text: string): string => {
    // Create a simple SVG placeholder
    const svg = `
      <svg width="160" height="90" viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg">
        <rect width="160" height="90" fill="#374151"/>
        <circle cx="80" cy="45" r="15" fill="#6B7280"/>
        <polygon points="75,37 75,53 88,45" fill="white"/>
        <text x="80" y="70" text-anchor="middle" fill="white" font-family="Arial" font-size="10">
          ${text.slice(0, 20)}
        </text>
      </svg>
    `;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  if (loading) {
    return (
      <div className={`bg-slate-700 flex items-center justify-center ${className}`}>
        <div className="text-xs text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error && !thumbnailSrc) {
    return (
      <div className={`bg-slate-700 flex items-center justify-center ${className}`}>
        <div className="text-xs text-red-400">✗</div>
      </div>
    );
  }

  return (
    <img
      src={thumbnailSrc || createPlaceholderThumbnail(alt)}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (!error) {
          setError(true);
          setThumbnailSrc(createPlaceholderThumbnail(alt));
        }
      }}
    />
  );
};