// services/session.ts
import { writeTextFile, mkdir, copyFile, exists } from "@tauri-apps/plugin-fs";
import { basename } from "@tauri-apps/api/path";
import { isTauriAvailable } from "../lib/platform";

export interface SessionManifest {
  id: string;
  createdAt: number;
  audio: string;
  sources: string[];
}

export interface SessionInfo {
  id: string;
  root: string;
  clipsDir: string;
  audio: string;
}

/**
 * Create a new editing session with isolated clips directory
 */
export async function createSession(videoPaths: string[], audioPath: string): Promise<SessionInfo> {
  if (!isTauriAvailable()) {
    throw new Error("Session management requires desktop mode");
  }

  const id = String(Date.now());
  const root = `sessions/${id}`;
  const clipsDir = `${root}/clips`;

  // Create directory structure
  await mkdir(clipsDir, { recursive: true });

  // Copy videos to session clips directory
  const copiedClips: string[] = [];
  for (const videoPath of videoPaths) {
    const fileName = await basename(videoPath);
    const destinationPath = `${clipsDir}/${fileName}`;
    await copyFile(videoPath, destinationPath);
    copiedClips.push(destinationPath);
  }

  // Create session manifest
  const manifest: SessionManifest = {
    id,
    createdAt: Date.now(),
    audio: audioPath,
    sources: videoPaths,
  };

  await writeTextFile(`${root}/manifest.json`, JSON.stringify(manifest, null, 2));

  return {
    id,
    root,
    clipsDir,
    audio: audioPath,
  };
}

/**
 * Load session info from existing session directory
 */
export async function loadSession(sessionId: string): Promise<SessionInfo | null> {
  if (!isTauriAvailable()) {
    throw new Error("Session management requires desktop mode");
  }

  const root = `sessions/${sessionId}`;
  const manifestPath = `${root}/manifest.json`;
  
  if (!(await exists(manifestPath))) {
    return null;
  }

  try {
    const manifestText = await import("@tauri-apps/plugin-fs").then(fs => fs.readTextFile(manifestPath));
    const manifest: SessionManifest = JSON.parse(manifestText);
    
    return {
      id: manifest.id,
      root,
      clipsDir: `${root}/clips`,
      audio: manifest.audio,
    };
  } catch (error) {
    console.error(`Failed to load session ${sessionId}:`, error);
    return null;
  }
}

/**
 * List all available sessions
 */
export async function listSessions(): Promise<SessionManifest[]> {
  if (!isTauriAvailable()) {
    return [];
  }

  try {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    const sessionsDir = "sessions";
    
    if (!(await exists(sessionsDir))) {
      return [];
    }

    const entries = await readDir(sessionsDir);
    const sessions: SessionManifest[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) {
        const manifestPath = `${sessionsDir}/${entry.name}/manifest.json`;
        if (await exists(manifestPath)) {
          try {
            const manifestText = await import("@tauri-apps/plugin-fs").then(fs => fs.readTextFile(manifestPath));
            const manifest: SessionManifest = JSON.parse(manifestText);
            sessions.push(manifest);
          } catch (error) {
            console.warn(`Failed to read manifest for session ${entry.name}:`, error);
          }
        }
      }
    }

    // Sort by creation time, newest first
    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error("Failed to list sessions:", error);
    return [];
  }
}