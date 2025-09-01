// Execution utilities for running system commands and checking versions

import { isTauriAvailable } from "./platform";

/**
 * Check if Python is available and get version
 */
export async function pythonVersion(): Promise<string | null> {
  if (!isTauriAvailable()) {
    return null; // Not available in browser
  }
  
  try {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const command = Command.create("python", ["--version"]);
    const output = await command.execute();
    
    if (output.code === 0) {
      return output.stdout.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if ffmpeg is available and get version
 */
export async function ffmpegVersion(): Promise<string | null> {
  if (!isTauriAvailable()) {
    return null; // Not available in browser
  }
  
  try {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const command = Command.create("ffmpeg", ["-version"]);
    const output = await command.execute();
    
    if (output.code === 0) {
      // Extract version from first line
      const firstLine = output.stdout.split('\n')[0];
      const match = firstLine.match(/ffmpeg version ([^\s]+)/);
      return match ? match[1] : firstLine;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if ffprobe is available and get version  
 */
export async function ffprobeVersion(): Promise<string | null> {
  if (!isTauriAvailable()) {
    return null; // Not available in browser
  }
  
  try {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const command = Command.create("ffprobe", ["-version"]);
    const output = await command.execute();
    
    if (output.code === 0) {
      // Extract version from first line
      const firstLine = output.stdout.split('\n')[0];
      const match = firstLine.match(/ffprobe version ([^\s]+)/);
      return match ? match[1] : firstLine;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Run the Python worker with given arguments
 */
export async function runWorker(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  if (!isTauriAvailable()) {
    throw new Error("Worker is only available in desktop mode");
  }
  
  const { Command } = await import("@tauri-apps/plugin-shell");
  const command = Command.create("python", args);
  const output = await command.execute();
  
  return {
    code: output.code ?? -1,
    stdout: output.stdout ?? "",
    stderr: output.stderr ?? "",
  };
}