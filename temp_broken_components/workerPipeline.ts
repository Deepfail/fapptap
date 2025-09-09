/**
 * Direct Python worker pipeline integration for UnifiedApp
 * This bypasses the complex TypeScript timeline generator and calls the Python worker directly
 */

import { isTauriAvailable } from "@/lib/platform";
import { PythonWorker } from "@/lib/worker";

export interface WorkerPipelineOptions {
  audioPath: string;
  clipPaths: string[];
  preset?: string;
  cuttingMode?: string;
  enableShotDetection?: boolean;
}

export interface PipelineResult {
  success: boolean;
  message: string;
  cutlistPath?: string;
  renderPath?: string;
}

/**
 * Run the full Python worker pipeline: beats -> cutlist -> render
 */
export async function runWorkerPipeline(options: WorkerPipelineOptions): Promise<PipelineResult> {
  if (!isTauriAvailable()) {
    throw new Error("Worker pipeline requires Tauri (desktop mode)");
  }

  const { 
    audioPath, 
    clipPaths, 
    preset = "landscape", 
    cuttingMode = "medium", 
    enableShotDetection = false 
  } = options;

  try {
    // Import Tauri file system APIs
    const { mkdir, copyFile, remove } = await import("@tauri-apps/plugin-fs");
    const { appDataDir } = await import("@tauri-apps/api/path");
    
    // Create temporary clips directory in app data
    const appDir = await appDataDir();
    const tempClipsDir = `${appDir}temp_clips_${Date.now()}`;
    await mkdir(tempClipsDir, { recursive: true });

    try {
      // Copy selected clips to temp directory
      console.log(`Copying ${clipPaths.length} clips to ${tempClipsDir}`);
      for (let i = 0; i < clipPaths.length; i++) {
        const clipPath = clipPaths[i];
        const fileName = clipPath.split(/[\\\/]/).pop() || `clip_${i}.mp4`;
        const destPath = `${tempClipsDir}/${fileName}`;
        await copyFile(clipPath, destPath);
        console.log(`Copied: ${clipPath} -> ${destPath}`);
      }

      const worker = new PythonWorker();

      // Step 1: Analyze beats
      console.log("Running beats analysis...");
      await worker.runStage("beats", {
        song: audioPath,
        engine: "advanced"
      });

      // Step 2: Generate cutlist
      console.log("Generating cutlist...");
      await worker.runStage("cutlist", {
        song: audioPath,
        clips: tempClipsDir,
        preset: preset,
        cutting_mode: cuttingMode,
        enable_shot_detection: enableShotDetection
      });

      // Step 3: Render final video
      console.log("Rendering final video...");
      await worker.runStage("render", {});

      // Clean up temp directory
      try {
        await remove(tempClipsDir, { recursive: true });
      } catch (cleanupError) {
        console.warn("Failed to clean up temp directory:", cleanupError);
      }

      return {
        success: true,
        message: "Pipeline completed successfully",
        cutlistPath: "cache/cutlist.json",
        renderPath: "render/fapptap_final.mp4"
      };

    } catch (error) {
      // Clean up temp directory on error
      try {
        await remove(tempClipsDir, { recursive: true });
      } catch (cleanupError) {
        console.warn("Failed to clean up temp directory after error:", cleanupError);
      }
      throw error;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Worker pipeline failed:", errorMessage);
    return {
      success: false,
      message: `Pipeline failed: ${errorMessage}`
    };
  }
}

/**
 * Run FFplay preview with the current cutlist
 */
export async function runFfplayPreview(): Promise<PipelineResult> {
  if (!isTauriAvailable()) {
    throw new Error("FFplay preview requires Tauri (desktop mode)");
  }

  try {
    // Check if cutlist exists
    const { exists } = await import("@tauri-apps/plugin-fs");
    if (!await exists("cache/cutlist.json")) {
      return {
        success: false,
        message: "No cutlist found. Please generate timeline first."
      };
    }

    // Import ffplay preview functionality
    const { startFfplayPreview } = await import("@/preview/ffplayPreview");
    
    // Create a minimal timeline object for ffplay
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const cutlistContent = await readTextFile("cache/cutlist.json");
    const cutlist = JSON.parse(cutlistContent);

    // Convert cutlist to timeline format expected by ffplayPreview
    const timeline = {
      fps: 30,
      previewScale: 0.5,
      globalTempo: 1.0,
      noCutZones: [],
      clips: cutlist.map((clip: any, index: number) => ({
        id: `clip_${index}`,
        videoPath: clip.file || clip.path || clip.video_file,
        start: clip.start_time || clip.start || 0,
        duration: clip.duration || 1.0,
        effects: []
      }))
    };

    await startFfplayPreview(timeline);

    return {
      success: true,
      message: "FFplay preview started"
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("FFplay preview failed:", errorMessage);
    return {
      success: false,
      message: `Preview failed: ${errorMessage}`
    };
  }
}