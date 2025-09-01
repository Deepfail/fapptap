/**
 * Media URL handling for both Tauri and browser environments
 */
import { isTauriAvailable } from "./platform";

// Lazy import reference for Tauri core functions (avoid bundling in browser builds unnecessarily)
let convertFileSrcFn: ((path: string) => string) | null = null;

async function ensureConvertFileSrc(): Promise<
  (path: string) => string
> {
  if (!isTauriAvailable()) {
    return (p: string) => p;
  }
  if (convertFileSrcFn) return convertFileSrcFn;
  try {
    const mod = await import("@tauri-apps/api/core");
    convertFileSrcFn = mod.convertFileSrc;
  } catch (e) {
    // Fallback: identity function; consumer should handle load errors
    convertFileSrcFn = (p: string) => p;
  }
  return convertFileSrcFn!;
}

/**
 * Convert a file path to a media source URL that works in both Tauri and browser
 */
export function isAbsoluteFsPath(p: string): boolean {
  return /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(p);
}

/**
 * Convert a file path to a media source URL (async for Tauri convertFileSrc).
 * - Absolute paths on desktop -> convertFileSrc
 * - Relative paths -> returned unchanged (served by dev server or packaged assets)
 * - Already URLs (http/blob/data) -> unchanged
 */
export async function toMediaSrc(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return "";
  if (/^(?:https?:|blob:|data:)/i.test(pathOrUrl)) return pathOrUrl;

  if (isTauriAvailable() && isAbsoluteFsPath(pathOrUrl)) {
    const convert = await ensureConvertFileSrc();
    return convert(pathOrUrl);
  }
  // Fallback: relative or non-desktop environment
  return pathOrUrl;
}

/**
 * Check if a path/URL is a valid media file based on extension
 */
export function isMediaFile(pathOrUrl: string): boolean {
  if (!pathOrUrl) return false;
  
  const videoExtensions = [".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".m4v"];
  const audioExtensions = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a"];
  
  const lowerPath = pathOrUrl.toLowerCase();
  return [...videoExtensions, ...audioExtensions].some(ext => lowerPath.endsWith(ext));
}