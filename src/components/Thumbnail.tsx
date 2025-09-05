import { useState, useEffect } from "react";
import { IS_DESKTOP } from "@/lib/platform";
import { requestThumbnail, setupScanListeners } from "@/ipc/commands";

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
  className = "",
  clipId,
  videoPath,
  timestamp = 0,
}: ThumbnailProps) => {
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadThumbnail = async () => {
      setLoading(true);
      setError(false);

      // First try the provided src
      try {
        const response = await fetch(src);
        if (response.ok) {
          setThumbnailSrc(src);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Fall through to generation logic
      }

      // If Tauri is available and we have video path, try to use backend thumbnail API
      if (IS_DESKTOP && videoPath) {
        try {
          // Use the backend thumbnail generator instead of direct FFmpeg
          await requestThumbnail(videoPath);
          // The thumbnail will be ready via event listener
        } catch (e) {
          console.warn("Failed to request thumbnail:", e);
          setError(true);
          setThumbnailSrc(createPlaceholderThumbnail(alt));
        }
      } else {
        // Browser fallback - use a placeholder
        setThumbnailSrc(createPlaceholderThumbnail(alt));
      }
      setLoading(false);
    };

    loadThumbnail();
  }, [src, videoPath, clipId, timestamp, alt]);

  // Listen for thumbnail ready events
  useEffect(() => {
    if (!IS_DESKTOP || !videoPath) return;

    const unlisteners: (() => void)[] = [];

    setupScanListeners({
      onThumbReady: (result) => {
        if (result.src_path === videoPath) {
          setThumbnailSrc(result.thumb_path);
          setLoading(false);
          setError(false);
        }
      },
    });

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [videoPath]);

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
      <div
        className={`bg-slate-700 flex items-center justify-center ${className}`}
      >
        <div className="text-xs text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error && !thumbnailSrc) {
    return (
      <div
        className={`bg-slate-700 flex items-center justify-center ${className}`}
      >
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
