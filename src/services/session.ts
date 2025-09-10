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
  const { appLocalDataDir, join } = await import("@tauri-apps/api/path");

  const id = String(Date.now());
  const baseDir = await appLocalDataDir();
  const root = await join(baseDir, "sessions", id);
  const clips = await join(root, "clips");

  console.log(`Creating session ${id}`);
  console.log(`Audio path: ${audioPath}`);
  console.log(`Video paths: ${videoPaths.length} files`);
  console.log(`Session root: ${root}`);

  // Create session directories
  await mkdir(clips, { recursive: true });

  // Copy video files to session clips directory
  for (const videoPath of videoPaths) {
    const filename = await basename(videoPath);
    const destPath = await join(clips, filename);
    console.log(`Copying video: ${videoPath} -> ${destPath}`);
    await copyFile(videoPath, destPath);
  }

  // Copy audio file to session directory
  const audioFilename = await basename(audioPath);
  const sessionAudioPath = await join(root, audioFilename);
  console.log(`Copying audio: ${audioPath} -> ${sessionAudioPath}`);
  await copyFile(audioPath, sessionAudioPath);

  // Create session manifest
  const manifest: SessionManifest = {
    id,
    createdAt: Date.now(),
    audio: sessionAudioPath, // Use the copied file path
    sources: videoPaths,
  };

  const manifestPath = await join(root, "manifest.json");
  await writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`Session ${id} created successfully`);
  console.log(`Audio file stored at: ${sessionAudioPath}`);

  return {
    id,
    root,
    clipsDir: clips,
    audio: sessionAudioPath, // Return the copied file path
  };
}

export async function loadSession(
  sessionId: string
): Promise<SessionData | null> {
  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const { appLocalDataDir, join } = await import("@tauri-apps/api/path");

    const baseDir = await appLocalDataDir();
    const root = await join(baseDir, "sessions", sessionId);
    const manifestPath = await join(root, "manifest.json");
    const manifestContent = await readTextFile(manifestPath);
    const manifest: SessionManifest = JSON.parse(manifestContent);

    return {
      id: manifest.id,
      root,
      clipsDir: await join(root, "clips"),
      audio: manifest.audio,
    };
  } catch {
    return null;
  }
}
