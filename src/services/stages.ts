// services/stages.ts
import { PythonWorker } from "../lib/worker";
import { isTauriAvailable } from "../lib/platform";

/**
 * Run beats detection stage
 */
export async function runBeatsStage(audioPath: string, engine: "basic" | "advanced" = "advanced"): Promise<void> {
  if (!isTauriAvailable()) {
    throw new Error("Worker stages require desktop mode");
  }

  const worker = new PythonWorker();
  return worker.runStage("beats", {
    song: audioPath,
    engine,
  });
}

/**
 * Run shot detection stage
 */
export async function runShotsStage(clipsDir: string): Promise<void> {
  if (!isTauriAvailable()) {
    throw new Error("Worker stages require desktop mode");
  }

  const worker = new PythonWorker();
  return worker.runStage("shots", {
    clips: clipsDir,
  });
}

/**
 * Run cutlist generation stage
 */
export async function runCutlistStage(
  audioPath: string,
  clipsDir: string,
  style: string = "landscape",
  cuttingMode: string = "medium",
  enableShotDetection: boolean = true
): Promise<void> {
  if (!isTauriAvailable()) {
    throw new Error("Worker stages require desktop mode");
  }

  const worker = new PythonWorker();
  return worker.runStage("cutlist", {
    song: audioPath,
    clips: clipsDir,
    preset: style,
    cutting_mode: cuttingMode,
    enable_shot_detection: enableShotDetection,
  });
}

/**
 * Run render stage
 */
export async function runRenderStage(proxy: boolean = true, preset: string = "landscape"): Promise<void> {
  if (!isTauriAvailable()) {
    throw new Error("Worker stages require desktop mode");
  }

  const worker = new PythonWorker();
  return worker.runStage("render", {
    proxy,
    preset,
  });
}

/**
 * Create a configured worker for listening to events
 */
export function createWorker(): PythonWorker {
  return new PythonWorker();
}