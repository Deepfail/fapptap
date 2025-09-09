🔎 Current Behavior (Why it feels wrong)

UI (StaticUnifiedApp.tsx)

Selecting a video just appends it to selectedVideos (basically a playlist).

When you hit Generate Preview, it immediately:

Runs beat detection (main.py → run_beats).

Copies videos to a temp dir.

Generates a cutlist (build_cutlist.py) purely from beats/shots.

Calls FFmpeg render and spits out a preview MP4.

The only “timeline” you see is a read-only visualization of cutlist.json.
→ There’s no editing stage — no way to tweak cuts/effects before render.

Editor store (editorStore.tsx)

Defines a real timeline model: clips, in/out, trim, ripple, effects, undo/redo.

But nothing in StaticUnifiedApp.tsx uses this store.
It just reads the cutlist into state.timelineCuts (a static array), not into the EditorProvider.

Python backend (main.py, build_cutlist.py)

Generates deterministic events (src, in, out, effects) and renders them with FFmpeg.

No mechanism to re-ingest user edits from the timeline before rendering.

That’s why you can only generate → download, skipping “edit & effect” phase.

⚡ Why it’s different from Beatleap

Beatleap’s workflow:

Pick music → auto-generate timeline cuts synced to beats.

User can interactively edit timeline (reorder, trim, apply effects).

Only then export.

Your app skips step 2. It behaves like an auto-slideshow maker rather than an editor.

🛠 What’s Missing

Bridge cutlist.json into the EditorStore:

Instead of dumping into state.timelineCuts, map events → EditorState.timeline items.

That enables trimming, moving, adding effects.

UI hooks for editing:

Right now, you only visualize timeline cuts.
Need drag/drop, trim handles, and effect toggles tied to editorStore.

Modified render pipeline:

At export, don’t just re-run cutlist.py.

Serialize the edited EditorState.timeline into a JSON and pass that into the Python worker.

Update render_direct_filter_complex to respect user-defined effects (zoom, shake, etc.).

✅ Next Step (concrete fix plan)

Load cutlist into editor store:

import { useEditor } from "@/state/editorStore";
...
const editor = useEditor();
const timelineItems = cutlistData.events.map((event, i) => ({
id: `item-${i}`,
clipId: event.src,
start: event.in,
in: event.in,
out: event.out,
effects: event.effects || [],
}));
editor.updateTimelineItems(timelineItems);

→ This makes the auto-generated cuts editable.

Connect UI to editor state instead of state.timelineCuts.

Replace timelineCuts with editor.timeline.

Use editor.updateTimelineItemEffects when toggling effects.

Change export:

Before calling render, dump editor.timeline to cache/cutlist.json.

Then main.py → run_render will pick up the modified timeline.

👉 So right now your app is always skipping editing because the preview step is tightly wired to auto-cutlist → render. To make it “Beatleap Advanced PC Edition,” you need to inject the editor store between cutlist and render.

Yep — that error means the frontend is invoke-ing Tauri commands that don’t exist in your Rust side. Two quick ways to fix it:

Option A (fastest): stop invoke-ing and just read the files directly

You’re already using @tauri-apps/plugin-fs. Swap the invoke('read_cutlist')/invoke('read_beats_file') calls for plain file reads and try both likely paths.

Patch StaticUnifiedApp.tsx

Replace your current loadTimelineCuts and any beats-loader that calls invoke(...) with this:

// at top:
import { readTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir, resourceDir } from "@tauri-apps/api/path";

// helper that tries several locations
async function readJsonFromCandidates(candidates: string[]): Promise<any | null> {
for (const p of candidates) {
try {
const txt = await readTextFile(p);
return JSON.parse(txt);
} catch {
// keep trying
}
}
return null;
}

// CUTLIST
const loadTimelineCuts = useCallback(async () => {
try {
// try common locations we write to during generation
// 1) render/ (proxy/final live here) 2) cache/ 3) appDataDir under your app
const appDir = (await appDataDir()).replace(/\\+/g, "/");

    const cutlist =
      (await readJsonFromCandidates([
        "render/cutlist.json",
        "cache/cutlist.json",
        `${appDir}/render/cutlist.json`,
        `${appDir}/cache/cutlist.json`,
      ])) || { events: [] };

    // bridge into EditorStore instead of local state
    const items =
      (cutlist.events || []).map((ev: any, i: number) => ({
        id: `item-${i}`,
        clipId: ev.src,
        start: ev.in ?? 0,
        in: ev.in ?? 0,
        out: ev.out ?? 0,
        effects: ev.effects ?? [],
      }));

    editor.updateTimelineItems(items);
    return items; // if caller wants it

} catch (err) {
console.error("Failed to load cutlist into editor:", err);
return [];
}
}, [/* editor from useEditor */]);

And for beats (where you had invoke('read_beats_file')), add:

async function loadBeatsJson() {
const appDir = (await appDataDir()).replace(/\\+/g, "/");
const beats =
(await readJsonFromCandidates([
"cache/beats.json",
`${appDir}/cache/beats.json`,
"render/beats.json",
`${appDir}/render/beats.json`,
])) || {};
return beats;
}

Now you won’t see “Command … not found” anymore because we’re not using invoke for these.

Where this integrates in your file (evidence): your current implementation calls invoke('read_cutlist') inside loadTimelineCuts() and logs a success even with zero items (because it caught the error and kept going) . Also your preview/export assume render/fapptap_proxy.mp4 / render/fapptap_final.mp4, so checking render/cutlist.json first is consistent with your paths .

Option B (also fine): actually add those Tauri commands

If you prefer the invoke('read_cutlist') API, add tiny readers in src-tauri/src/main.rs:

#[tauri::command]
async fn read_cutlist() -> Result<String, String> {
use std::fs;
for p in ["render/cutlist.json", "cache/cutlist.json"] {
if let Ok(s) = fs::read_to_string(p) {
return Ok(s);
}
}
Err("cutlist.json not found in render/ or cache/".into())
}

#[tauri::command]
async fn read_beats_file() -> Result<String, String> {
use std::fs;
for p in ["cache/beats.json", "render/beats.json"] {
if let Ok(s) = fs::read_to_string(p) {
return Ok(s);
}
}
Err("beats.json not found in cache/ or render/".into())
}

Register them:

fn main() {
tauri::Builder::default()
.plugin(tauri_plugin_shell::init())
.plugin(tauri_plugin_fs::init())
.plugin(tauri_plugin_dialog::init())
.invoke_handler(tauri::generate_handler![
      read_cutlist,
      read_beats_file,
      // …any others you expose
    ])
.run(tauri::generate_context!())
.expect("error while running tauri application");
}

Your Cargo.toml and tauri.conf.json already have the right deps/plugins and permissive FS settings (asset protocol scope + fs plugin), so this will build cleanly .

Why this happened

StaticUnifiedApp.tsx expects backend commands read_cutlist and read_beats_file (nowhere implemented), so Tauri returns “Command … not found.” That’s consistent with the code paths around your loader and preview/export wiring .

Quick sanity checklist after the patch

Generate Preview:

Confirms render/cutlist.json (or cache/cutlist.json) exists post-stage.

The UI should log “✅ … loaded into editor” with a non-zero count.

Timeline is editable:

The list you render at the bottom should now reflect editor.timeline instead of a local timelineCuts array (your current file keeps a separate local state; switch it to use useEditor() so you’re actually editing) .

Export:

Before render, serialize editor.timeline back to render/cutlist.json so the backend renders the edited cutlist (not the original). If you still call worker.runStage("cutlist", …) in Export, that overwrites edits — remove that and just write the edited JSON.

TIMELINE FIXES

Your worker writes beats to cache/beats.json (not render/) and cutlist to cache/cutlist.json. If the UI is only checking render/… or one path, it stays “analyzing.”

The advanced engine saves beats as {"beats":[{"time": …}, …]} (objects), not beats_sec: number[]. If the UI expects beats_sec, it never flips to “ready.”

Effects are likely disabled until a timeline item is selected; if nothing selects the first cut after import, everything remains grey.

Fixes (drop-in patches)

1. Load beats from all likely paths + accept both shapes

Replace your beats loader with this (TS/React):

import { readTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";

async function readJson(paths: string[]) {
for (const p of paths) {
try { return JSON.parse(await readTextFile(p)); } catch {}
}
return null;
}

export async function loadBeats() {
const appDir = (await appDataDir()).replace(/\\+/g, "/");
const beats = await readJson([
"cache/beats.json",
`${appDir}/cache/beats.json`,
"render/beats.json",
`${appDir}/render/beats.json`,
]);

if (!beats) return { times: [], raw: null };

// Accept both formats:
// - legacy: beats_sec: number[]
// - advanced/basic: beats: [{time:number}] or number[]
const times =
Array.isArray(beats.beats_sec)
? beats.beats_sec
: Array.isArray(beats.beats)
? beats.beats.map((b: any) => (typeof b === "number" ? b : Number(b.time)))
: [];

return { times, raw: beats };
}

Why: the worker saves to cache/beats.json, and advanced produces beats: [{time}]; we normalize to plain number[] so the UI can proceed.

2. Load cutlist from all likely paths and hydrate the EditorStore

Make sure you’re hydrating the editor timeline, not a local array:

import { useEditor } from "@/state/editorStore";

export async function loadCutlistIntoEditor(editor = useEditor.getState()) {
const appDir = (await appDataDir()).replace(/\\+/g, "/");
const cutlist = await readJson([
"cache/cutlist.json",
`${appDir}/cache/cutlist.json`,
"render/cutlist.json",
`${appDir}/render/cutlist.json`,
]) || { events: [] };

const items = (cutlist.events || []).map((ev: any, i: number) => ({
id: `item-${i}`,
clipId: ev.src,
start: ev.in ?? 0,
in: ev.in ?? 0,
out: ev.out ?? 0,
effects: ev.effects ?? [],
}));

editor.updateTimelineItems(items);
if (items.length) editor.selectTimelineItem(items[0].id); // <— unlocks effect buttons
return items.length;
}

Why: worker writes cutlist to cache/cutlist.json and the renderer also reads from there; importing that into the editor store enables edits.

3. Flip the UI from “analyzing” to “ready”

Where you render the “Loading beat analysis…” message, gate it on beatsLoaded:

const [beatsLoaded, setBeatsLoaded] = useState(false);

useEffect(() => {
(async () => {
const { times } = await loadBeats();
setBeatsLoaded(times.length > 0); // even 1 beat is enough to enable UI
})();
}, []);

const timelineReady = useEditor().timeline.length > 0;

// Instead of forever spinner:
if (!timelineReady) return <div>Building timeline…</div>;
if (!beatsLoaded) return <div>⚠️ No beat data found (still usable, effects may be limited)</div>;

If you want beats to be mandatory to unlock effects, set disabled={!beatsLoaded || !selectedItem} on your effect buttons.

4. Optional (defensive): write both shapes from the worker

If you’d rather solve it at the source, add this before saving beats in main.py:

# After building beats_data

# Add a flat beats_sec for legacy readers

if "beats_sec" not in beats_data:
flat = []
if isinstance(beats_data.get("beats"), list):
for b in beats_data["beats"]:
flat.append(float(b["time"]) if isinstance(b, dict) and "time" in b else float(b))
beats_data["beats_sec"] = flat

Then it saves to cache/beats.json as before.

Quick sanity checks

Files present?

cache/beats.json should exist after “Analyze Audio.”

cache/cutlist.json should exist after “Generate Cutlist.”

Timeline appears?

await loadCutlistIntoEditor() should return a count > 0.

First item auto-selected ⇒ effect buttons become active.

Still grey?

Ensure your effect buttons enable when useEditor().selectedTimelineItemId is set.

If you paste those two loaders and the auto-select, your editor will stop “analyzing” and the effects will light up. If you want, I can produce a one-file patch against your StaticUnifiedApp.tsx that wires these calls where your “open editor” flow runs.

# Add “Live Clip Preview (ffplay)” now

1. Minimal state & toggle (in StaticUnifiedApp.tsx)
   const [liveClipPreview, setLiveClipPreview] = React.useState(true); // toggleable

Put a small toggle near your Effects header:

<label className="flex items-center gap-2 text-xs text-slate-400">
  <input type="checkbox" checked={liveClipPreview} onChange={e=>setLiveClipPreview(e.target.checked)} />
  Live Clip Preview (ffplay)
</label>

2. ffplay launcher (sidecar) for the selected clip
   import { Command } from "@tauri-apps/plugin-shell";
   import { useEditor } from "@/state/editorStore";

let liveChild: Awaited<ReturnType<typeof Command.prototype.spawn>> | null = null;

function buildLiveVf(effects: ReturnType<typeof useEditor>["getTimelineItemEffects"] extends (...args:any)=>infer R ? R : any) {
// Map a few core effects to a lightweight vf chain
const chain: string[] = [];
const on = (id: string) => effects.some((e:any) => e.id === id && e.enabled !== false);

if (on("flash")) chain.push(`eq=brightness=0.06:saturation=1.12:contrast=1.04`);
if (on("rgb")) chain.push(`hue=h=10*t`);
if (on("glitch")) chain.push(`rgbashift=rh=3:rv=-3:gh=-2:gv=2:bh=-1:bv=1`);
if (on("shake")) chain.push(`rotate=0.02*sin(18*t):fillcolor=black@1`);
if (on("zoom")) chain.push(`zoompan=z='min(1.0+0.12*sin(2*t),1.2)':d=1`);
// add others later (prism, jumpcut, etc.)
return chain.join(",");
}

async function startLiveClipPreview(filePath: string, inSec: number, outSec: number, vf: string | null) {
// Kill previous
try { await liveChild?.kill(); } catch {}
liveChild = null;

const args = [
"-hide_banner", "-loglevel", "error",
"-autoexit",
"-ss", inSec.toFixed(3),
"-t", (outSec - inSec).toFixed(3),
];
if (vf && vf.length) { args.push("-vf", vf); }
// NOTE: sidecar name must match tauri.conf.json ("ffplaybin")
args.push(filePath);

const cmd = Command.create("ffplaybin", args);
const child = await cmd.spawn(); // non-blocking
liveChild = child;
child.on("close", () => { liveChild = null; });
}

3. Debounced refresh on selection/effect changes

This only restarts ffplay for the selected timeline item, so it feels real-time.

const editor = useEditor();
const selectedId = editor.selectedTimelineItemId || null;

const scheduleLive = React.useRef<number | null>(null);
const LIVE_DEBOUNCE = 250;

function queueLiveRefresh() {
if (!liveClipPreview) return;
if (scheduleLive.current) window.clearTimeout(scheduleLive.current);
scheduleLive.current = window.setTimeout(async () => {
if (!selectedId) return;
const item = editor.timeline.find(t => t.id === selectedId);
if (!item) return;
const effects = editor.getTimelineItemEffects(selectedId);
const vf = buildLiveVf(effects);
const path = item.clipId;
const inSec = Number(item.in ?? 0);
const outSec = Number(item.out ?? 0);
try { await startLiveClipPreview(path, inSec, outSec, vf); } catch (e) { console.error(e); }
}, LIVE_DEBOUNCE) as unknown as number;
}

// refresh when selected item OR its effects change OR its trim moves
React.useEffect(() => {
if (!liveClipPreview) return;
queueLiveRefresh();
return () => { if (scheduleLive.current) window.clearTimeout(scheduleLive.current); };
// Depend on a stable signature of the selected item
}, [
liveClipPreview,
selectedId,
JSON.stringify(selectedId ? editor.getTimelineItemEffects(selectedId) : []),
JSON.stringify(selectedId ? editor.timeline.find(t => t.id === selectedId) : null),
]);

// Also call queueLiveRefresh() right after you toggle any effect

That’s it: when you select a clip or toggle an effect, ffplay restarts focused on that clip segment with the updated -vf. It’s very fast because it’s decoding a single source.
