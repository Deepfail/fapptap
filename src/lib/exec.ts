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
 * Check if Python is available and get version
 */
export async function pythonVersion(): Promise<string | null> {
  if (!isTauriAvailable()) {
    return null; // Not available in browser
  }

  try {
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
 * Get FFmpeg version using sidecar binary
 */
export async function ffmpegVersion(): Promise<CommandResult> {
  if (!isTauriAvailable()) {
    throw new Error("FFmpeg version check is only available in desktop mode");
  }

  try {
    const command = Command.sidecar("binaries/ffmpeg", ["-version"]);
    const result = await command.execute();
    if (result.code !== 0) {
      console.error("FFmpeg sidecar non-zero exit", result);
    }
    return {
      code: result.code ?? -1,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    console.error("FFmpeg version retrieval failed", error);
    throw new Error(`Failed to get FFmpeg version: ${error}`);
  }
}

/**
 * Get FFprobe version using sidecar binary
 */
export async function ffprobeVersion(): Promise<CommandResult> {
  if (!isTauriAvailable()) {
    throw new Error("FFprobe version check is only available in desktop mode");
  }

  try {
    const command = Command.sidecar("binaries/ffprobe", ["-version"]);
    const result = await command.execute();
    if (result.code !== 0) {
      console.error("FFprobe sidecar non-zero exit", result);
    }
    return {
      code: result.code ?? -1,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    console.error("FFprobe version retrieval failed", error);
    throw new Error(`Failed to get FFprobe version: ${error}`);
  }
}

/**
 * Run the Python worker with specified arguments using sidecar binary
 */
export async function runWorker(
  stage: string,
  args: Record<string, string | boolean> = {}
): Promise<CommandResult> {
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
  if (result.code !== 0) {
    console.error("Worker sidecar non-zero exit", { workerArgs, result });
  }

  return {
    code: result.code ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
