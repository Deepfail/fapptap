import { join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { runStage } from "./stages";

export async function getProxyPath(sessionRoot: string): Promise<string> {
  return await join(sessionRoot, "render", "fapptap_proxy.mp4");
}

export async function createQuickPreview(
  sessionRoot: string,
  videoEl: HTMLVideoElement,
  originalVideos: any[]
): Promise<void> {
  console.log(`[preview] Creating quick preview placeholder`);
  
  // Show the first selected video immediately as a placeholder
  const firstVideo = originalVideos.find(v => v.selected);
  if (firstVideo && videoEl) {
    console.log(`[preview] Loading placeholder video: ${firstVideo.name}`);
    videoEl.src = firstVideo.url;
    videoEl.load();
    
    // Add visual indicator that this is a preview
    videoEl.style.filter = "brightness(0.7) contrast(1.2)";
    videoEl.style.border = "2px solid #3b82f6";
    
    console.log(`[preview] Quick preview loaded`);
  }
}

async function waitForFile(
  path: string,
  timeoutMs = 15000,
  step = 150
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await exists(path)) {
        console.log(`[preview] File found: ${path}`);
        return true;
      }
    } catch (error) {
      console.warn(`[preview] Error checking file existence: ${error}`);
    }
    await new Promise((r) => setTimeout(r, step));
  }
  throw new Error(`Proxy not found after ${timeoutMs}ms: ${path}`);
}

export async function renderProxyAndLoad(
  sessionRoot: string,
  videoEl: HTMLVideoElement,
  preset?: string
): Promise<void> {
  console.log(`[preview] Starting proxy render for session: ${sessionRoot}`);

  // Debug: Check what directories exist
  const { readDir } = await import("@tauri-apps/plugin-fs");

  try {
    console.log(`[preview] Checking session directory: ${sessionRoot}`);
    const sessionContents = await readDir(sessionRoot);
    console.log(
      `[preview] Session contents:`,
      sessionContents.map((entry) => entry.name)
    );

    // Also check if cache directory exists with cutlist.json
    const cacheDir = await import("@tauri-apps/api/path").then((p) =>
      p.join(sessionRoot, "cache")
    );
    try {
      console.log(`[preview] Checking cache directory: ${await cacheDir}`);
      const cacheContents = await readDir(await cacheDir);
      console.log(
        `[preview] Cache contents:`,
        cacheContents.map((entry) => entry.name)
      );

      // Check specifically for cutlist.json
      const { exists } = await import("@tauri-apps/plugin-fs");
      const cutlistPath = await import("@tauri-apps/api/path").then((p) =>
        p.join(sessionRoot, "cache", "cutlist.json")
      );
      const cutlistExists = await exists(await cutlistPath);
      console.log(
        `[preview] Cutlist exists at ${await cutlistPath}: ${cutlistExists}`
      );
    } catch (error) {
      console.warn(`[preview] Cache directory not found:`, error);
    }
  } catch (error) {
    console.warn(`[preview] Could not read session directory:`, error);
  }

  // Kick render with session base_dir
  console.log(`[preview] Running render stage with base_dir: ${sessionRoot}`);
  await runStage("render", {
    proxy: true,
    base_dir: sessionRoot,
    preset: preset || "landscape",
  });

  // Check what got created after render
  try {
    console.log(`[preview] Checking session directory after render:`);
    const sessionContentsAfter = await readDir(sessionRoot);
    console.log(
      `[preview] Session contents after render:`,
      sessionContentsAfter.map((entry) => entry.name)
    );

    // Check if render directory exists
    const renderDir = await join(sessionRoot, "render");
    console.log(`[preview] Checking render directory: ${renderDir}`);
    try {
      const renderContents = await readDir(renderDir);
      console.log(
        `[preview] Render directory contents:`,
        renderContents.map((entry) => entry.name)
      );
    } catch (error) {
      console.warn(`[preview] Render directory not found or empty:`, error);
    }
  } catch (error) {
    console.warn(`[preview] Could not read directories after render:`, error);
  }

  // Wait for the proxy file to be created
  const proxyPath = await getProxyPath(sessionRoot);
  console.log(`[preview] Waiting for proxy at: ${proxyPath}`);

  await waitForFile(proxyPath);

  // Instead of using asset URLs, read the file and create a blob URL (which we know works)
  console.log(`[preview] Reading proxy file to create blob URL: ${proxyPath}`);
  
  try {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const fileData = await readFile(proxyPath);
    console.log(`[preview] Read file data, size: ${fileData.length} bytes`);
    
    // Create blob URL from file data
    const blob = new Blob([fileData], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    console.log(`[preview] Created blob URL: ${url}`);

    videoEl.pause();
    console.log(`[preview] Setting video src to blob URL: ${url}`);
    
    // Clear any placeholder styling
    videoEl.style.filter = "";
    videoEl.style.border = "";
    
    videoEl.src = url;
    console.log(`[preview] Video src set, calling load()`);
    videoEl.load();
    
  } catch (error) {
    console.error(`[preview] Error reading file or creating blob:`, error);
    throw error;
  }

  // Add event listeners to debug what happens
  const onLoadedData = () => {
    console.log(`[preview] Video loaded data successfully`);
    videoEl.removeEventListener("loadeddata", onLoadedData);
  };

  const onError = (e: any) => {
    console.error(`[preview] Video error:`, e);
    videoEl.removeEventListener("error", onError);
  };

  videoEl.addEventListener("loadeddata", onLoadedData);
  videoEl.addEventListener("error", onError);

  console.log(`[preview] Proxy loading initiated`);
}

export async function loadExistingProxy(
  sessionRoot: string,
  videoEl: HTMLVideoElement
): Promise<boolean> {
  try {
    const proxyPath = await getProxyPath(sessionRoot);

    if (await exists(proxyPath)) {
      console.log(`[preview] Loading existing proxy via blob URL: ${proxyPath}`);
      
      // Use blob URL instead of asset URL (which we know works)
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const fileData = await readFile(proxyPath);
      console.log(`[preview] Read existing proxy data, size: ${fileData.length} bytes`);
      
      const blob = new Blob([fileData], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      console.log(`[preview] Created blob URL for existing proxy: ${url}`);

      videoEl.pause();
      videoEl.src = url;
      videoEl.load();

      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[preview] Error loading existing proxy: ${error}`);
    return false;
  }
}
