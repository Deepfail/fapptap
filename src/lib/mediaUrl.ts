/**
 * Media URL handling for both Tauri and browser environments
 */
import { onDesktopAvailable } from "./platform";

// Lazy import reference for Tauri core functions (avoid bundling in browser builds unnecessarily)
let convertFileSrcFn: ((path: string) => string) | null = null;
let triedImport = false;

async function ensureConvertFileSrc(): Promise<
  (path: string) => string
> {
  if (convertFileSrcFn) return convertFileSrcFn;
  if (!triedImport) {
    triedImport = true;
    try {
      const mod = await import("@tauri-apps/api/core");
      convertFileSrcFn = mod.convertFileSrc;
    } catch {
      // ignore; will remain null
    }
  }
  return convertFileSrcFn ?? ((p: string) => p);
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
  if (/^(?:https?:|blob:|data:|asset:)/i.test(pathOrUrl)) return pathOrUrl;

  const shouldConvert = isAbsoluteFsPath(pathOrUrl);
  if (shouldConvert) {
    const convert = await ensureConvertFileSrc();
    try {
      const out = convert(pathOrUrl);
      if (out !== pathOrUrl) {
        // Quick heuristic: if it is an asset: URL, keep it; otherwise return.
        if (out.startsWith("asset:")) {
          return out;
        }
        return out;
      }
    } catch { /* ignore */ }
    // Diagnostic: we expected to convert but still returning raw path (likely early before Tauri ready)
    if (shouldConvert) {
      // eslint-disable-next-line no-console
      console.debug("mediaUrl: convertFileSrc unavailable yet, returning raw path", pathOrUrl);
    }
  }
  return pathOrUrl;
}

// Re-convert previously raw absolute paths once desktop becomes available
onDesktopAvailable(async () => {
  if (!convertFileSrcFn) {
    try {
      const mod = await import("@tauri-apps/api/core");
      convertFileSrcFn = mod.convertFileSrc;
    } catch {}
  }
});

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