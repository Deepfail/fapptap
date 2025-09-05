// Preflight diagnostics for Tauri environment, sidecars, and asset protocol
// Lightweight: runs once at startup. Keep console noise minimal unless problems.

import { isTauri } from "./platform"; // assumes platform.ts exists per knowledge base

async function checkSidecar(name: string, args: string[] = ["--version"]) {
  try {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const output = await Command.sidecar(name, args).execute();
    return { ok: true, stdout: output.stdout.split("\n")[0] };
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) };
  }
}

async function verifyAssetProtocol() {
  try {
    // Test with a simple path instead of using process.platform
    const testPath = "C:/";
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    const url = convertFileSrc(testPath);
    const usesAsset =
      url.startsWith("asset://localhost/") ||
      url.startsWith("http://asset.localhost/");
    return { ok: usesAsset, sample: url };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function runPreflight() {
  if (!isTauri()) {
    console.info("[preflight] Non-Tauri environment; skipping sidecar tests.");
    return;
  }
  console.time("[preflight] total");

  // Use a small timeout to allow the environment variables to be injected
  await new Promise((resolve) => setTimeout(resolve, 100));

  const platform = (import.meta as any).env?.TAURI_ENV_PLATFORM;
  const target = (import.meta as any).env?.TAURI_ENV_TARGET_TRIPLE;
  console.info(`[preflight] Platform=${platform} Target=${target}`);

  const [worker, ffmpeg, ffprobe, asset] = await Promise.all([
    checkSidecar("binaries/worker", ["--help"]),
    checkSidecar("binaries/ffmpegbin"),
    checkSidecar("binaries/ffprobebin"),
    verifyAssetProtocol(),
  ]);

  const summary = {
    worker,
    ffmpeg,
    ffprobe,
    assetProtocol: asset,
  } as const;

  const problems = Object.entries(summary).filter(([, v]) => !(v as any).ok);
  if (problems.length === 0) {
    console.info("[preflight] All sidecars & asset protocol OK.");
  } else {
    console.warn("[preflight] Issues detected:");
    for (const [k, v] of problems) console.warn(` - ${k}:`, v);
  }
  console.timeEnd("[preflight] total");
}

// Auto-run (can be made opt-in later via env flag)
runPreflight().catch((e) => console.error("[preflight] Unexpected failure", e));
