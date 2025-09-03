/**
 * Execution utilities for running external commands via Tauri
 *
 * Reference: TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md - Sidecar Binary Configuration
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
    const command = Command.sidecar("binaries/ffmpegbin", ["-version"]);
    const result = await command.execute();
    if (result.code !== 0) {
      const lines = result.stderr.split(/\r?\n/);
      console.error("FFmpeg sidecar non-zero exit", {
        code: result.code,
        firstLines: lines.slice(0, 8),
        totalLines: lines.length,
      });
      console.log("FFmpeg stderr:", result.stderr);
    } else if (!/^ffmpeg version /i.test(result.stdout)) {
      console.warn(
        "FFmpeg output did not match expected version signature",
        result.stdout.split(/\r?\n/)[0]
      );
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
    const command = Command.sidecar("binaries/ffprobebin", ["-version"]);
    const result = await command.execute();
    if (result.code !== 0) {
      const lines = result.stderr.split(/\r?\n/);
      console.error("FFprobe sidecar non-zero exit", {
        code: result.code,
        firstLines: lines.slice(0, 8),
        totalLines: lines.length,
      });
      console.log("FFprobe stderr:", result.stderr);
    } else if (!/^ffprobe version /i.test(result.stdout)) {
      console.warn(
        "FFprobe output did not match expected version signature",
        result.stdout.split(/\r?\n/)[0]
      );
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

// Global reference to current running command for cancellation
let currentWorkerCommand: Command<string> | null = null;

/**
 * Run the Python worker with specified arguments using sidecar binary
 * 
 * @param stage - The worker stage to run (beats, shots, cutlist, render)
 * @param args - Arguments to pass to the worker
 * @param onProgress - Callback for real-time JSON progress updates
 * @param onLine - Optional callback for raw output lines
 * @returns Promise that resolves when worker completes
 */
export async function runWorker(
  stage: string,
  args: Record<string, string | boolean> = {},
  onProgress?: (data: any) => void,
  onLine?: (line: string) => void
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
  currentWorkerCommand = command;

  try {
    if (onProgress || onLine) {
      // Handle real-time streaming output using event listeners
      let allStdout = "";
      let allStderr = "";

      return new Promise<CommandResult>((resolve, reject) => {
        // Set up event listeners for streaming
        command.on("close", (data) => {
          console.log("Worker process closed with code:", data.code);
          resolve({
            code: data.code ?? -1,
            stdout: allStdout,
            stderr: allStderr,
          });
        });

        command.on("error", (error) => {
          console.error("Worker process error:", error);
          reject(new Error(`Worker process error: ${error}`));
        });

        // Handle stdout streaming with JSONL parsing
        command.stdout.on("data", (data) => {
          const textData = String(data);
          allStdout += textData;
          
          // Process each line for JSONL format
          const lines = textData.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            onLine?.(line);
            
            // Try to parse as JSON for progress updates
            if (onProgress) {
              try {
                const progressData = JSON.parse(line);
                onProgress(progressData);
              } catch {
                // Not JSON, ignore silently
              }
            }
          }
        });

        // Handle stderr streaming
        command.stderr.on("data", (data) => {
          const textData = String(data);
          allStderr += textData;
          console.warn("Worker stderr:", textData);
        });

        // Start the streaming process
        command.spawn().catch(reject);
      });
    } else {
      // Execute without streaming (legacy mode)
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
  } finally {
    currentWorkerCommand = null;
  }
}

/**
 * Cancel the currently running worker process
 */
export async function cancelWorker(): Promise<void> {
  if (currentWorkerCommand) {
    try {
      // @ts-ignore - kill method may not be properly typed in Tauri v2
      await currentWorkerCommand.kill();
      console.log("Worker process cancelled");
      currentWorkerCommand = null;
    } catch (error) {
      console.error("Failed to cancel worker process:", error);
    }
  }
}
