/**
 * Video aspect ratio utilities for standardized thumbnail sizing
 * Supports 3 standard aspect ratios: portrait, square, and landscape
 */

export type AspectRatio = "portrait" | "square" | "landscape";

/**
 * Determine aspect ratio category from video dimensions
 */
export function getAspectRatioCategory(
  width: number,
  height: number
): AspectRatio {
  const ratio = width / height;

  if (ratio < 0.9) {
    return "portrait"; // 9:16, 3:4, etc.
  } else if (ratio > 1.1) {
    return "landscape"; // 16:9, 4:3, etc.
  } else {
    return "square"; // 1:1 or very close
  }
}

/**
 * Get CSS aspect ratio classes for consistent thumbnail display
 */
export function getAspectRatioClasses(
  aspectRatio: AspectRatio,
  thumbnailMode: boolean = false
): string {
  if (thumbnailMode) {
    // In thumbnail mode, force everything to square for grid consistency
    return "aspect-square";
  }

  switch (aspectRatio) {
    case "portrait":
      return "aspect-[9/16]"; // Standard portrait ratio
    case "square":
      return "aspect-square";
    case "landscape":
    default:
      return "aspect-video"; // Standard 16:9 landscape
  }
}

/**
 * Get object-fit style for proper cropping
 */
export function getObjectFitStyle(): string {
  // Always use object-cover for proper cropping in all modes
  return "object-cover";
}

/**
 * Get object-position for optimal cropping
 */
export function getObjectPosition(
  aspectRatio: AspectRatio,
  thumbnailMode: boolean = false
): string {
  if (thumbnailMode) {
    // Center crop for thumbnails
    return "center center";
  }

  switch (aspectRatio) {
    case "portrait":
      return "center top"; // Show top portion of portrait videos
    case "square":
      return "center center";
    case "landscape":
    default:
      return "center center";
  }
}

/**
 * Estimate aspect ratio from video element (fallback when metadata unavailable)
 */
export function estimateAspectRatioFromVideo(
  videoElement: HTMLVideoElement
): AspectRatio {
  const { videoWidth, videoHeight } = videoElement;

  if (videoWidth > 0 && videoHeight > 0) {
    return getAspectRatioCategory(videoWidth, videoHeight);
  }

  // Fallback to landscape if we can't determine
  return "landscape";
}

/**
 * Standard aspect ratio configurations
 */
export const ASPECT_RATIO_CONFIG = {
  portrait: {
    label: "Portrait",
    ratio: 9 / 16,
    cssClass: "aspect-[9/16]",
    examples: ["9:16", "3:4", "4:5"],
  },
  square: {
    label: "Square",
    ratio: 1,
    cssClass: "aspect-square",
    examples: ["1:1"],
  },
  landscape: {
    label: "Landscape",
    ratio: 16 / 9,
    cssClass: "aspect-video",
    examples: ["16:9", "4:3", "21:9"],
  },
} as const;
