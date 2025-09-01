// Python worker interface for running media processing stages
import { isTauriAvailable } from "./platform";

export interface WorkerMessage {
  stage: string;
  progress?: number;
  message?: string;
  error?: string;
  out_time_ms?: number;
  speed?: string;
  exit_code?: number;
  [key: string]: any;
}

export interface StageArgs {
  song?: string;
  clips?: string;
  proxy?: boolean;
  engine?: "basic" | "advanced";
}

/**
 * Python worker wrapper for running media processing stages
 */
export class PythonWorker {
  private currentCommand: any = null;

  /**
   * Run a processing stage (beats, shots, cutlist, render)
   */
  async runStage(
    stage: string,
    args: StageArgs,
    onProgress?: (message: WorkerMessage) => void
  ): Promise<void> {
    if (!isTauriAvailable()) {
      throw new Error("Worker is only available in desktop mode");
    }

    const { Command } = await import("@tauri-apps/plugin-shell");

    // Build command arguments
    const cmdArgs = ["worker/main.py", stage];
    
    if (args.song) {
      cmdArgs.push("--song", args.song);
    }
    if (args.clips) {
      cmdArgs.push("--clips", args.clips);
    }
    if (args.proxy) {
      cmdArgs.push("--proxy");
    }

    // Create and store command for potential cancellation
    this.currentCommand = Command.create("python", cmdArgs);

    return new Promise((resolve, reject) => {
      let hasEnded = false;

      // Handle stdout data (JSON messages)
      this.currentCommand.on("data", (data: any) => {
        const output = typeof data === "string" ? data : data.stdout ?? "";
        
        for (const line of output.split(/\r?\n/)) {
          if (!line.trim()) continue;
          
          try {
            const message: WorkerMessage = JSON.parse(line);
            onProgress?.(message);
            
            // Check for completion or error
            if (message.progress === 1.0 || message.exit_code !== undefined) {
              if (message.exit_code === 0 || message.progress === 1.0) {
                if (!hasEnded) {
                  hasEnded = true;
                  resolve();
                }
              } else if (message.exit_code !== 0) {
                if (!hasEnded) {
                  hasEnded = true;
                  reject(new Error(`Stage ${stage} failed with exit code ${message.exit_code}`));
                }
              }
            }
            
            if (message.error) {
              if (!hasEnded) {
                hasEnded = true;
                reject(new Error(message.error));
              }
            }
          } catch (error) {
            // Not JSON, ignore non-JSON output
            console.debug("Non-JSON output:", line);
          }
        }
      });

      // Handle errors
      this.currentCommand.on("error", (error: any) => {
        if (!hasEnded) {
          hasEnded = true;
          reject(new Error(`Command failed: ${error}`));
        }
      });

      // Execute the command
      this.currentCommand.execute().then(() => {
        this.currentCommand = null;
        if (!hasEnded) {
          hasEnded = true;
          resolve();
        }
      }).catch((error: any) => {
        this.currentCommand = null;
        if (!hasEnded) {
          hasEnded = true;
          reject(error);
        }
      });
    });
  }

  /**
   * Cancel the currently running stage
   */
  async cancel(): Promise<void> {
    if (this.currentCommand) {
      try {
        await this.currentCommand.kill();
      } catch (error) {
        console.warn("Failed to kill command:", error);
      } finally {
        this.currentCommand = null;
      }
    }
  }

  /**
   * Check if a stage is currently running
   */
  isRunning(): boolean {
    return this.currentCommand !== null;
  }
}

// Browser fallback functions (for development)

/**
 * Mock file selection for browser development
 */
export async function selectSong(): Promise<string | null> {
  if (isTauriAvailable()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      title: "Select Audio File",
      filters: [
        {
          name: "Audio Files",
          extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg"],
        },
      ],
    });
    return result as string | null;
  }

  // Browser fallback - file input
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        resolve(url);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Mock directory selection for browser development
 */
export async function selectClipsDirectory(): Promise<string | null> {
  if (isTauriAvailable()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      title: "Select Clips Directory",
      directory: true,
    });
    return result as string | null;
  }

  // Browser fallback - multiple file input
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        // Return a mock directory path
        resolve("browser://clips");
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Read file contents (with browser fallback)
 */
export async function readFile(path: string): Promise<string> {
  if (isTauriAvailable()) {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return await readTextFile(path);
  }

  // Browser fallback for blob URLs
  if (path.startsWith("blob:")) {
    const response = await fetch(path);
    return await response.text();
  }

  throw new Error("File reading not supported in browser mode");
}