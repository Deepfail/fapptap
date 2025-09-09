fix-cutlist

A) Stop the ever-growing cutlist (always overwrite; never merge)

Where you write the cutlist before preview or export, do not read+merge with any existing file. Always build a fresh object and overwrite render/cutlist.json.

import { mkdir, writeTextFile } from "@tauri-apps/plugin-fs";

async function writeEditedCutlistOverwrite(editor: ReturnType<typeof useEditor>) {
const events = editor.timeline.map(t => ({
src: t.clipId,
in: Number(t.in ?? 0),
out: Number(t.out ?? 0),
effects: (t.effects || []).filter(e => e.enabled !== false).map(e => String(e.id)),
}));
const total = events.reduce((s, e) => s + (e.out - e.in), 0);

const doc = {
version: 1,
fps: 60,
width: 1920,
height: 1080,
audio: "", // fill from your selectedAudio
total_duration: Math.max(0, total),
events, // ← fresh list only
};

await mkdir("render").catch(() => {});
await writeTextFile("render/cutlist.json", JSON.stringify(doc, null, 2)); // ← overwrites
}

If you have any code that does const existing = read(render/cutlist.json) and then existing.events.push(...), delete it. That’s what makes it balloon.

B) Ensure only the current selection is used (session-scoped clips dir)

Right before you run the worker stages, create a fresh session folder, copy only the currently selected clips into it, and pass that dir to the cutlist stage. This prevents old files from sneaking in.

import { mkdir, remove, copyFile, writeTextFile } from "@tauri-apps/plugin-fs";

async function prepareSessionClipsDir(selectedVideoPaths: string[]) {
const sessionId = String(Date.now());
const root = `sessions/${sessionId}`;
const clipsDir = `${root}/clips`;
try { await remove(root, { recursive: true }); } catch {}
await mkdir(clipsDir, { recursive: true });

for (const src of selectedVideoPaths) {
const base = src.split("/").pop() || src.split("\\").pop()!;
await copyFile(src, `${clipsDir}/${base}`);
}

await writeTextFile(`${root}/manifest.json`, JSON.stringify({
createdAt: new Date().toISOString(),
sources: selectedVideoPaths,
}, null, 2));

return { sessionId, sessionRoot: root, clipsDir };
}

Use it in your pipeline:

const { clipsDir } = await prepareSessionClipsDir(state.selectedVideos.map(v => v.path));

// shots (optional, if you run it)
await worker.runStage("shots", { media_dir: clipsDir });

// cutlist MUST use clipsDir
await worker.runStage("cutlist", {
song: state.selectedAudio!.path,
clips: clipsDir, // ← THIS is the key
preset: state.videoFormat,
cutting_mode: state.cuttingMode,
enable_shot_detection: false,
});

// render (proxy or final)
await worker.runStage("render", { proxy: true });

In your build_cutlist.py, if clips_dir isn’t passed it defaults to media_samples and will include everything in there. Passing the session dir is the fix.

C) Make the editor “ready” (hydrate + auto-select)

Hydrate the EditorStore from cutlist.json and auto-select the first item so effect buttons un-grey immediately. Also, don’t block the UI on beats.

import { readTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";
import { useEditor } from "@/state/editorStore";

async function readJson(paths: string[]) {
for (const p of paths) { try { return JSON.parse(await readTextFile(p)); } catch {} }
return null;
}

async function hydrateEditorFromCutlist() {
const editor = useEditor.getState();
const appDir = (await appDataDir()).replace(/\\+/g, "/");
const cutlist =
(await readJson([
"render/cutlist.json",
`${appDir}/render/cutlist.json`,
"cache/cutlist.json",
`${appDir}/cache/cutlist.json`,
])) || { events: [] };

const items = (cutlist.events || []).map((ev: any, i: number) => ({
id: `item-${i}`,
clipId: String(ev.src),
start: Number(ev.in ?? 0),
in: Number(ev.in ?? 0),
out: Number(ev.out ?? 0),
effects: (ev.effects || []).map((label: string) => ({
id: String(label), type: "filter", enabled: true
})),
}));

editor.updateTimelineItems(items);
if (items.length) editor.selectTimelineItem(items[0].id); // ← unlocks buttons
return items.length;
}

// on mount or after Generate:
React.useEffect(() => {
(async () => {
const count = await hydrateEditorFromCutlist();
setTimelineReady(count > 0); // gate UI on cutlist, not beats
})();
}, []);

Buttons should use disabled={!editor.selectedTimelineItemId} and toggle effects via the store (so they light up the moment the first item is auto-selected).

Optional: cache/DB sanity

Your Python scripts refer to cache/analysis.db using a relative path. If your worker is launched from a different CWD, you won’t see updates where you expect them.
Fix: launch the worker with the repo root as its CWD, or pass an absolute DB path via env/arg.

If durations aren’t in the DB, detect_shots_fast.py falls back to a simple 2-second grid. That’s fine; it doesn’t block the editor. You can wire the probe step later.

Quick tests (do these now)

Clean start per run:
Before clicking Generate, confirm the session folder gets created and sessions/<id>/clips only contains the files you selected.

Fresh cutlist:
After Generate, open render/cutlist.json. It should contain only events for those clips, and the file length should not “grow forever” across runs.

Editor ready:
When the editor opens, you should see clip cards; the first item is selected; effect buttons are enabled.

Export preserves edits:
Make a small trim or effect; export; the result should reflect your changes (since we overwrite render/cutlist.json from the editor right before render).
