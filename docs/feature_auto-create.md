## Agent Brief — “Auto-Create” (Beat-driven effects & cuts)

## Objective

Implement an **Auto-Create** mode that generates a full, beat-synchronized montage preview in real time. The user chooses a set of effects and an intensity preset (Low/Med/High). The system places effects/cuts **on beats** based on the analyzed audio (tempo, beats, strengths), renders an interactive, high-quality **live preview**, and can export the result to the existing render pipeline.

## Inputs (existing / to use)

- cache/beats.json (already produced by our worker):
- beats: Array<{ t: number; strength?: number }> (seconds; strength ∈ [0,1])
- Optional: tempo, tempoCurve
- Selected **audio** and a **clip library** (already in UI).
- User config from UI:
- selectedEffects: string[]
- intensityPreset: "low" | "med" | "high"
- seed: number (deterministic randomness)
- respectShotBoundaries: boolean (true = snap cuts to scene boundaries when available)

## Outputs

- **Preview timeline events** (in-memory; shown instantly):
  EffectEvent[] and CutEvent[] layered over the central timeline/preview.
- **Commit-to-cutlist** option:
- Writes render/cutlist.json segments + effect annotations (non-destructive; keep JSON backward compatible).
- **Undoable** generation (re-roll with new seed/preset).

## Constraints & Behavior

- All placements are **beat-driven**; prefer higher strength beats.
- Enforce **cooldowns** per effect to avoid visual spam (e.g., ≥ 250–500 ms apart).
- Support **tempo drift** via tempoCurve if present; otherwise use static tempo.
- **Real-time preview** must remain smooth (60fps target). Heavy effects fall back to lightweight preview approximations; full quality in final ffmpeg render.
- **Deterministic** with the same seed, preset, and beats.

⸻

## UI/UX (minimal)

- In **ActionsPane** (right panel):
- Effect checklist (Flash, Punch-In, Glitch, Strobe, Speed-Ramp, Cut-On-Beat).
- Intensity preset radio (Low / Med / High).
- “Generate (Beat-Sync)” button → computes events and shows them live.
- “Re-roll” (new seed), “Clear”, “Commit to Cutlist”.
- In **Preview**:
- Beat markers (already present or add).
- Effect badges overlaid at event times.
- Playback reflects effects (approximate preview paths below).

⸻

## Data Models (TS)

_// Core_
export type Beat = { t: number; strength?: number };

_// Effect system_
export type EffectId =
| "flash" | "punchIn" | "glitch" | "strobe" | "speedRamp" | "cutOnBeat";

export type Intensity = "low" | "med" | "high";

export type EffectEvent = {
id: EffectId;
at: number; _// seconds (absolute in song)_
dur?: number; _// seconds_
params?: Record<string, number | string | boolean>;
confidence?: number; _// 0..1 (derived from beat strength, spacing)_
};

export type CutEvent = {
at: number; _// seconds (absolute)_
snapToShot?: boolean;
};

export type AutoCreateResult = {
effects: EffectEvent[];
cuts: CutEvent[];
seed: number;
preset: Intensity;
};

⸻

## Preset → density & spacing (baseline)

- **Low**: sparse; only strong beats (strength ≥ 0.7), min spacing ~1.0 s.
- **Med**: moderate; strength ≥ 0.5, min spacing ~0.5–0.75 s.
- **High**: dense; any beat, strength weight applied, min spacing ~0.25–0.5 s.

Additionally per-effect multipliers (agent can tune):

- flash: short burst (dur ~0.08–0.12s)
- punchIn: dur ~0.3–0.5s; scale 1.05–1.15
- glitch: dur ~0.12–0.2s; RGB split/scanline jitter
- strobe: dur ~0.2–0.4s; opacity pulse(s) across 2–3 frames
- speedRamp: dur ~0.4–0.8s; 0.75× → 1.25× arc
- cutOnBeat: exact beat cut; optional stride (every 2nd/4th beat)

⸻

## Scheduling Engine (worker or frontend module)

### Inputs

- beats: Beat[], preset: Intensity, selectedEffects: EffectId[], seed, optional shots[].

### Algorithm sketch (deterministic):

function scheduleAutoCreate({
beats, preset, selectedEffects, seed, shots
}): AutoCreateResult {
const rng = makeRng(seed);
const cfg = presetConfig(preset); _// spacing, minStrength, per-effect density_

const effects: EffectEvent[] = [];
const cuts: CutEvent[] = [];

_// pre-index shots into intervals if snapToShot enabled_
const shotIndex = shots ? buildShotIndex(shots) : null;

_// choose a subset of beats for each effect via weighted sampling_
for (const effect of selectedEffects) {
const eCfg = mix(cfg.global, cfg.effects[effect]);
let lastAt = -Infinity;

    for (const b of beats) {
      if (b.strength === undefined) b.strength = 0.5;
      if (b.strength < eCfg.minStrength) continue;
      if (b.t - lastAt < eCfg.minSpacingSec) continue;

      *// probabilistic admit based on strength & density*
      const p = eCfg.baseProb * (0.5 + 0.5 * b.strength);
      if (rng() < p) {
        const ev = makeEffectEvent(effect, b, eCfg, rng);
        effects.push(ev);
        lastAt = ev.at;
      }
    }

}

_// Cuts (often stride-based): every Nth beat or strong beats only_
if (selectedEffects.includes("cutOnBeat")) {
const stride = cfg.cutStride; _// e.g., 1=every, 2=every other_
for (let i = 0; i < beats.length; i += stride) {
if (beats[i].strength! >= cfg.cutMinStrength) {
cuts.push({ at: beats[i].t, snapToShot: true });
}
}
}

_// Resolve collisions / enforce global spacing_
const deduped = resolveCollisions(effects, */*globalMinSpacing=*/*0.15);

_// Optional snapping_
const snappedCuts = shotIndex
? cuts.map(c => ({ ...c, at: snapToShotBoundary(shotIndex, c.at) }))
: cuts;

return { effects: deduped, cuts: snappedCuts, seed, preset: cfg.name };
}

**Collision rules**: If two events fall within 150 ms, keep the one with higher confidence (derived from beat strength and effect priority).
**Randomness**: makeRng(seed) → stable LCG or xoshiro.

⸻

## Live Preview strategy

- **PreviewPane**:
- Overlay event badges & minimal visual proxies:
- flash: screen white overlay fade (CSS opacity)
- punchIn: CSS scale (transform) easing in/out
- glitch: CSS offset/chromatic aberration (approx), small jitter
- strobe: opacity pulses
- speedRamp: playbackRate ramp (clamped for preview)
- **Final render**:
- Map each event to **ffmpeg filtergraph** (worker translates):
- flash → eq=brightness=…:contrast=…
- punchIn → zoompan or scale+crop keyframes
- glitch → subtle tblend, lut3d/RGB split with crop+overlay
- strobe → blend=all_mode=addition:opacity=… pulses
- speedRamp → setpts+atempo segments
- The preview is allowed to be **approximate** to keep 60fps; fidelity is guaranteed in render.

⸻

## Integration points

### Frontend (ActionsPane)

- generateAutoCreate():
- Load beats.json
- Call scheduleAutoCreate(...) (in worker via sidecar or a TS module)
- setTimelineEffects(events) + setTimelineCuts(cuts)
- “Commit to Cutlist”:
- Convert cuts into cutlist segments (respect clip map) and write render/cutlist.json
- Attach effects array per segment in cutlist (non-breaking: use meta.effects)

### Worker (CLI)

Add a mode:

worker.exe auto-create \
 --beats path/to/beats.json \
 --preset med \
 --effects flash,punchIn,glitch,cutOnBeat \
 --seed 1337 \
 --out cache/auto_create.json

- Output schema = AutoCreateResult.

⸻

## Acceptance Criteria

    1.	**Generate** with Low/Med/High and at least 4 effects produces a full timeline with events placed **on beats**.
    2.	**Live preview** shows visible proxies (flash, punch-in, etc.) synchronized while playing.
    3.	**Deterministic**: same seed → identical events.
    4.	**Performance**: preview stays interactive (no long main-thread stalls).
    5.	**Commit** writes a valid cutlist.json; final render applies the scheduled effects at correct times.

⸻

## Edge cases

- No/weak beats → fall back to downbeats or regular grid at tempo; show a warning toast.
- Very short clips → stride up selection, relax spacing.
- Tempo drift → use tempoCurve if available; otherwise, global tempo.
- Overlapping effects → collision resolver ensures minimum separation.

⸻

## Minimal scaffolding (you can generate)

**TS module** src/autoCreate/scheduler.ts

export function scheduleAutoCreate(args: {
beats: Beat[];
selectedEffects: EffectId[];
preset: Intensity;
seed: number;
shots?: Array<{ start: number; end: number }>;
}): AutoCreateResult { _/_ implement sketch above _/_ }

**UI wire** (ActionsPane handlers)

- onGenerate() → call scheduler; push to store.
- onReroll() → new seed; regenerate.
- onCommit() → convert to cutlist and write to disk via @tauri-apps/plugin-fs.

⸻

## Nice-to-have (if time permits)

- Effect **presets editor** (per-effect density sliders).
- **Per-beat strength curve** visualization.
- “Every N beats” toggle per effect.
- Snap options: **nearest beat**, **downbeats only**, **offbeats**.

⸻

If the agent needs concrete starter code (scheduler skeleton or ffmpeg filtergraph templates), say the word and I’ll hand over the exact functions to paste.
