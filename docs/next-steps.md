CHATGPT5s SUGGESTED NEXT STEPS

Next 7 concrete steps

1. Wire real ffmpeg progress (Python → JSON)

Inside worker/main.py, call ffmpeg with -progress pipe:1 and stream key=value lines.

# worker/main.py (add/replace your render impl)

import json, subprocess, shlex, sys, re, time
from pathlib import Path

def emit(stage, **kw): print(json.dumps({"stage": stage, **kw}), flush=True)

def parse_progress_line(line): # returns dict from 'key=value'
if '=' in line:
k, v = line.strip().split('=', 1)
return {k: v}
return {}

def run_render(song, cutlist_path, proxy=True, ffmpeg_path="ffmpeg", duration_s=None): # build your full ffmpeg cmd here; example stub:
out = "render/proxy_preview.mp4" if proxy else "render/final.mp4"
Path("render").mkdir(exist_ok=True)
cmd = f'{ffmpeg_path} -y -hide_banner -nostats -progress pipe:1 -i "{song}" -c:v h264_nvenc -preset p5 -cq 23 -c:a aac "{out}"'

    emit("render", progress=0.0, msg="starting")
    p = subprocess.Popen(shlex.split(cmd), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    out_time_ms = 0
    while True:
        line = p.stdout.readline()
        if not line:
            if p.poll() is not None:
                break
            time.sleep(0.01)
            continue
        kv = parse_progress_line(line)
        if "out_time_ms" in kv:
            try: out_time_ms = int(kv["out_time_ms"])
            except: pass
            if duration_s and duration_s > 0:
                prog = max(0.0, min(1.0, (out_time_ms/1_000_000) / duration_s))
                emit("render", progress=prog, out_time_ms=out_time_ms)
        elif "speed" in kv:
            emit("render", progress=None, speed=kv["speed"])
        elif "progress" in kv and kv["progress"] == "end":
            emit("render", progress=1.0, msg="done")
    code = p.wait()
    emit("render", exit_code=code)

In TS you already parse JSONL; just use e.progress when present and show e.speed if you emit it.

Tip: compute duration_s once from probe/cache to get an accurate percentage.

2. Add a Cancel/Stop button (kills worker)

Expose a kill in your worker wrapper.

// src/lib/worker.ts
import { Command } from "@tauri-apps/plugin-shell";
let current: Command | null = null;

export async function runWorker(args: string[], onJSON:(obj:any)=>void, onLine?:(s:string)=>void) {
current = new Command("python", args, { cwd: /_ your repo _/ undefined });
current.on("data", e => {
const s = typeof e === "string" ? e : e.stdout ?? "";
for (const line of s.split(/\r?\n/)) {
if (!line.trim()) continue;
onLine?.(line);
try { onJSON(JSON.parse(line)); } catch {}
}
});
try { await current.execute(); } finally { current = null; }
}

export function cancelWorker() {
if (current) current.kill(); // sends SIGKILL on Windows
}

UI:

<Button variant="secondary" onClick={cancelWorker}>Stop</Button>

3. Waveform with WaveSurfer + beat markers
   pnpm add wavesurfer.js

// src/components/Waveform.tsx
import WaveSurfer from "wavesurfer.js";
import { useEffect, useRef } from "react";

export function Waveform({ audioPath, beats }: { audioPath: string; beats: number[] }) {
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
if (!ref.current) return;
const ws = WaveSurfer.create({ container: ref.current, height: 96, waveColor: '#666', progressColor: '#ddd' });
ws.load(audioPath);
ws.on('ready', () => {
beats.forEach(t => {
const el = document.createElement('div');
el.style.cssText = 'position:absolute;top:0;bottom:0;width:1px;background:#f59e0b';
const px = (t / ws.getDuration()) \* ws.getWrapper().clientWidth;
el.style.left = `${px}px`;
ws.getWrapper().appendChild(el);
});
});
return () => ws.destroy();
}, [audioPath, beats]);
return <div className="relative" ref={ref} />;
}

Pass beats from beats.json and the selected song path.

4. Timeline stub with PixiJS
   pnpm add pixi.js

// src/components/Timeline.tsx
import { Application, Graphics } from 'pixi.js';
import { useEffect, useRef } from 'react';

type Cut = { at: number; in: number; out: number; clipId: string };

export function Timeline({ cuts, duration }: { cuts: Cut[]; duration: number }) {
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
if (!ref.current) return;
const app = new Application({ background: 0x111111, width: ref.current.clientWidth, height: 160 });
ref.current.appendChild(app.view as any);

    const laneY = 40;
    cuts.forEach((c, i) => {
      const g = new Graphics();
      const x = (c.at / duration) * app.view.width;
      const w = ((c.out - c.in) / duration) * app.view.width;
      g.beginFill(0x2dd4bf).drawRoundedRect(x, laneY + (i%2)*24, Math.max(2, w), 18, 4).endFill();
      app.stage.addChild(g);
    });

    return () => { app.destroy(true); ref.current!.innerHTML = '' }

}, [cuts, duration]);
return <div ref={ref} className="w-full" />
}

Load cutlist.json (see next step) and hand the events in.

5. Load pipeline JSONs from disk (no extra plugin)
   import { readTextFile } from "@tauri-apps/api/fs";
   import { join } from "@tauri-apps/api/path";

async function loadBeats(projectDir:string) {
const p = await join(projectDir, "cache", "beats.json");
return JSON.parse(await readTextFile(p)) as { beats: number[] };
}
async function loadCutlist(projectDir:string) {
const p = await join(projectDir, "render", "cutlist.json");
return JSON.parse(await readTextFile(p)) as { events: any[]; duration: number };
}

6. Persist last used paths & prefs (Store plugin)
   pnpm add @tauri-apps/plugin-store

Rust:

tauri::Builder::default()
.plugin(tauri_plugin_store::Builder::default().build())
// ...

JS:

import { Store } from "@tauri-apps/plugin-store";
const store = new Store(".fapptap.dat");
await store.set("lastSong", songPath);
await store.save();

7. Bundle the Python worker + ffmpeg (sidecars) for clean installs

A) Pack the worker

# from /worker

py -m pip install pyinstaller
py -m PyInstaller --onefile --name fapptap-worker worker/main.py

# result in dist/fapptap-worker(.exe)

B) Put sidecars in Tauri config
src-tauri/tauri.conf.json:

{
"bundle": {
"externalBin": [
"sidecars/fapptap-worker.exe",
"sidecars/ffmpeg.exe"
]
}
}

Copy your dist/fapptap-worker.exe and a static ffmpeg.exe into src-tauri/sidecars/ at build time (you can script this), then call them by relative name in your code (Tauri resolves them).

Quick smoke test checklist

Run beats/shots on a small set → confirm cache/\*.json updates.

Build cutlist → verify render/cutlist.json ingest + timeline blocks appear.

Render proxy → progress bar moves smoothly; Cancel works.

App restarts → last paths remembered via Store.

Build installers → install on a clean VM; worker & ffmpeg run without Python on the machine.

Phase A — Stabilize the core

Real ffmpeg % (if not done): compute duration_s once (ffprobe/cache) and map out_time_ms/1e6 → %.

Cancel & error surfacing: you already have stop—also emit {stage, level:"error", code, msg} from Python and show a red toast/log foldout.

Preflight check (1 click): detect python, ffmpeg, NVENC availability; write results to a “System Check” card.

Safe filtergraph defaults: always normalize audio (-ar 48000 -ac 2 -c:a aac -b:a 192k) and video SAR/scale; set -movflags +faststart on MP4.

Phase B — Make the UI useful (fast)

Waveform is interactive: click to seek; drag to zoom; toggle beat markers on/off.

Timeline v0 → v1: show playhead + keyboard: J/K/L (rev/pause/play), [ ] (nudge event), B (toggle snap-to-beat), Del (delete event).

Persist prefs/paths: last song, clips dir, NVENC preset, min-dur, snap-tol (Store plugin).

Project file: save/load a tiny .fapptap.json next to assets so you can reopen a project with all settings.

Phase C — Smarter selection (drop-in scoring)

Motion/contrast scoring (OpenCV); cache per-clip. Use it to bias your round-robin.

# worker/scoring.py

import cv2, numpy as np

def score*clip(path, seconds=6, samples_per_s=8):
cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
total = int(seconds * fps)
step = max(1, int(fps / samples*per_s))
prev = None
motion_sum = 0.0; contrast_sum = 0.0; n = 0
for i in range(total):
ok, frame = cap.read()
if not ok: break
if i % step: continue
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) # contrast: variance of Laplacian
contrast_sum += cv2.Laplacian(gray, cv2.CV_64F).var() # motion: mean absolute diff
if prev is not None:
motion_sum += np.mean(cv2.absdiff(gray, prev))
prev = gray; n += 1
cap.release()
if n == 0: return {"motion": 0, "contrast": 0, "score": 0}
m = motion_sum / max(1, n-1); c = contrast_sum / n # weight motion higher
s = 0.7 * m + 0.3 \* c
return {"motion": float(m), "contrast": float(c), "score": float(s)}

Write scores to cache/scores.json and in build_cutlist.py pick from top-N by score when snapping to beats.

Phase D — Types & schemas locked (UI safety)

Schema v1 (TS + Zod) so React can’t misread files.

// src/types/schema.ts
import { z } from "zod";

export const Beat = z.object({ t: z.number(), strength: z.number().optional() });
export const Shot = z.object({ clipId: z.string(), start: z.number(), end: z.number() }); // local times (s)

export const CutEvent = z.object({
clipId: z.string(),
in: z.number().nonnegative(), // local clip time (s)
out: z.number().nonnegative(),
at: z.number().nonnegative(), // song time (s)
transition: z.enum(["cut","crossfade","speed-ramp"]).optional(),
});
export const Cutlist = z.object({
duration: z.number().positive(), // song duration (s)
events: z.array(CutEvent),
version: z.literal(1),
});

export type TBeat = z.infer<typeof Beat>;
export type TCutEvent = z.infer<typeof CutEvent>;
export type TCutlist = z.infer<typeof Cutlist>;

Use Cutlist.parse(JSON.parse(await readTextFile(...))) and show a friendly error if invalid.

Phase E — UX that feels “pro”

Command palette (Ctrl/Cmd+K): “Run Beats / Shots / Cutlist / Render”, “Open cache folder”, “Open logs”.

Toasts & retry: on failure, button in toast to open logs and re-run the failed stage.

Drag-to-slip: dragging an event changes its in/out while keeping length; hold Alt to ripple the next event.

Presets: “Proxy (540p)”, “Final (1080p)”, “Social (9:16)”. Store preset JSONs in presets/.

Phase F — Packaging & updates (once stable)

Sidecars: PyInstaller worker + static ffmpeg.exe in src-tauri/sidecars/; update tauri.conf.json > bundle.externalBin.

Updater: add Tauri Updater when you’re ready to publish (static JSON endpoint).

First-run assets: optional “Download sample project” button to test end-to-end without hunting files.

Phase G — QA checklist (fast loop)

Small 20–30s song + 6–10 clips → beats/shots/cutlist/render all pass.

Cancel mid-render; re-run works.

Break a JSON on purpose → UI surfaces the validation error, not a blank screen.

Move project folder; open via .fapptap.json → paths resolve.

PRE-FLIGHT TEST

TASK: Preflight / Health Check for Fapptap (Tauri + React + TS + Tailwind + shadcn + Python worker + FFmpeg)

GOAL

- Verify the project at C:\Files\Projects\fapptap is correctly set up and ready to run.
- Print a pass/fail checklist and a short summary with any fixes needed.

STEPS

1. Open folder: C:\Files\Projects\fapptap
2. Create folder "scripts" if missing.
3. Create file scripts\preflight.ps1 with the content below.
4. Run: powershell -ExecutionPolicy Bypass -File .\scripts\preflight.ps1
5. If any check fails, fix and re-run the script until all PASS.

FILE: scripts\preflight.ps1
---8<---
$ErrorActionPreference = "Stop"
$root = (Resolve-Path ".").Path
Write-Host "Fapptap Preflight @ $root" -ForegroundColor Cyan

function Pass($msg){ Write-Host "[PASS] $msg" -ForegroundColor Green }
function Warn($msg){ Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Fail($msg){ Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Info($msg){ Write-Host " $msg" -ForegroundColor DarkGray }

# 1) Required files & structure

$mustExist = @("package.json","tsconfig.json","index.html","src","src-tauri","src-tauri\tauri.conf.json")
$allOK = $true
foreach($p in $mustExist){
  if(Test-Path $p){ Pass "found $p" } else { Fail "missing $p"; $allOK=$false }
}
if(-not $allOK){ Warn "Fix missing files before proceeding." }

# 2) Node & pnpm

try {
$nodeVer = (& node -v) -replace 'v',''
  $nodeMajor = [int]($nodeVer.Split('.')[0])
if($nodeMajor -ge 18){ Pass "Node v$nodeVer" } else { Warn "Node v$nodeVer (>=18 recommended)" }
} catch { Fail "Node not found in PATH" ; $allOK=$false }

try {
$pnpmVer = (& pnpm -v)
  Pass "pnpm v$pnpmVer"
} catch { Fail "pnpm not found in PATH"; $allOK=$false }

# 3) Lockfiles sanity

if(Test-Path "pnpm-lock.yaml"){ Pass "pnpm-lock.yaml present" } else { Warn "pnpm-lock.yaml missing (run: pnpm install)"; $allOK=$false }
if(Test-Path "package-lock.json"){ Warn "package-lock.json present (using pnpm; safe to delete to avoid confusion)" }

# 4) Vite alias & TS paths

$viteCfg = "vite.config.ts"
if(Test-Path $viteCfg){
  $vite = Get-Content -Raw $viteCfg
  if($vite -match "alias:\s*{\s*'@':\s*path\.resolve\(\_\_dirname,\s*'src'\)\s\*}"){
Pass "Vite alias @ → src"
} else { Warn "Vite alias not found; ensure @ maps to src" }
} else { Warn "vite.config.ts missing (create with alias for @ → src)" }

$tsCfg = Get-Content -Raw "tsconfig.json" | ConvertFrom-Json
if($tsCfg.compilerOptions.baseUrl -eq "."){ Pass "tsconfig baseUrl=." } else { Warn "tsconfig baseUrl should be '.'" }
if($tsCfg.compilerOptions.paths."@/_" -contains "src/_"){ Pass "tsconfig paths @/_ → src/_" } else { Warn "tsconfig paths missing '@/_': ['src/_']" }

# 5) Tailwind scan & directives

if(Test-Path "tailwind.config.js"){
$tw = Get-Content -Raw "tailwind.config.js"
  if($tw -match "\.\/index\.html" -and $tw -match "\.\/src\/\*\*\/\*\.\{ts,tsx\}"){ Pass "Tailwind content paths ok" } else { Warn "Tailwind content should include ./index.html and ./src/**/*.ts,tsx" }
} else { Warn "tailwind.config.js not found" }
if(Test-Path "src\index.css"){
  $css = Get-Content -Raw "src\index.css"
  if($css -match "@tailwind base;" -and $css -match "@tailwind components;" -and $css -match "@tailwind utilities;"){ Pass "Tailwind directives present" } else { Warn "Add @tailwind base/components/utilities to src/index.css" }
} else { Warn "src/index.css missing" }

# 6) shadcn/ui presence

if(Test-Path "src\components\ui\button.tsx"){ Pass "shadcn components present" } else { Warn "shadcn/ui not detected (run shadcn init + add components)" }

# 7) Tauri config (name/identifier)

try{
$tauri = Get-Content -Raw "src-tauri\tauri.conf.json" | ConvertFrom-Json
  if($tauri.productName){ Pass "productName: $($tauri.productName)" } else { Warn "productName missing in tauri.conf.json" }
if($tauri.identifier){
    if($tauri.identifier -eq "com.pornaid.fapptap"){ Pass "identifier: $($tauri.identifier)" } else { Warn "identifier is '$($tauri.identifier)' (ok if intentional)" }
} else { Warn "identifier missing in tauri.conf.json" }
} catch { Warn "Unable to read tauri.conf.json: $\_" }

# 8) Rust / Tauri CLI

try { $cargoVer = (& cargo -V) ; Pass "Cargo $cargoVer" } catch { Warn "Cargo (Rust) not found; required for tauri build" }
try { $tauriCli = (& pnpm tauri -v) ; Pass "tauri CLI ok" } catch { Warn "Tauri CLI not available (pnpm add -D @tauri-apps/cli)" }

# 9) Python & worker

try { $pyVer = (& python -V) ; Pass "Python $pyVer" } catch { Warn "Python not found in PATH" }
if(Test-Path "worker\main.py" -or Test-Path "autoedit\worker\main.py"){ Pass "Python worker found" } else { Warn "Python worker entry not found (expected worker\\main.py)" }

# 10) FFmpeg & NVENC

try{
$ff = (& ffmpeg -hide_banner -version) -join "`n"
  if($ff -match "^ffmpeg version"){ Pass "FFmpeg detected" } else { Warn "FFmpeg not detected in PATH" }

# encoders

$enc = (& ffmpeg -hide_banner -encoders) -join "`n"
  if($enc -match "h264*nvenc"){ Pass "NVENC h264 available" } else { Warn "NVENC h264 not listed (install NVIDIA driver/ffmpeg with nvenc)" }
if($enc -match "hevc_nvenc"){ Pass "NVENC hevc available" } else { Info "HEVC NVENC not listed (optional)" }
} catch { Warn "FFmpeg checks failed: $*" }

# Summary

Write-Host ""
Write-Host "Preflight complete. Address any [FAIL]/[WARN] items above." -ForegroundColor Cyan
---8<---

EXPECT

- Green [PASS] for the basics, yellow [WARN] for optional/misaligned bits, red [FAIL] for missing must-haves.
- If Node/pnpm are missing or alias files are wrong, fix and rerun the script.

NOTES

- This script does not launch the GUI; it validates structure, toolchains, and config.
- After all PASS, run: pnpm run tauri dev

# SMOKE TEST

```
TASK: E2E Smoke Test — Fapptap (beats → shots → cutlist → render)

GOAL
- Create and run a **single PowerShell script** that executes the full pipeline end-to-end and prints a green/red checklist.
- The script must exit **0** when all checks pass, **non-zero** on failure.

CONTEXT
- OS: Windows
- Project root: C:\Files\Projects\fapptap
- Stack: Tauri v2 (React+TS UI), Python 3.11 worker, FFmpeg in PATH
- Worker entry: .\worker\main.py with stages: beats, shots, cutlist, render
- Cache/render outputs:
  - cache\beats.json
  - cache\shots.json
  - render\cutlist.json
  - render\proxy_preview.mp4 (or final.mp4 if proxy=0)

CONSTRAINTS
- Idempotent & Windows-safe. Do **not** modify existing app code or config.
- No global installs; rely on existing Python/FFmpeg in PATH.
- If any required info is missing, propose minimal assumptions and proceed.
- Print human-readable PASS/FAIL lines and also write a JSON report file.

DELIVERABLES
1) Create folder **scripts** under the project root if missing.
2) Create **scripts\e2e_smoke.ps1** that:
   - Accepts params: `-Song <path> -Clips <dir> [-Proxy 1|0] [-PythonPath <exe>] [-FfprobePath <exe>]`
   - Auto-detects `python` and `ffprobe` if not provided.
   - Runs worker stages in order: beats → shots → cutlist → render (proxy if `-Proxy 1`).
   - Verifies:
     - `cache\beats.json` exists and has ≥ 4 beats.
     - `cache\shots.json` exists and contains ≥ 1 clip entry.
     - `render\cutlist.json` exists, has `duration > 0` and `events.length ≥ 2`.
     - Render output exists and size > 500 KB.
     - If ffprobe available: duration of output ≥ 2s.
   - Emits lines like `[PASS] ...` / `[FAIL] ...` and **exits 1 on first failure** after printing a concise reason.
   - Saves a JSON report to **reports\e2e_smoke_report.json** with timings, counts, and any warnings.
   - Also saves a plain-text log to **logs\e2e_smoke_<timestamp>.txt**.
3) Add a short usage note to **README.md** (or create **docs\QA.md**) explaining how to run the test.

PLAN
- Detect tools (python, ffmpeg, ffprobe) and print versions.
- Run each stage, time it, and verify expected files.
- Parse JSON files (PowerShell `ConvertFrom-Json`), assert thresholds.
- If any step fails: print `[FAIL]` with cause, write report, `exit 1`.
- On success: print a summary and `exit 0`.

ACCEPTANCE TESTS
- From `C:\Files\Projects\fapptap`, running:
```

powershell -ExecutionPolicy Bypass -File .\scripts\e2e_smoke.ps1 -Song "C:\path\to\song.mp3" -Clips "C:\path\to\clips" -Proxy 1

```
should:
- Print `[PASS]` lines for every check and end with a success summary.
- Create/refresh: `cache\beats.json`, `cache\shots.json`, `render\cutlist.json`, `render\proxy_preview.mp4`.
- Create `reports\e2e_smoke_report.json` and `logs\e2e_smoke_<timestamp>.txt`.
- Exit code **0** (Cline should verify exit status).

GUARDRAILS
- Do **not** change any files outside `scripts\` (and optional docs\).
- Do **not** delete or overwrite user media; only read from `-Song` and `-Clips`.
- If `-Song` or `-Clips` are missing, **prompt in the task output** to supply them; do not guess destructive paths.
- If `worker\main.py` stage names differ, adapt the script to call the correct stages and note the change in the report.

OPTIONAL (only if user lacks test assets)
- Provide a **secondary** script `scripts\make_test_assets.ps1` that uses ffmpeg to synthesize a 12s sine-tone MP3 and 3× short color test videos, and return their paths for the smoke test.
```

If you want, I can also give you a **script-driven** version (with the full `e2e_smoke.ps1` code inlined) so you can paste once and run immediately.

TASK: E2E Smoke Test — Fapptap (beats → shots → cutlist → render)

GOAL

- Run every stage with a small test song + a handful of clips.
- Fail fast if any file is missing/empty or render looks wrong.

STEPS

1. Open folder: C:\Files\Projects\fapptap
2. Create folder scripts if missing.
3. Create file scripts\e2e_smoke.ps1 with the contents below (edit SONG and CLIPS).
4. Run: powershell -ExecutionPolicy Bypass -File .\scripts\e2e_smoke.ps1
5. If it fails, fix the printed issue and rerun until all PASS.

FILE: scripts\e2e_smoke.ps1
---8<---
$ErrorActionPreference = "Stop"

# >>>>>>>>> EDIT THESE TWO PATHS FOR YOUR TEST ASSETS <<<<<<<<<

$SONG  = "C:\Path\to\test\song.mp3"
$CLIPS = "C:\Path\to\test\clips" # a folder with a few short videos

function Pass($m){ Write-Host "[PASS] $m" -ForegroundColor Green }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red; exit 1 }
function Info($m){ Write-Host " $m" -ForegroundColor DarkGray }

# 0) Sanity

if(-not (Test-Path $SONG)){ Fail "Song not found: $SONG" }
if(-not (Test-Path $CLIPS)){ Fail "Clips dir not found: $CLIPS" }

# 1) Beats

Info "Running beats…"
$beats = & python worker\main.py beats --song "$SONG" 2>$null
$beatsFile = "cache\beats.json"
if(-not (Test-Path $beatsFile)){ Fail "Missing $beatsFile" }
$beatsJson = Get-Content -Raw $beatsFile | ConvertFrom-Json
if(-not $beatsJson.beats -or $beatsJson.beats.Count -lt 4){ Fail "Beats too few/unreadable" } else { Pass "Beats: $($beatsJson.beats.Count)" }

# 2) Shots

Info "Running shots…"
$shots = & python worker\main.py shots --clips "$CLIPS" 2>$null
$shotsFile = "cache\shots.json"
if(-not (Test-Path $shotsFile)){ Fail "Missing $shotsFile" }
$shotsJson = Get-Content -Raw $shotsFile | ConvertFrom-Json
if(-not $shotsJson -or $shotsJson.Count -lt 1){ Fail "No shots detected" } else { Pass "Clips with shots: $($shotsJson.Count)" }

# 3) Cutlist

Info "Building cutlist…"
$cut = & python worker\main.py cutlist --song "$SONG" --clips "$CLIPS" 2>$null
$cutFile = "render\cutlist.json"
if(-not (Test-Path $cutFile)){ Fail "Missing $cutFile" }
$cutJson = Get-Content -Raw $cutFile | ConvertFrom-Json
if(-not $cutJson.events -or $cutJson.events.Count -lt 2){ Fail "Cutlist has too few events" } else { Pass "Cut events: $($cutJson.events.Count)" }
if(-not $cutJson.duration -or $cutJson.duration -le 0){ Fail "Cutlist missing duration" } else { Pass "Song duration in cutlist: $($cutJson.duration)s" }

# 4) Render (proxy)

Info "Rendering proxy…"
$render = & python worker\main.py render --proxy 2>$null
$out = "render\proxy_preview.mp4"
if(-not (Test-Path $out)){ Fail "Render output missing: $out" }
$size = (Get-Item $out).Length
if($size -lt 500KB){ Fail "Render too small ($size bytes)" } else { Pass "Render exists ($([math]::Round($size/1MB,2)) MB)" }

# Optional: ffprobe duration check (if ffprobe in PATH)

try {
$probe = & ffprobe -v error -select_streams v:0 -show_entries format=duration -of default=nw=1:nk=1 "$out"
$dur = [double]::Parse($probe, [System.Globalization.CultureInfo]::InvariantCulture)
if($dur -lt 2){ Fail "Rendered duration suspicious: $dur s" } else { Pass "Rendered duration: $([math]::Round($dur,2)) s" }
} catch {
Info "ffprobe not found; skipping duration check"
}

Write-Host "`nE2E smoke test complete — all good." -ForegroundColor Cyan
---8<---

# ADVANCED BEAT DETECTION

TASK: Advanced Beat Detection v1 (librosa PLP + beat strength) for Fapptap

GOAL

- Implement higher-quality beat analysis that outputs:
  - global tempo (BPM),
  - a local tempo curve (Predominant Local Pulse / PLP),
  - per-beat strengths,
  - optional downbeats if an optional dependency is present.
- Save to cache\beats.json using a stable v1 schema.
- Keep backward compatibility with older beats.json (UI must not crash).

CONTEXT

- OS: Windows
- Project root: C:\Files\Projects\fapptap
- Worker entry: .\worker\main.py with stages: beats | shots | cutlist | render
- Current outputs: cache\beats.json, cache\shots.json, render\cutlist.json
- Frontend: React + TypeScript + Vite; already reads beats.json
- Python: 3.11; librosa installed; ffmpeg available in PATH

CONSTRAINTS

- No new required dependency for v1 (use librosa only). Downbeats are OPTIONAL:
  - If `madmom` is installed, compute downbeats; if not, skip silently.
- Must be idempotent and fast: ≤ 2.5 s processing for a ~60 s test song on a normal desktop.
- Do not rename existing stages; keep stage name "beats".
- Do not modify unrelated files (shots/cutlist/render) in this task.

DELIVERABLES

1. Add a worker module (e.g., worker\beats_adv.py) that:
   - Loads audio mono at native sr.
   - Computes onset envelope (median aggregate).
   - Runs librosa.beat.beat_track → tempo_global + beat frame indices.
   - Samples beat strengths at those frames (normalized 0..1).
   - Computes PLP tempo curve → arrays: times[], bpm[] (clip BPM to [30..240]).
   - Optionally (best-effort) compute downbeats via madmom if import succeeds.
   - Returns a dict:
     {
     "version": 1,
     "engine": "advanced" | "basic",
     "tempo_global": <number>, // BPM
     "tempo_curve": { "t": number[], "bpm": number[] }, // same length
     "beats": number[], // seconds, len >= 4
     "strength": number[], // 0..1, same length as beats
     "downbeats": number[] // OPTIONAL; only if computed
     }
2. Wire .\worker\main.py:
   - Add arg `--engine advanced|basic` (default: advanced).
   - Stage "beats" should call the advanced path by default.
   - Ensure cache\ exists; write cache\beats.json (UTF-8, compact).
   - On error (too few beats, unreadable file), print JSON error and exit non-zero.
3. Back-compat:
   - UI must tolerate older beats.json (without tempo_curve/strength/downbeats). If the UI parser is strict elsewhere, add minimal guards so it doesn’t crash.
4. Minimal docs:
   - Append a short “Beats v1” section to README or docs\QA.md explaining fields and how to switch engine (`--engine basic`).

PLAN

- Implement beats_adv.py with small helper functions:
  - compute_beats_basic(y,sr,hop) → tempo, beats[], strength[], oenv
  - compute_tempo_curve_plp(y,sr,hop) → times[], bpm[]
  - compute_downbeats_if_available(path) → downbeats[] | None
- main.py:
  - parse --engine; call advanced unless "basic".
  - write beats.json and emit JSONL progress messages: {stage:"beats", progress:x, msg?:string}
- Keep timing simple: measure total seconds and log it.

ACCEPTANCE TESTS
(Use a ~60 s test song.)

A) CLI behavior

- Run: `python .\worker\main.py beats --song "<ABS_PATH_TO_SONG>"`
  EXPECT:
  - exit code 0
  - file cache\beats.json exists and parses

B) Schema & ranges

- beats.length ≥ 4
- strength.length == beats.length; 0.0 ≤ strength[i] ≤ 1.0
- tempo_curve.bpm.length == tempo_curve.t.length ≥ 8
- 30 ≤ tempo_global ≤ 240

C) Sanity (approximate count vs tempo)

- Let expected ≈ duration_seconds \* tempo_global / 60.
  Relative error ≤ 0.25 (warn if higher but do not fail).

D) Optional downbeats

- If madmom available: beats.json contains "downbeats" and it’s a subset of beats.
- If not available: no "downbeats" key and stage still passes.

E) Performance

- For ~60 s audio, elapsed ≤ 2.5 s on desktop (informative; warn if slower).

GUARDRAILS

- Don’t modify other stages or UI components in this task.
- Don’t add required dependencies; madmom must be optional and try/except guarded.
- If audio too short or unreadable: emit a helpful error message and non-zero exit.

FOLLOW-UPS (separate tasks, do not do now)

- UI: Engine selector + waveform overlays for beats/downbeats/tempo_curve.
- E2E smoke test update to assert new fields when present.

# Task A — Beat Offset Calibration (click-track ground truth)

TASK: Beat Offset Calibration with Synthetic Click Track

GOAL

- Measure and auto-correct systematic beat timing offset (ms) so detected beats align with audio transients.

CONTEXT

- Root: C:\Files\Projects\fapptap
- Worker: .\worker\main.py (beats stage exists; advanced engine available)
- Tools: Python 3.11, ffmpeg in PATH, librosa

CONSTRAINTS

- Non-destructive; add calibration as an optional subcommand or flag (--calibrate)
- Write results to cache\beats_calibration.json and apply offset in beats output only if enabled

DELIVERABLES

- Script to synthesize a 30–60 s test tone + click track (ffmpeg) with exact BPM (e.g., 120 BPM)
- Calibration routine:
  1. Run beats on the synthetic file
  2. Compute mean signed error to the ideal grid (in ms)
  3. Save {"bpm":120,"offset_ms":<number>,"rms_error_ms":<number>} to cache\beats_calibration.json
- Add optional flag to beats stage: --apply-calibration (shifts detected beats by offset_ms)

ACCEPTANCE TESTS

- On the synthetic click track, rms_error_ms ≤ 25 ms after applying calibration
- beats.json aligns (first beat error within ±25 ms; stays ≤ 30 ms mid-file)
- Calibration is skipped gracefully on real songs if synthetic asset is absent

GUARDRAILS

- Do not modify shots/cutlist/render behavior
- Calibration must be opt-in (no surprises on existing projects)

# Task B — HPSS + Transient Emphasis (cleaner onset envelope)

TASK: HPSS Preprocessing + Transient Emphasis for Onset Strength

GOAL

- Improve beat detection robustness by separating percussive content (HPSS) and emphasizing transients before computing onset envelope.

CONTEXT

- Worker uses librosa for beats
- Existing beats.json v1 schema stays the same

CONSTRAINTS

- No new heavy deps; librosa HPSS only
- Keep runtime overhead < +25%

DELIVERABLES

- In advanced engine, add:
  - librosa.effects.hpss(y): use percussive component for onset envelope
  - transient emphasis chain (e.g., highpass + spectral whitening) before onset_strength
- Emit extra debug fields in beats.json (under a "debug" key) only when --debug:
  {"hpss":"percussive","oenv_peak":<float>,"oenv_mean":<float>}

ACCEPTANCE TESTS

- On a drum-heavy sample: increases beat strength median by ≥15% vs baseline
- On a pad/ambient sample: false positives reduce (subjective check logged)
- Processing time increase ≤ 25%

GUARDRAILS

- Default behavior unchanged unless engine=advanced

# Task C — Tempo Drift Handling (PLP smoothing + DP snapping)

TASK: Local Tempo Smoothing + Dynamic Programming Beat Snapping

GOAL

- Make beats stable under tempo drift: follow PLP tempo curve but snap to strongest nearby onsets.

CONTEXT

- Advanced beats already compute PLP tempo curve (times[], bpm[])

CONSTRAINTS

- Keep O(n) or near-linear; avoid crazy memory
- No new required deps

DELIVERABLES

- Generate an initial grid from tempo_curve (convert BPM→inter-beat-interval)
- For each predicted beat time, search a ±60 ms window and snap to the local onset maximum
- Apply DP/greedy cost function: penalize large interval deviations and low onset energy
- Output final beats[] and strength[] (after snap)

ACCEPTANCE TESTS

- On synthetic tempo-ramp (e.g., 100→130 BPM over 30 s), relative count error ≤ 10%
- Average snap distance ≤ 25 ms; no double-beats within 120 ms

GUARDRAILS

- If tempo_curve missing, fall back to existing method

# Task D — Beat Confidence, Pruning & Filling

TASK: Beat Confidence Scoring + Prune/Fill Postprocess

GOAL

- Add per-beat confidence and clean the grid: drop low-confidence beats and fill obvious gaps.

CONTEXT

- beats.json v1 currently has strength; extend with confidence ∈ [0..1]

CONSTRAINTS

- Backward compatible: "confidence" is optional
- No heavy deps

DELIVERABLES

- Confidence = normalized blend of (onset peak z-score, local SNR, interval deviation penalty)
- Prune beats with confidence < threshold (default 0.2)
- Fill single missing beats if two neighbors suggest a stable interval (±8%)
- Update beats.json: add "confidence":[...]; write "pruned":N, "filled":M in debug when --debug

ACCEPTANCE TESTS

- On noisy sample, reduces extra beats by ≥20% without decreasing true positives on click track
- beats.length change explained in logs (pruned/filled counts)

GUARDRAILS

- Threshold configurable via CLI (--conf-thresh)

# Task E — Optional Downbeats (madmom-gated) + Bars

TASK: Optional Downbeat Detection (gated) and Bar Indexing

GOAL

- If madmom is installed, add downbeats[] and bars[]; otherwise skip.

CONTEXT

- Windows; Python 3.11; advanced beats engine

CONSTRAINTS

- Optional import; never fail if missing
- Target 3/4 and 4/4; simple fallback heuristics allowed

DELIVERABLES

- Try/except import madmom; run downbeat tracking
- Write downbeats[] (seconds) and bars[] as integers aligned to beats indices (every 4th beat for 4/4 baseline if model absent)
- Log whether madmom path was used

ACCEPTANCE TESTS

- With madmom: downbeats count ≈ beats/4; first downbeat aligns within ±70 ms on click track with 4/4 accent
- Without madmom: bars[] still produced via heuristic; downbeats omitted or heuristic depending on design choice (documented)

GUARDRAILS

- No required changes to UI in this task

## Task F — Genre Presets & Tempo Range Prior

TASK: Genre Presets (Tempo Range + Beat Divisors) and Prior

GOAL

- Let user select a genre preset to bias tempo range and divisors (half/double time) for better tracking.

CONTEXT

- UI already stores prefs; worker accepts flags

CONSTRAINTS

- No new UI components required here; accept CLI flags first

DELIVERABLES

- Add CLI flags: --tempo-min, --tempo-max, --divisors "0.5,1,2"
- Implement preset mapping (e.g., EDM 118–132, Hip-Hop 80–100, Rock 90–160) in a small JSON preset file
- Advanced engine uses range to constrain tempo estimates and tries divisors if confidence low

ACCEPTANCE TESTS

- On half-time tracks (real or synthetic), correct tempo selected with preset active
- Beats grid stable when switching presets; log chosen divisor

GUARDRAILS

- Sensible defaults when flags not provided

# Task G — Feature Cache & Profiling (speed)

TASK: STFT/Onset Feature Cache + Profiling

GOAL

- Speed up repeated analyses by caching costly features and add simple profiling.

CONTEXT

- cache\ folder exists

CONSTRAINTS

- Cache keyed by (audio file hash, engine version, params)
- Avoid stale caches if file changes

DELIVERABLES

- Compute audio hash (size+mtime+sha1 of first/last N KB)
- Cache features to cache\features\<hash>.npz: STFT, onset envelope, HPSS percussive
- Add --profile flag to log stage timings (I/O, STFT, HPSS, PLP, snap)

ACCEPTANCE TESTS

- Second run on same audio at least 2× faster
- Cache invalidates if audio file modified

GUARDRAILS

- Keep cache files < ~20–50 MB per track

# Task H — Evaluation Harness (regression tests)

TASK: Beat Evaluation Harness + Regression Tests

GOAL

- Provide automated metrics and a small test corpus to catch regressions.

CONTEXT

- Windows, Python 3.11, ffmpeg in PATH

CONSTRAINTS

- No external datasets required; generate synthetics plus allow user to drop a few real tracks with hand-labeled beats

DELIVERABLES

- scripts\make_synth_beats.py: generate click tracks at multiple BPMs + ramps
- scripts\eval_beats.py:
  - runs worker beats on each audio
  - computes MAE (ms), F-measure within 70 ms tolerance, count error
  - writes reports\beats_eval.json and a CSV with metrics
- PowerShell wrapper scripts to run eval on the corpus

ACCEPTANCE TESTS

- On synth corpus, F-measure ≥ 0.95 and MAE ≤ 25 ms
- Running twice yields identical metrics (deterministic)

GUARDRAILS

- Do not commit large audio; synthesize or keep tiny clips

# Task I — Beat-Warp Map (optional, for later)

TASK: Beat Warp Map Export (time ↔ beat index mapping)

GOAL

- Export a mapping that converts any song time to nearest beat/bar indices and phase ∈ [0..1] for effects sync.

CONTEXT

- Advanced engine with final beats[] available

CONSTRAINTS

- JSON must be compact; derive at read time if needed

DELIVERABLES

- Write render\beat_warp.json:
  { "beats": [...], "bars": [...?], "bpm_global": <>, "map_version": 1 }
- Provide a small helper in worker or UI utils to query:
  time → {beatIndex, barIndex?, phase, nextBeatTime}

ACCEPTANCE TESTS

- Querying random times returns non-decreasing indices
- Phase wraps to 0 at each beat within ±10 ms

GUARDRAILS

- Pure addition; no changes to other stages

# UI DESIGN

---

## Task 1 — App Shell & Layout Refresh

**GOAL**
Establish a clean, modern shell: sticky top bar, two-column layout (sources/tools vs stages), consistent spacing/typography, and a subtle background so content pops.

**CONTEXT**
Tauri v2 + React/TS + Vite + Tailwind v4 + shadcn/ui. Import alias `@` → `src`. Store plugin already in use.

**CONSTRAINTS**

- Keep Tailwind utility approach; use shadcn components for structure.
- No breaking changes to stage actions or worker wiring.
- Responsive: ≥1280px gets two columns; below stacks vertically.

**DELIVERABLES**

- Top bar with app name + small tagline; right side shows current render status badge.
- Page grid: left column “Project Sources” + controls; right column the four stage cards.
- Subtle dark background (radial/gradient or noise); content cards retain contrast.
- Typography scale (title, h2, body) applied consistently.

**ACCEPTANCE TESTS**

- Layout remains stable across 1280px → 1920px; no horizontal scroll.
- Stage cards align and share a baseline; tab-order sensible (keyboard only).
- Lighthouse a11y ≥ 90 in dev (color contrast, labels).

**GUARDRAILS**

- Don’t change business logic or worker calls.
- Keep CSS inside Tailwind; no global resets beyond what’s needed.

---

## Task 2 — Stage Cards: Status, Progress, Actions

**GOAL**
Unify Beats/Shots/Cutlist/Render as “cards” with clear status, progress, and primary action.

**CONTEXT**
Events already stream JSONL; you track per-stage `status`/`progress`.

**CONSTRAINTS**

- Use shadcn `Card`, `Progress`, `Badge`, `Button`.
- No inline magic numbers: expose small tokens/vars for spacing and colors.

**DELIVERABLES**

- Each card shows: icon, title, 1-line description, status badge (Idle/Running/Done/Error), progress bar + % label, “Run” button (disabled while running).
- “Run All (Proxy)” button in Sources triggers beats→shots→cutlist→render and rolls statuses.

**ACCEPTANCE TESTS**

- Running a stage updates progress smoothly (≥10 updates per minute).
- On error, badge turns “Error”, button becomes “Retry”, and a toast appears with the last line of stderr.
- Keyboard: `Enter` on focused card triggers “Run”.

**GUARDRAILS**

- No dialogs for happy-path; errors use toast + log section.

---

## Task 3 — Source Pickers + Engine Selector (Persisted)

**GOAL**
Make “Music Track”, “Clips Directory”, and “Beat Engine (basic/advanced)” obvious, persistent, and validated.

**CONTEXT**
Store plugin exists; dialog plugin available.

**CONSTRAINTS**

- Persist to `.fapptap.dat` keys: `song`, `clips`, `beatEngine`.
- Validate existence on “Run” and surface friendly messages.

**DELIVERABLES**

- Two inputs with “Browse” buttons: audio and directory.
- Engine selector (basic/advanced).
- Disabled “Run All” until both paths valid.

**ACCEPTANCE TESTS**

- Relaunch restores last values.
- Invalid path shows inline warning and disables actions.
- Switching engine passes `--engine` flag into worker.

**GUARDRAILS**

- No path normalization that breaks UNC/network paths.

---

## Task 4 — Waveform Panel with Overlays

**GOAL**
Visual feedback: waveform with beat markers (strength-tinted), optional downbeats (thicker), and a tempo curve overlay.

**CONTEXT**
WaveSurfer is acceptable; `beats.json` v1 has `beats`, `strength`, optional `downbeats`, optional `tempo_curve`.

**CONSTRAINTS**

- Keep overlays performant: one canvas overlay, not thousands of DOM nodes.
- Don’t block UI while loading large audio.

**DELIVERABLES**

- Waveform with zoom and click-to-seek.
- Amber vertical lines for beats; thicker rose lines for downbeats; thin blue polyline for tempo curve.
- Tiny legend/caption; toggle overlays on/off.

**ACCEPTANCE TESTS**

- Rendering ≤ 16 ms per overlay pass on a 3-min song (no visible jank).
- Toggling overlays is instant; no memory leaks on song reload.

**GUARDRAILS**

- Fail gracefully if `beats.json` is old (missing fields) — no crashes.

---

## Task 5 — Transport + Playhead Sync (Waveform ↔ Timeline)

**GOAL**
Add Play/Pause (button + J/K/L), nudge `[` `]`, and a playhead in the timeline synced to the waveform time.

**CONTEXT**
WaveSurfer controls playback; Pixi timeline exists.

**CONSTRAINTS**

- Single source of truth for current time (WaveSurfer).
- Timeline redraw must be light; only the playhead moves on rAF.

**DELIVERABLES**

- Transport component with Play/Pause; hotkeys J (−0.5s), K (toggle), L (play), `[`/`]` (±50 ms).
- Timeline draws a playhead line that follows current time; optional timecode readout.

**ACCEPTANCE TESTS**

- Start/stop shows <50 ms drift between audio and playhead over 60 s playback.
- Keyboard works with focus on the page (not in inputs).

**GUARDRAILS**

- Don’t block future timeline editing; keep the playhead code modular.

---

## Task 6 — Log & Error Surface

**GOAL**
Human-readable logs with quick context: last 500 lines, sticky scroll, copy button, and toast summaries.

**CONTEXT**
You already capture `onLine` from worker.

**CONSTRAINTS**

- No mega virtualized list; a simple capped buffer is fine.
- Avoid blocking main thread.

**DELIVERABLES**

- Log card: rolling buffer, mono font, “Copy” and “Clear” actions.
- Errors raise toast with a “View Logs” action that scrolls to newest.

**ACCEPTANCE TESTS**

- 10k lines streamed over a long render never freeze the UI; buffer stays capped.
- “Copy” copies only visible buffer, not the entire history.

**GUARDRAILS**

- Don’t persist logs to Store; that’s later.

---

## Task 7 — Visual Polish Pass (tokens + micro-interactions)

**GOAL**
Bring cohesion: spacing scale, rounded radii, focus rings, hover states, and consistent iconography.

**CONTEXT**
Tailwind v4, shadcn.

**CONSTRAINTS**

- No custom CSS frameworks; use Tailwind utilities + a few CSS vars.
- Respect reduced-motion preferences.

**DELIVERABLES**

- Design tokens (spacing, radius, shadow, brand gradient) defined centrally.
- Subtle hover/press states on buttons/cards; focus outlines accessible.
- Replace any mismatched icons with lucide equivalents; consistent sizes.

**ACCEPTANCE TESTS**

- Keyboard focus visible on all interactive elements.
- No layout shift on hover/press.

**GUARDRAILS**

- Don’t ship big asset files; keep the app lean.

---

### Recommended order to queue

1. **Task 1** (Shell/Layout)
2. **Task 2** (Stage Cards)
3. **Task 3** (Pickers + Engine)
4. **Task 4** (Waveform Overlays)
5. **Task 5** (Transport + Playhead)
6. **Task 6** (Logs)
7. **Task 7** (Polish)

If you want, say the word and I’ll add **two more** UI tasks in this style for **Timeline v1 editing (snap-to-beat, delete, ripple)** and a **System Check panel**—both ready to paste for your agent.
