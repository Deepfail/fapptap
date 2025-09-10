import { Command } from "@tauri-apps/plugin-shell";

export async function runStage(
  stage: "beats" | "cutlist" | "render",
  args: any
): Promise<void> {
  console.log(`=== STAGE START: ${stage} ===`);
  console.log(`Stage args:`, JSON.stringify(args, null, 2));

  const startTime = Date.now();

  // Pre-flight check - verify we can create sidecar commands
  try {
    Command.sidecar("binaries/worker", ["--help"]);
    console.log(`✓ Sidecar command created successfully for stage: ${stage}`);
  } catch (error) {
    console.error(`✗ Failed to create sidecar command:`, error);
    throw new Error(`Worker binary not available: ${error}`);
  }

  try {
    switch (stage) {
      case "beats":
        await invokeWorker("beats", {
          song: args.audio, // worker expects --song, not --audio
          // No --out needed - beats writes to cache/beats.json internally
        });
        break;
      case "cutlist":
        await invokeWorker("cutlist", {
          song: args.song,
          clips: args.clips,
          preset: args.preset || "landscape",
          cutting_mode: args.cutting_mode || "medium",
          enable_shot_detection: args.enable_shot_detection,
          // No --out needed - cutlist writes to cache/cutlist.json internally
        });
        break;
      case "render":
        await invokeWorker("render", { proxy: !!args.proxy });
        break;
    }

    const duration = Date.now() - startTime;
    console.log(`=== STAGE SUCCESS: ${stage} (${duration}ms) ===`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`=== STAGE FAILED: ${stage} (${duration}ms) ===`);
    console.error("Stage error:", error);
    throw error;
  }
}

async function invokeWorker(
  stage: string,
  args: Record<string, any>
): Promise<void> {
  console.log(`--- Worker Invocation: ${stage} ---`);

  // Helper function to normalize Windows paths for Python/ffmpeg
  const normalizePath = (path: string) => path.replace(/\\/g, "/");

  const workerArgs = [stage];

  // Build arguments based on stage
  switch (stage) {
    case "beats":
      if (args.song) {
        workerArgs.push("--song", normalizePath(args.song));
      }
      break;

    case "cutlist":
      if (args.song) workerArgs.push("--song", normalizePath(args.song));
      if (args.clips) workerArgs.push("--clips", normalizePath(args.clips));
      if (args.preset) workerArgs.push("--preset", args.preset);
      if (args.cutting_mode)
        workerArgs.push("--cutting_mode", args.cutting_mode);
      if (args.engine) workerArgs.push("--engine", args.engine);
      if (args.enable_shot_detection)
        workerArgs.push("--enable_shot_detection");
      if (args.min_clip_length)
        workerArgs.push("--min_clip_length", String(args.min_clip_length));
      if (args.max_clip_length)
        workerArgs.push("--max_clip_length", String(args.max_clip_length));
      if (args.min_beats)
        workerArgs.push("--min_beats", String(args.min_beats));
      if (args.crossfade_duration)
        workerArgs.push(
          "--crossfade_duration",
          String(args.crossfade_duration)
        );
      if (args.prefer_downbeats) workerArgs.push("--prefer_downbeats");
      if (args.respect_shot_boundaries)
        workerArgs.push("--respect_shot_boundaries");
      if (args.energy_threshold)
        workerArgs.push("--energy_threshold", String(args.energy_threshold));
      // DO NOT pass --style or --out - main.py doesn't accept them
      break;

    case "render":
      if (args.proxy) workerArgs.push("--proxy");
      if (args.preset) workerArgs.push("--preset", args.preset);
      break;

    default:
      // Fallback for other stages - add arguments as --key value pairs
      for (const [key, value] of Object.entries(args)) {
        if (key === "proxy" && value === true) {
          workerArgs.push("--proxy");
        } else if (value !== undefined && value !== null) {
          workerArgs.push(`--${key}`, String(value));
        }
      }
  }

  console.log(`Worker command: binaries/worker ${workerArgs.join(" ")}`);
  console.log(`Worker args array:`, workerArgs);

  const startTime = Date.now();

  try {
    console.log(`Creating sidecar command...`);
    const command = Command.sidecar("binaries/worker", workerArgs);

    console.log(`Executing worker command...`);
    const output = await command.execute();

    const duration = Date.now() - startTime;
    console.log(`Worker ${stage} execution completed (${duration}ms)`);
    console.log(`Exit code: ${output.code}`);

    if (output.stdout) {
      console.log(`Worker stdout:`, output.stdout);
    }
    if (output.stderr) {
      console.warn(`Worker stderr:`, output.stderr);
    }

    if (output.code !== 0) {
      const errorMessage = `Worker ${stage} failed with exit code ${output.code}. stderr: ${output.stderr}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    console.log(`✓ Worker ${stage} completed successfully`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`✗ Worker ${stage} failed after ${duration}ms:`, error);

    // Check if it's a command creation error vs execution error
    if (error?.toString().includes("sidecar")) {
      throw new Error(
        `Worker binary not available or not configured properly: ${error}`
      );
    } else {
      throw new Error(`Worker ${stage} execution failed: ${error}`);
    }
  }
}
