// Platform detection utilities for Tauri vs browser environment

/**
 * Check if we're running in a Tauri desktop environment
 */
export const IS_DESKTOP = typeof window !== "undefined" && "__TAURI__" in window;

/**
 * Check if Tauri APIs are available
 */
export function isTauriAvailable(): boolean {
  return IS_DESKTOP;
}

/**
 * Get the current platform type
 */
export function getPlatform(): "desktop" | "browser" {
  return IS_DESKTOP ? "desktop" : "browser";
}