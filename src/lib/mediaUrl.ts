// Media URL utilities for converting file paths to usable URLs

import { isTauriAvailable } from "./platform";

/**
 * Convert a file path to a media source URL that can be used in HTML media elements
 */
export function toMediaSrc(path?: string): string {
  if (!path) return "";
  
  // If it's already a blob URL or HTTP URL, return as-is
  if (path.startsWith("blob:") || path.startsWith("http")) {
    return path;
  }
  
  if (isTauriAvailable()) {
    // In Tauri, we need to convert file paths to the proper format
    // For now, return the path as-is and let Tauri handle it
    return `asset://localhost/${path.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/')}`;
  }
  
  // Browser fallback - assume it's a relative path
  return path;
}