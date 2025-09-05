// src/lib/logging.ts
import { attachConsole } from "@tauri-apps/plugin-log";
import { isTauri } from "./platform";

let consoleAttached = false;

/**
 * Initialize logging for the application
 * In development mode, attaches console output to Tauri logs
 */
export async function initializeLogging(): Promise<void> {
  if (!isTauri()) {
    console.log("Browser mode: Logging will use standard console");
    return;
  }

  try {
    // Only attach console in development mode
    if (import.meta.env.DEV && !consoleAttached) {
      await attachConsole();
      consoleAttached = true;
      console.log("✅ Console attached to Tauri logs");
    }
  } catch (error) {
    console.warn("Failed to attach console:", error);
  }
}

/**
 * Enhanced logging with Tauri log levels
 */
export const logger = {
  info: (message: string, ...args: any[]) => {
    console.info(`[INFO] ${message}`, ...args);
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },

  debug: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  trace: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) {
      console.trace(`[TRACE] ${message}`, ...args);
    }
  },
};

/**
 * Log sidecar process output
 */
export function logSidecarOutput(
  command: string,
  stdout: string,
  stderr: string
): void {
  if (stdout) {
    logger.info(`Sidecar [${command}] stdout:`, stdout.trim());
  }
  if (stderr) {
    logger.warn(`Sidecar [${command}] stderr:`, stderr.trim());
  }
}
