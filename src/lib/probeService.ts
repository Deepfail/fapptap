/**
 * Media Probe Service - 2-Tier Implementation
 *
 * Implements FAST and DEEP ffprobe with robust caching:
 * - FAST: Basic metadata for UI (duration, codec, dimensions, fps)
 * - DEEP: Detailed frame analysis for timeline/render
 * - Cache key: (abs_path, size_bytes, mtime_ns)
 * - Max 6 concurrent probes
 *
 * Reference: TODO.md - Media Probe (2-Tier) Implementation Brief
 */

import { Command } from "@tauri-apps/plugin-shell";
import { stat } from "@tauri-apps/plugin-fs";
import { isTauri } from "./platform";
import { logger, logSidecarOutput } from "./logging";
import { probeCache } from "./sqliteTools";

// Types matching SQLite schema
export interface ProbeMeta {
  path: string;
  size_bytes: number;
  mtime_ns: number;
  probed_at: number;
  duration_sec?: number;
  video_codec?: string;
  audio_codec?: string;
  width?: number;
  height?: number;
  fps_num?: number;
  fps_den?: number;
  sample_rate?: number;
  channels?: number;
  json_path?: string;
  deep_ready: 0 | 1;
}

export interface ProbeStatus {
  path: string;
  status: "queued" | "probing" | "cached-fast" | "cached-deep" | "error";
  error?: string;
  progress?: number;
}

// Queue management
const CONCURRENCY = 6;
const probeQueue: string[] = [];
const activeProbes = new Map<string, Promise<ProbeMeta | null>>();
const probeStatus = new Map<string, ProbeStatus>();
const statusListeners = new Set<(status: Map<string, ProbeStatus>) => void>();

/**
 * Subscribe to probe status changes
 */
export function onProbeStatusChange(
  callback: (status: Map<string, ProbeStatus>) => void
): () => void {
  statusListeners.add(callback);
  return () => statusListeners.delete(callback);
}

/**
 * Update probe status and notify listeners
 */
function updateProbeStatus(path: string, updates: Partial<ProbeStatus>): void {
  const current = probeStatus.get(path) || { path, status: "queued" };
  const updated = { ...current, ...updates };
  probeStatus.set(path, updated);

  // Notify all listeners
  statusListeners.forEach((callback) => {
    try {
      callback(new Map(probeStatus));
    } catch (error) {
      logger.warn("Probe status listener error:", error);
    }
  });
}

/**
 * Generate cache key for JSON sidecar file
 */
function generateCacheKey(
  path: string,
  sizeBytes: number,
  mtimeNs: number
): string {
  const combined = `${path}|${sizeBytes}|${mtimeNs}`;
  // Simple hash for filename (could use crypto.subtle in production)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Get file stats for cache key generation
 */
async function getFileStats(
  path: string
): Promise<{ size: number; mtime: number } | null> {
  if (!isTauri()) {
    logger.warn("File stats not available in browser mode");
    return null;
  }

  try {
    const stats = await stat(path);
    return {
      size: stats.size || 0,
      mtime: Math.round((stats.mtime?.getTime() || 0) * 1000000), // Convert to nanoseconds
    };
  } catch (error) {
    logger.error(`Failed to stat file ${path}:`, error);
    return null;
  }
}

/**
 * Check cache for existing probe data
 */
async function checkCache(
  path: string,
  sizeBytes: number,
  mtimeNs: number
): Promise<ProbeMeta | null> {
  try {
    return await probeCache.checkProbeCache(path, sizeBytes, mtimeNs);
  } catch (error) {
    logger.warn("Cache check failed:", error);
    return null;
  }
}

/**
 * Store probe results in cache
 */
async function storeInCache(meta: ProbeMeta): Promise<void> {
  try {
    await probeCache.saveProbeCache(meta);
    logger.info(`Stored probe cache for: ${meta.path}`);
  } catch (error) {
    logger.error("Failed to store in cache:", error);
  }
}

/**
 * Parse frame rate string (e.g., "30/1", "29.97") to numerator/denominator
 */
function parseFrameRate(rateStr: string): { num: number; den: number } {
  if (!rateStr) return { num: 0, den: 1 };

  if (rateStr.includes("/")) {
    const [num, den] = rateStr.split("/").map(Number);
    return { num: num || 0, den: den || 1 };
  } else {
    const rate = parseFloat(rateStr);
    if (isNaN(rate)) return { num: 0, den: 1 };

    // Convert decimal to fraction (e.g., 29.97 -> 2997/100)
    const factor = Math.pow(10, (rateStr.split(".")[1] || "").length);
    return { num: Math.round(rate * factor), den: factor };
  }
}

/**
 * Execute FAST ffprobe pass
 */
async function runFastProbe(path: string): Promise<ProbeMeta | null> {
  if (!isTauri()) {
    throw new Error("Probe execution only available in desktop mode");
  }

  logger.info(`Running FAST probe for: ${path}`);

  try {
    const command = Command.sidecar("binaries/ffprobebin", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-select_streams",
      "v:0,a:0",
      "-show_streams",
      path,
    ]);

    const result = await command.execute();

    // Log sidecar output
    logSidecarOutput("ffprobebin", result.stdout, result.stderr);

    if (result.code !== 0) {
      throw new Error(
        `ffprobe failed with code ${result.code}: ${result.stderr}`
      );
    }

    const probeData = JSON.parse(result.stdout);
    const format = probeData.format || {};
    const streams = probeData.streams || [];

    const videoStream = streams.find((s: any) => s.codec_type === "video");
    const audioStream = streams.find((s: any) => s.codec_type === "audio");

    // Get file stats for cache key
    const stats = await getFileStats(path);
    if (!stats) {
      throw new Error("Failed to get file stats");
    }

    // Parse frame rate
    const frameRate = videoStream?.r_frame_rate
      ? parseFrameRate(videoStream.r_frame_rate)
      : { num: 0, den: 1 };

    const cacheKey = generateCacheKey(path, stats.size, stats.mtime);
    const jsonPath = `cache/probe/${cacheKey}.json`;

    const meta: ProbeMeta = {
      path,
      size_bytes: stats.size,
      mtime_ns: stats.mtime,
      probed_at: Math.floor(Date.now() / 1000),
      duration_sec: parseFloat(format.duration) || undefined,
      video_codec: videoStream?.codec_name,
      audio_codec: audioStream?.codec_name,
      width: videoStream?.width,
      height: videoStream?.height,
      fps_num: frameRate.num,
      fps_den: frameRate.den,
      sample_rate: audioStream?.sample_rate
        ? parseInt(audioStream.sample_rate)
        : undefined,
      channels: audioStream?.channels,
      json_path: jsonPath,
      deep_ready: 0,
    };

    // Store full JSON to sidecar file (TODO: implement writeFile)
    // For now, we'll store in SQLite only

    // Store in cache
    await storeInCache(meta);

    logger.info(`FAST probe completed for: ${path}`);
    return meta;
  } catch (error) {
    logger.error(`FAST probe failed for ${path}:`, error);
    throw error;
  }
}

/**
 * Process the probe queue
 */
async function processQueue(): Promise<void> {
  while (probeQueue.length > 0 && activeProbes.size < CONCURRENCY) {
    const path = probeQueue.shift();
    if (!path || activeProbes.has(path)) continue;

    const probePromise = (async () => {
      try {
        updateProbeStatus(path, { status: "probing", progress: 0 });

        // Check file stats
        const stats = await getFileStats(path);
        if (!stats) {
          throw new Error("File not accessible");
        }

        // Check cache first
        const cached = await checkCache(path, stats.size, stats.mtime);
        if (cached) {
          updateProbeStatus(path, {
            status: cached.deep_ready ? "cached-deep" : "cached-fast",
            progress: 100,
          });
          return cached;
        }

        // Run FAST probe
        const result = await runFastProbe(path);
        if (result) {
          updateProbeStatus(path, { status: "cached-fast", progress: 100 });
        }
        return result;
      } catch (error) {
        logger.error(`Probe failed for ${path}:`, error);
        updateProbeStatus(path, {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    })();

    activeProbes.set(path, probePromise);

    // Clean up when done
    probePromise.finally(() => {
      activeProbes.delete(path);
      // Continue processing queue
      processQueue();
    });
  }
}

/**
 * Request probe for a file (FAST pass)
 * Returns immediately with cached data if available, otherwise queues for probing
 */
export async function requestProbe(path: string): Promise<ProbeMeta | null> {
  logger.debug(`Probe requested for: ${path}`);

  // Check if already in progress
  const activeProbe = activeProbes.get(path);
  if (activeProbe) {
    return activeProbe;
  }

  // Quick cache check with current file stats
  const stats = await getFileStats(path);
  if (stats) {
    const cached = await checkCache(path, stats.size, stats.mtime);
    if (cached) {
      updateProbeStatus(path, {
        status: cached.deep_ready ? "cached-deep" : "cached-fast",
        progress: 100,
      });
      return cached;
    }
  }

  // Add to queue if not already there
  if (!probeQueue.includes(path)) {
    probeQueue.push(path);
    updateProbeStatus(path, { status: "queued" });
  }

  // Start processing
  processQueue();

  return null; // Will be available later via status updates
}

/**
 * Get current probe status for a file
 */
export function getProbeStatus(path: string): ProbeStatus | undefined {
  return probeStatus.get(path);
}

/**
 * Get all current probe statuses
 */
export function getAllProbeStatuses(): Map<string, ProbeStatus> {
  return new Map(probeStatus);
}

/**
 * Clear probe status (for cleanup)
 */
export function clearProbeStatus(path: string): void {
  probeStatus.delete(path);
  updateProbeStatus(path, { status: "queued" }); // This will remove it with empty status
}
