/**
 * Platform detection utilities for Tauri vs browser environments
 */

// Extend Window interface to include Tauri
declare global {
  interface Window {
    __TAURI__?: any;
  }
}

// Check if we're running in Tauri (desktop) or browser
export const IS_DESKTOP =
  typeof window !== "undefined" && window.__TAURI__ !== undefined;

// Check if Tauri APIs are available
export function isTauriAvailable(): boolean {
  return IS_DESKTOP;
}

// Get platform info
export function getPlatform(): "desktop" | "browser" {
  return IS_DESKTOP ? "desktop" : "browser";
}
