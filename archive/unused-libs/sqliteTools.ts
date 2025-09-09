/**
 * SQLite Tool Wrapper
 * Provides strongly-typed access to SQLite operations through Tauri commands
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauriAvailable } from "./platform";

export interface ProbeRecord {
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
  deep_ready: boolean;
}

export interface MemoryRecord {
  key: string;
  value: string;
  updated_at: number;
}

/**
 * Probe cache operations using Tauri commands
 */
export const probeCache = {
  /**
   * Check if a probe record exists and is current
   */
  async checkProbeCache(
    path: string,
    sizeBytes: number,
    mtimeNs: number
  ): Promise<ProbeRecord | null> {
    if (!isTauriAvailable()) {
      console.warn(
        "Probe cache operations not available in browser mode."
      );
      return null;
    }

    try {
      console.debug(`Checking probe cache for: ${path}`);

      const result = await invoke<ProbeRecord | null>("check_probe_cache", {
        path,
        sizeBytes,
        mtimeNs,
      });

      if (result) {
        console.debug(`Found cached probe for: ${path}`);
        return result;
      }

      console.debug(`No cached probe found for: ${path}`);
      return null;
    } catch (error) {
      console.error(`Failed to check probe cache for ${path}:`, error);
      return null;
    }
  },

  /**
   * Save probe result to cache
   */
  async saveProbeCache(
    record: Omit<ProbeRecord, "probed_at"> & { probed_at?: number }
  ): Promise<boolean> {
    if (!isTauriAvailable()) {
      console.warn("Probe cache operations not available in browser mode.");
      return false;
    }

    try {
      console.debug(`Saving probe cache for: ${record.path}`);

      const probed_at = record.probed_at || Math.floor(Date.now() / 1000);

      const fullRecord: ProbeRecord = {
        ...record,
        probed_at,
        deep_ready: record.deep_ready || false,
      };

      await invoke<void>("save_probe_cache", {
        record: fullRecord,
      });

      console.debug(`Successfully saved probe cache for: ${record.path}`);
      return true;
    } catch (error) {
      console.error(`Failed to save probe cache for ${record.path}:`, error);
      return false;
    }
  },

  /**
   * Get all cached probe records
   */
  async getAllProbeCache(): Promise<ProbeRecord[]> {
    if (!isTauriAvailable()) {
      console.warn("Probe cache operations not available in browser mode.");
      return [];
    }

    try {
      console.debug("Fetching all probe cache records");

      const records = await invoke<ProbeRecord[]>("get_all_probe_cache");

      console.debug(`Found ${records.length} cached probe records`);
      return records;
    } catch (error) {
      console.error("Failed to fetch all probe cache:", error);
      return [];
    }
  },
};

/**
 * Memory operations (placeholder - not implemented in Tauri yet)
 * These operations are for development/MCP only
 */
export const memory = {
  /**
   * Get a memory value by key
   */
  async get(_key: string): Promise<string | null> {
    console.warn("Memory operations not implemented in Tauri mode.");
    return null;
  },

  /**
   * Set a memory value
   */
  async set(_key: string, _value: string): Promise<boolean> {
    console.warn("Memory operations not implemented in Tauri mode.");
    return false;
  },

  /**
   * Get multiple memory values by keys
   */
  async getMultiple(_keys: string[]): Promise<Record<string, string>> {
    console.warn("Memory operations not implemented in Tauri mode.");
    return {};
  },
};
