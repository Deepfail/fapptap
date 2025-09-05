/**
 * Platform detection utilities for Tauri vs browser environments.
 * Some environments (dev with fast refresh) may evaluate modules before
 * Tauri injects `window.__TAURI__`. We provide a lazily updated flag and
 * a subscription API so components can react when the desktop runtime
 * becomes available after initial load.
 *
 * Reference: TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md - Platform Detection Pattern
 */

declare global {
  interface Window {
    __TAURI__?: any;
  }
}

let desktop =
  typeof window !== "undefined" && (window as any).__TAURI__ !== undefined;
const listeners = new Set<(val: boolean) => void>();

function updateDesktopFlag(next: boolean) {
  if (desktop === next) return;
  desktop = next;
  for (const cb of listeners) {
    try {
      cb(desktop);
    } catch {}
  }
}

// Attempt a deferred detection (in case initial evaluation was too early)
if (!desktop && typeof window !== "undefined") {
  // microtask + animation frame to give Tauri preload a chance
  queueMicrotask(() => {
    if ((window as any).__TAURI__) updateDesktopFlag(true);
    else
      requestAnimationFrame(() => {
        if ((window as any).__TAURI__) updateDesktopFlag(true);
      });
  });
}

export function isTauriAvailable(): boolean {
  return desktop;
}

export function isTauri(): boolean {
  return desktop;
}

export const IS_DESKTOP = desktop; // legacy constant (snapshot at import time)
export function getPlatform(): "desktop" | "browser" {
  return desktop ? "desktop" : "browser";
}

// Subscribe to changes (only fires if the value transitions)
export function onDesktopAvailable(cb: () => void): () => void {
  if (desktop) {
    // fire async to keep behavior consistent
    setTimeout(cb, 0);
    return () => {};
  }
  const wrapper = (val: boolean) => {
    if (val) {
      cb();
      listeners.delete(wrapper);
    }
  };
  listeners.add(wrapper);
  return () => {
    listeners.delete(wrapper);
  };
}
