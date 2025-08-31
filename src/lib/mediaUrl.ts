/**
 * Media URL handling for both Tauri and browser environments
 */
import { isTauriAvailable } from "./platform";

/**
 * Convert a file path to a media source URL that works in both Tauri and browser
 */
export function toMediaSrc(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  
  // If already a URL (http, blob, data), return as-is
  if (pathOrUrl.startsWith("http") || pathOrUrl.startsWith("blob:") || pathOrUrl.startsWith("data:")) {
    return pathOrUrl;
  }
  
  if (isTauriAvailable()) {
    // In Tauri, use asset protocol for local files
    // Convert Windows backslashes to forward slashes for URL
    const normalizedPath = pathOrUrl.replace(/\\/g, "/");
    return `asset://localhost/${normalizedPath}`;
  } else {
    // In browser, assume it's already a proper URL or will be handled by the dev server
    return pathOrUrl;
  }
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