/**
 * Execution utilities for running external commands via Tauri
 */
import { Command } from "@tauri-apps/plugin-shell";
import { isTauriAvailable } from "./platform";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run the Python worker with specified arguments
 */
export async function runWorker(stage: string, args: Record<string, string | boolean> = {}): Promise<CommandResult> {
  if (!isTauriAvailable()) {
    throw new Error("Worker execution is only available in desktop mode");
  }

  const workerArgs = [stage];
  
  // Add arguments
  for (const [key, value] of Object.entries(args)) {
    if (value === true) {
      // Boolean true becomes a flag
      workerArgs.push(`--${key}`);
    } else if (value && typeof value === "string") {
      // String values get added with their value
      workerArgs.push(`--${key}`, value);
    }
  }

  console.log("Running worker with args:", workerArgs);

  const command = Command.sidecar("binaries/worker", workerArgs);
  const result = await command.execute();
  
  return {
    code: result.code ?? -1,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

/**
 * Get FFmpeg version
 */
export async function ffmpegVersion(): Promise<string> {
  if (!isTauriAvailable()) {
    throw new Error("FFmpeg version check is only available in desktop mode");
  }

  try {
    const command = Command.sidecar("binaries/ffmpeg", ["-version"]);
    const result = await command.execute();
    
    if (result.code === 0) {
      // Extract version from output (first line usually contains version info)
      const firstLine = result.stdout.split('\n')[0];
      return firstLine || "Unknown version";
    } else {
      throw new Error(`FFmpeg version check failed: ${result.stderr}`);
    }
  } catch (error) {
    throw new Error(`Failed to get FFmpeg version: ${error}`);
  }
}

/**
 * Get FFprobe version
 */
export async function ffprobeVersion(): Promise<string> {
  if (!isTauriAvailable()) {
    throw new Error("FFprobe version check is only available in desktop mode");
  }

  try {
    const command = Command.sidecar("binaries/ffprobe", ["-version"]);
    const result = await command.execute();
    
    if (result.code === 0) {
      // Extract version from output (first line usually contains version info)  
      const firstLine = result.stdout.split('\n')[0];
      return firstLine || "Unknown version";
    } else {
      throw new Error(`FFprobe version check failed: ${result.stderr}`);
    }
  } catch (error) {
    throw new Error(`Failed to get FFprobe version: ${error}`);
  }
}