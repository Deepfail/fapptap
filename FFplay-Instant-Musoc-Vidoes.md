Agent Brief — Auto-Create (Beat-Driven Montage & Effects) — Single Window

Objective

Implement Auto-Create: a mode that generates a full, beat-synchronized montage preview in real time. The user selects effects and an intensity preset (Low/Med/High). The system places effects and cuts on beats derived from analyzed audio (tempo, beats, strengths). Results are shown inside the existing main window with a smooth live preview and can be committed to the render pipeline.

Environment & Assumptions
	•	Desktop app: Tauri v2 (single WebView window only).
	•	Plugins available: shell, dialog, fs (and Store if already enabled).
	•	Sidecars: binaries/worker, binaries/ffmpeg, binaries/ffprobe (consistent names in tauri.conf.json externalBin, capability allow-list, and Command.sidecar() calls).
	•	Existing app pieces:
	•	beats.json produced by the pipeline (with tempo, beats[{ t, strength }], optional tempoCurve).
	•	Library pane (pick audio/video), Preview pane (video + overlays), Timeline strip (markers).
	•	runWorker, runFfmpeg helpers for sidecars.

Inputs
	•	Audio analysis: cache/beats.json
	•	beats: Array<{ t: number; strength?: number }> in seconds, strength ∈ [0..1]
	•	tempo?: number, tempoCurve?: Array<{ t: number; bpm: number }>
	•	User config (from UI, right pane):
	•	selectedEffects: EffectId[]
	•	intensityPreset: "low" | "med" | "high"
	•	seed: number (deterministic)
	•	respectShotBoundaries: boolean (snap cuts to shot edges if shots.json available)

Outputs
	•	In-memory preview events (immediate): EffectEvent[], CutEvent[] rendered over the existing video/timeline.
	•	Commit to cutlist: write render/cutlist.json with segments and effect metadata (non-breaking extension).
	•	Undoable/re-rollable generation (same seed → same result).

Single-Window Hard Constraints
	•	No new windows. Do not call WebviewWindow.create, new WebviewWindow, or window.open. All UI must render inside the current main window.
	•	Heavy work runs via sidecars, with progress fed back to the same window.
	•	For config UI, use in-place panels or DOM overlays (shadcn Dialog/Sheet), not separate WebViews.

Minimal UI/UX Placement
	•	Left (Library): pick media (already done).
	•	Center (PreviewPane): video element with beat markers and effect badges; live proxies for effects during playback.
	•	Right (ActionsPane):
	•	Effect checklist (Flash, Punch-In, Glitch, Strobe, Speed-Ramp, Cut-On-Beat).
	•	Intensity radio: Low / Med / High.
	•	Seed (number) + buttons: Generate (Beat-Sync), Re-roll, Clear, Commit to Cutlist.
	•	Progress rows while sidecars run (if used).
	•	Bottom strip: timeline markers (beats/effects/cuts).

Data Models (TypeScript)

export type Beat = { t: number; strength?: number };

export type EffectId =
  | "flash"
  | "punchIn"
  | "glitch"
  | "strobe"
  | "speedRamp"
  | "cutOnBeat";

export type Intensity = "low" | "med" | "high";

export type EffectEvent = {
  id: EffectId;
  at: number;             // seconds in song time
  dur?: number;           // seconds
  params?: Record<string, number | string | boolean>;
  confidence?: number;    // 0..1 (strength/spacing derived)
};

export type CutEvent = {
  at: number;             // seconds in song time
  snapToShot?: boolean;
};

export type AutoCreateResult = {
  effects: EffectEvent[];
  cuts: CutEvent[];
  seed: number;
  preset: Intensity;
};

Presets → Density & Spacing (baseline)
	•	Low: minStrength ≥ 0.7; minSpacing ~1.0 s; baseProb low.
	•	Med: minStrength ≥ 0.5; minSpacing ~0.5–0.75 s; baseProb medium.
	•	High: minStrength ≥ 0.3; minSpacing ~0.25–0.5 s; baseProb high.

Per-effect typicals (agent can tune):
	•	flash: dur ~0.08–0.12s
	•	punchIn: dur ~0.3–0.5s; scale 1.05–1.15
	•	glitch: dur ~0.12–0.2s; small RGB split/jitter
	•	strobe: dur ~0.2–0.4s; opacity pulses
	•	speedRamp: dur ~0.4–0.8s; 0.75× → 1.25× arc
	•	cutOnBeat: stride support (every Nth beat), snap to shots if enabled

Scheduler (deterministic, beat-first)

Pseudocode sketch—agent may implement in TS or move logic to the worker (returning JSON):

function scheduleAutoCreate({
  beats, preset, selectedEffects, seed, shots
}): AutoCreateResult {
  const rng = makeRng(seed);
  const cfg = presetConfig(preset);        // global + per-effect params

  const effects: EffectEvent[] = [];
  const cuts: CutEvent[] = [];

  const shotIndex = shots ? buildShotIndex(shots) : null;

  for (const effect of selectedEffects) {
    if (effect === "cutOnBeat") continue;  // handled below
    const eCfg = merge(cfg.global, cfg.effects[effect]);
    let lastAt = -Infinity;

    for (const b of beats) {
      const s = b.strength ?? 0.5;
      if (s < eCfg.minStrength) continue;
      if (b.t - lastAt < eCfg.minSpacingSec) continue;

      const p = eCfg.baseProb * (0.5 + 0.5 * s);
      if (rng() < p) {
        const ev = makeEffectEvent(effect, b.t, s, eCfg, rng);
        effects.push(ev);
        lastAt = ev.at;
      }
    }
  }

  // Cut scheduling (stride or strong-beat rule)
  if (selectedEffects.includes("cutOnBeat")) {
    const stride = cfg.cutStride; // 1, 2, 4...
    for (let i = 0; i < beats.length; i += stride) {
      const b = beats[i];
      if ((b.strength ?? 0.5) >= cfg.cutMinStrength) {
        cuts.push({ at: b.t, snapToShot: true });
      }
    }
  }

  // De-conflict: remove events closer than 150 ms, keep higher confidence
  const dedupedEffects = resolveCollisions(effects, 0.15);

  // Optional snap cuts to nearest shot boundary
  const finalCuts = shotIndex
    ? cuts.map(c => ({ ...c, at: snapToShotBoundary(shotIndex, c.at) }))
    : cuts;

  return { effects: dedupedEffects, cuts: finalCuts, seed, preset };
}

Notes
	•	Handle tempo drift: if tempoCurve exists, weight selection around local BPM (e.g., local spacing).
	•	Confidence = f(beat strength, effect priority, spacing).
	•	Use a simple seeded RNG (LCG/xoshiro) for reproducibility.

Live Preview (in the same window)
	•	Render lightweight visual proxies at event times:
	•	flash: white overlay div with opacity fade.
	•	punchIn: CSS scale transform in/out.
	•	glitch: tiny translateX/clip “jitter”, optional channel split overlay.
	•	strobe: opacity pulses (CSS transitions).
	•	speedRamp: adjust HTMLVideoElement.playbackRate briefly (clamp for preview).
	•	Keep PreviewPane at 60fps; any heavier look should defer to final render.

Final Render Mapping (worker → ffmpeg)

Worker translates EffectEvent → filtergraph:
	•	flash → eq (brightness/contrast) or overlay white with blend
	•	punch-in → scale+crop keyed over t or zoompan
	•	glitch → small RGB split via lutrgb/tblend/overlays
	•	strobe → timed blend pulses
	•	speedRamp → setpts + atempo on segments
	•	cutOnBeat → build segment list at beat times (respect stride & snapping)

Integration Points

Frontend (single window only)
	•	ActionsPane:
	•	onGenerate(): load beats.json; call scheduler (TS module or worker mode); dispatch effects/cuts to the store.
	•	onReroll(): change seed; regenerate.
	•	onClear(): clear events in store.
	•	onCommit(): convert current effects/cuts to cutlist segments + meta; write via plugin-fs.
	•	PreviewPane: subscribes to store; draws overlays/proxies in sync with playback (no new windows).

Worker (new CLI mode, optional but preferred)

Add a subcommand:

worker auto-create \
  --beats cache/beats.json \
  --preset med \
  --effects flash,punchIn,glitch,strobe,speedRamp,cutOnBeat \
  --seed 1337 \
  --shots cache/shots.json? \
  --out cache/auto_create.json

Output = AutoCreateResult. Frontend can call via sidecar and then render events live.

Performance & State Guidelines
	•	Keep scheduling O(n) over beats; avoid heavy per-frame work on the main thread.
	•	Use a global store slice: timeline.effects, timeline.cuts, autoCreate.settings.
	•	Debounce UI changes where needed; long work → sidecars with streaming progress.
	•	Deterministic: same (beats, preset, effects, seed) → same result.

Acceptance Criteria
	1.	Generate with multiple effects and any preset produces visible, beat-aligned events across the full track.
	2.	Live preview reflects effects/cuts in the current PreviewPane (no new windows).
	3.	Deterministic results with identical seed.
	4.	Commit produces a valid cutlist.json used by the existing render pipeline; final video shows scheduled effects at correct times.
	5.	Performance: interactive playback; no noticeable stutter in the UI.

Edge Cases
	•	Weak/few beats → fall back to downbeats or tempo grid; toast a soft warning.
	•	Short clips or sparse library → stride up cuts, relax spacing slightly.
	•	Missing shots.json → skip snap; proceed with beat times.

Deliverables Checklist
	•	src/autoCreate/scheduler.ts (pure TS, deterministic; unit tests for seeds).
	•	ActionsPane wiring: controls, buttons, progress, toasts.
	•	Preview overlays for proxies; timeline markers for events.
	•	Commit-to-cutlist writer (non-breaking JSON extension for effects).
	•	Optional: worker subcommand + JSON I/O + progress.

Starter Stubs (optional)

Scheduler module

// src/autoCreate/scheduler.ts
import type { Beat, EffectId, Intensity, AutoCreateResult, EffectEvent, CutEvent } from "./types";

export function scheduleAutoCreate(args: {
  beats: Beat[];
  selectedEffects: EffectId[];
  preset: Intensity;
  seed: number;
  shots?: Array<{ start: number; end: number }>;
}): AutoCreateResult {
  // implement the pseudocode above
  return { effects: [], cuts: [], seed: args.seed, preset: args.preset };
}

ActionsPane handlers (sketch)

async function onGenerate() {
  const beats = await loadBeatsJson();
  const res = scheduleAutoCreate({ beats, selectedEffects, preset, seed, shots });
  store.setState({ timeline: { effects: res.effects, cuts: res.cuts } });
}
function onCommit() {
  const { cuts, effects } = store.getState().timeline;
  const cutlist = toCutlistJson(cuts, effects);
  await fsWrite("render/cutlist.json", JSON.stringify(cutlist, null, 2));
}


⸻
