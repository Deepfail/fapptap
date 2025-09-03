/**
 * Python Worker integration for Tauri and browser environments
 */
import { Command } from "@tauri-apps/plugin-shell";
import { isTauriAvailable } from "./platform";

export interface WorkerMessage {
  stage: string;
  progress?: number;
  message?: string;
  error?: string;
  [key: string]: any;
}

export type WorkerEventHandler = (message: WorkerMessage) => void;

/**
 * PythonWorker class for managing Python worker processes
 */
export class PythonWorker {
  private currentCommand: Command<string> | null = null;
  private eventHandlers: Map<string, WorkerEventHandler[]> = new Map();

  /**
   * Add event listener for worker messages
   */
  on(event: string, handler: WorkerEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: WorkerEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: string, message: WorkerMessage): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach((handler) => handler(message));
  }

  /**
   * Run a worker stage
   */
  async runStage(
    stage: string,
    args: Record<string, string | boolean> = {}
  ): Promise<void> {
    if (!isTauriAvailable()) {
      throw new Error(
        "Python worker execution is only available in desktop mode"
      );
    }

    // Build command arguments
    const workerArgs = [stage];
    for (const [key, value] of Object.entries(args)) {
      if (value === true) {
        // Boolean true becomes a flag
        workerArgs.push(`--${key}`);
      } else if (value && typeof value === "string") {
        // String values get added with their value
        workerArgs.push(`--${key}`, value);
      }
    }

    console.log(`Running worker stage: ${stage} with args:`, workerArgs);
    console.log("Raw args object:", args);

    this.currentCommand = Command.sidecar("binaries/worker", workerArgs);

    return new Promise((resolve, reject) => {
      if (!this.currentCommand) {
        reject(new Error("No command to execute"));
        return;
      }

      this.currentCommand.on("close", (data: any) => {
        console.log(`Worker stage ${stage} completed with code:`, data.code);
        if (data.code === 0) {
          resolve();
        } else {
          const error = `Worker stage ${stage} failed with exit code ${data.code}`;
          this.emit("error", { stage, error });
          reject(new Error(error));
        }
        this.currentCommand = null;
      });

      this.currentCommand.on("error", (error: any) => {
        console.error(`Worker stage ${stage} error:`, error);
        this.emit("error", { stage, error: error.toString() });
        reject(new Error(`Worker stage ${stage} error: ${error}`));
        this.currentCommand = null;
      });

      // Handle stdout for progress messages (JSONL format)
      this.currentCommand.stdout.on("data", (data: any) => {
        try {
          // Use TextDecoder for browser compatibility (no Buffer API)
          const decoder = new TextDecoder("utf-8", { fatal: false });
          let text: string;

          if (data instanceof Uint8Array) {
            text = decoder.decode(data);
          } else if (typeof data === "string") {
            text = data;
          } else {
            // Try to convert to string safely
            text = String(data);
          }

          const lines = text.split("\n").filter((line: string) => line.trim());

          for (const line of lines) {
            try {
              const message = JSON.parse(line) as WorkerMessage;
              console.log(`Worker message:`, message);

              // Emit specific stage events
              this.emit(message.stage, message);
              this.emit("message", message);

              // Handle progress updates
              if (message.progress !== undefined) {
                this.emit("progress", message);
              }

              // Handle errors
              if (message.error) {
                this.emit("error", message);
              }
            } catch (e) {
              // Not JSON, treat as regular output
              console.log(`Worker output: ${line}`);
            }
          }
        } catch (e) {
          // Handle UTF-8 decode errors gracefully
          console.warn(`Worker stdout decode error:`, e);
        }
      });

      // Handle stderr
      this.currentCommand.stderr.on("data", (data: any) => {
        try {
          // Use TextDecoder for browser compatibility (no Buffer API)
          const decoder = new TextDecoder("utf-8", { fatal: false });
          let text: string;

          if (data instanceof Uint8Array) {
            text = decoder.decode(data);
          } else if (typeof data === "string") {
            text = data;
          } else {
            // Try to convert to string safely
            text = String(data);
          }

          console.warn(`Worker stderr: ${text}`);
        } catch (e) {
          // Handle UTF-8 decode errors gracefully
          console.warn(`Worker stderr decode error:`, e);
        }
      });

      // Start the command
      this.currentCommand.spawn().catch((error: any) => {
        console.error(`Failed to spawn worker:`, error);
        this.emit("error", { stage, error: error.toString() });
        reject(new Error(`Failed to spawn worker: ${error}`));
        this.currentCommand = null;
      });
    });
  }

  /**
   * Cancel the current worker process
   */
  async cancel(): Promise<void> {
    if (this.currentCommand) {
      try {
        // @ts-ignore - kill method may not be properly typed
        await this.currentCommand.kill();
        this.currentCommand = null;
        console.log("Worker process cancelled");
      } catch (error) {
        console.error("Failed to cancel worker process:", error);
        throw error;
      }
    }
  }

  /**
   * Check if worker is currently running
   */
  isRunning(): boolean {
    return this.currentCommand !== null;
  }
}

// Export a default instance
export const pythonWorker = new PythonWorker();
