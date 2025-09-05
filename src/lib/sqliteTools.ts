/**
 * SQLite MCP Tool Wrapper
 * Provides strongly-typed access to SQLite operations through MCP tools
 */

import { logger } from "./logging";

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
  deep_ready: 0 | 1;
}

export interface MemoryRecord {
  key: string;
  value: string;
  updated_at: number;
}

// MCP tool function declarations for TypeScript
declare global {
  function mcp_sqlite_sqliteRead(params: { query: string }): Promise<{
    result: Array<{
      type: string;
      data: {
        columns: string[];
        rows: any[][];
        rowCount: number;
      };
    }>;
  }>;

  function mcp_sqlite_sqliteWrite(params: { query: string }): Promise<{
    result: Array<{
      type: string;
      data: {
        changes: number;
      };
    }>;
  }>;
}

/**
 * Probe cache operations using MCP SQLite tools
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
    if (typeof mcp_sqlite_sqliteRead !== "function") {
      logger.warn(
        "MCP SQLite tools not available. Skipping probe cache check."
      );
      return null;
    }
    try {
      logger.debug(`Checking probe cache for: ${path}`);

      const query = `
        SELECT * FROM media_probe 
        WHERE path = '${path.replace(/'/g, "''")}' 
          AND size_bytes = ${sizeBytes} 
          AND mtime_ns = ${mtimeNs}
      `;

      const result = await mcp_sqlite_sqliteRead({ query });

      if (result?.result?.[0]?.data?.rows?.length > 0) {
        const row = result.result[0].data.rows[0];
        const columns = result.result[0].data.columns;

        // Convert row array to object
        const record: any = {};
        columns.forEach((col: string, idx: number) => {
          record[col] = row[idx];
        });

        logger.debug(`Found cached probe for: ${path}`);
        return record as ProbeRecord;
      }

      logger.debug(`No cached probe found for: ${path}`);
      return null;
    } catch (error) {
      logger.error(`Failed to check probe cache for ${path}:`, error);
      return null;
    }
  },

  /**
   * Save probe result to cache
   */
  async saveProbeCache(
    record: Omit<ProbeRecord, "probed_at"> & { probed_at?: number }
  ): Promise<boolean> {
    if (typeof mcp_sqlite_sqliteWrite !== "function") {
      logger.warn("MCP SQLite tools not available. Skipping probe cache save.");
      return false;
    }
    try {
      logger.debug(`Saving probe cache for: ${record.path}`);

      const probed_at = record.probed_at || Math.floor(Date.now() / 1000);

      const query = `
        INSERT OR REPLACE INTO media_probe (
          path, size_bytes, mtime_ns, probed_at, duration_sec, video_codec, audio_codec,
          width, height, fps_num, fps_den, sample_rate, channels, json_path, deep_ready
        ) VALUES (
          '${record.path.replace(/'/g, "''")}',
          ${record.size_bytes},
          ${record.mtime_ns},
          ${probed_at},
          ${record.duration_sec || "NULL"},
          ${
            record.video_codec
              ? `'${record.video_codec.replace(/'/g, "''")}'`
              : "NULL"
          },
          ${
            record.audio_codec
              ? `'${record.audio_codec.replace(/'/g, "''")}'`
              : "NULL"
          },
          ${record.width || "NULL"},
          ${record.height || "NULL"},
          ${record.fps_num || "NULL"},
          ${record.fps_den || "NULL"},
          ${record.sample_rate || "NULL"},
          ${record.channels || "NULL"},
          ${
            record.json_path
              ? `'${record.json_path.replace(/'/g, "''")}'`
              : "NULL"
          },
          ${record.deep_ready}
        )
      `;

      const result = await mcp_sqlite_sqliteWrite({ query });

      if (result?.result?.[0]?.data?.changes > 0) {
        logger.debug(`Successfully saved probe cache for: ${record.path}`);
        return true;
      } else {
        logger.warn(
          `No changes made when saving probe cache for: ${record.path}`
        );
        return false;
      }
    } catch (error) {
      logger.error(`Failed to save probe cache for ${record.path}:`, error);
      return false;
    }
  },

  /**
   * Get all cached probe records
   */
  async getAllProbeCache(): Promise<ProbeRecord[]> {
    if (typeof mcp_sqlite_sqliteRead !== "function") {
      logger.warn(
        "MCP SQLite tools not available. Skipping getting all probe cache."
      );
      return [];
    }
    try {
      logger.debug("Fetching all probe cache records");

      const query = "SELECT * FROM media_probe ORDER BY probed_at DESC";

      const result = await mcp_sqlite_sqliteRead({ query });

      if (result?.result?.[0]?.data?.rows) {
        const rows = result.result[0].data.rows;
        const columns = result.result[0].data.columns;

        const records: ProbeRecord[] = rows.map((row: any[]) => {
          const record: any = {};
          columns.forEach((col: string, idx: number) => {
            record[col] = row[idx];
          });
          return record as ProbeRecord;
        });

        logger.debug(`Found ${records.length} cached probe records`);
        return records;
      }

      return [];
    } catch (error) {
      logger.error("Failed to fetch all probe cache:", error);
      return [];
    }
  },
};

/**
 * Memory operations using MCP SQLite tools
 */
export const memory = {
  /**
   * Get a memory value by key
   */
  async get(key: string): Promise<string | null> {
    if (typeof mcp_sqlite_sqliteRead !== "function") {
      logger.warn("MCP SQLite tools not available. Skipping memory get.");
      return null;
    }
    try {
      const query = `SELECT value FROM memory WHERE key = '${key.replace(
        /'/g,
        "''"
      )}'`;

      const result = await mcp_sqlite_sqliteRead({ query });

      if (result?.result?.[0]?.data?.rows?.length > 0) {
        return result.result[0].data.rows[0][0];
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get memory key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set a memory value
   */
  async set(key: string, value: string): Promise<boolean> {
    if (typeof mcp_sqlite_sqliteWrite !== "function") {
      logger.warn("MCP SQLite tools not available. Skipping memory set.");
      return false;
    }
    try {
      const query = `
        INSERT OR REPLACE INTO memory (key, value, updated_at)
        VALUES ('${key.replace(/'/g, "''")}', '${value.replace(
        /'/g,
        "''"
      )}', ${Math.floor(Date.now() / 1000)})
      `;

      const result = await mcp_sqlite_sqliteWrite({ query });

      return result?.result?.[0]?.data?.changes > 0;
    } catch (error) {
      logger.error(`Failed to set memory key ${key}:`, error);
      return false;
    }
  },

  /**
   * Get multiple memory values by keys
   */
  async getMultiple(keys: string[]): Promise<Record<string, string>> {
    if (typeof mcp_sqlite_sqliteRead !== "function") {
      logger.warn(
        "MCP SQLite tools not available. Skipping memory getMultiple."
      );
      return {};
    }
    try {
      const keyList = keys.map((k) => `'${k.replace(/'/g, "''")}'`).join(",");
      const query = `SELECT key, value FROM memory WHERE key IN (${keyList})`;

      const result = await mcp_sqlite_sqliteRead({ query });

      const records: Record<string, string> = {};

      if (result?.result?.[0]?.data?.rows) {
        result.result[0].data.rows.forEach((row: any[]) => {
          records[row[0]] = row[1];
        });
      }

      return records;
    } catch (error) {
      logger.error(`Failed to get multiple memory keys:`, error);
      return {};
    }
  },
};
