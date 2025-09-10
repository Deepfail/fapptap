import { basename } from "@tauri-apps/api/path";

export interface SessionManifest {
  id: string;
  createdAt: number;
  audio: string;
  sources: string[];
}

export interface SessionData {
  id: string;
  root: string;
  clipsDir: string;
  audio: string;
}

export async function createSession(
  videoPaths: string[],
  audioPath: string
): Promise<SessionData> {
  const { mkdir, copyFile, writeTextFile } = await import(
    "@tauri-apps/plugin-fs"
  );

  const id = String(Date.now());
  const root = `sessions/${id}`;
  const clips = `${root}/clips`;

  // Create session directories
  await mkdir(clips, { recursive: true });

  // Copy video files to session clips directory
  for (const videoPath of videoPaths) {
    const filename = await basename(videoPath);
    await copyFile(videoPath, `${clips}/${filename}`);
  }

  // Create session manifest
  const manifest: SessionManifest = {
    id,
    createdAt: Date.now(),
    audio: audioPath,
    sources: videoPaths,
  };

  await writeTextFile(
    `${root}/manifest.json`,
    JSON.stringify(manifest, null, 2)
  );

  return {
    id,
    root,
    clipsDir: clips,
    audio: audioPath,
  };
}

export async function loadSession(
  sessionId: string
): Promise<SessionData | null> {
  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const root = `sessions/${sessionId}`;
    const manifestPath = `${root}/manifest.json`;
    const manifestContent = await readTextFile(manifestPath);
    const manifest: SessionManifest = JSON.parse(manifestContent);

    return {
      id: manifest.id,
      root,
      clipsDir: `${root}/clips`,
      audio: manifest.audio,
    };
  } catch {
    return null;
  }
}
