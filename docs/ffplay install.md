This task is part of the broader Fapptap project, so you will see familiar components, structures, and patterns. However, it is not the same type of implementation you’ve been doing before. The key distinction is that this feature is built around ffplay’s real-time playback and filtergraph speed, rather than traditional rendering or React-side state manipulation. That means performance, instant feedback, and tight synchronization with audio beats take priority over the usual slow/stepwise render pipeline. Treat this as a different category of work — still within Fapptap, but fundamentally defined by the speed-first, ffplay-driven approach. Also I'm learning all this still, and

FAPPTap - LIVE FFPLAY Basic Mode 2.0 — (authoritative)

Prb be best 2 keep this version separated from the other modes. But same process.

Goal

My 2nd attempt to create beatleap for PC. Nearly instant playback ffplay that mirrors export timing/effects—no file writing.

User Flow (must implement exactly)

    1. Audio Duration Preset

User chooses: 30s | 1m | 2m | 3m | full-track. 2. Pick Audio (file path). 3. Clip Ordering & Video Length
○ Ordering: random or byTitle.
○ Video Length: 30s | 1m | 2m | 3m | full-track (can differ from audio preset; clamp to available audio). 4. Create
○ Analyze audio (beats + downbeats; tempo curve).
○ Build timeline: pick/trim clips to fill target duration using beat grid. 5. Preview & Edit
○ Show live preview (ffplay) immediately.
○ User can add per-cut effects: fast_cut, prism, zoom, jump_cut, flash, rgb, glitch, shake with intensities low|med|high.
○ Global Tempo knob affects cut density & effect intensity scaling.
○ User can draw No-Cut Zones on the music timeline; cuts must not start/place within those spans.

Acceptance Criteria

    • Create runs end-to-end: audio analysis → beat grid → cutlist timeline generation → ffplay starts in ≤ 1s.
    • Preview restart is debounced (300–400ms) on any timeline/effect/tempo/no-cut change.
    • ffplay shows correct ordering, trims, speeds, effect mappings, crossfades (if enabled).
    • No orphan ffplay processes; PID managed and killed on Stop/app exit.
    • All temp files live under ${workspaceFolder}/cache/preview/.
    • Works on Win/mac; paths with spaces are safe.

Done when: preview visually matches export timing within 1 frame at chosen FPS, and edits reflect after a debounced restart.

Data Shapes (TypeScript)
// Chosen by the user on the “Create” screen
type CreateRequest = {
audioPath: string;
audioPreset: "30s" | "1m" | "2m" | "3m" | "full"; // trims analysis/preview length
videoLength: "30s" | "1m" | "2m" | "3m" | "full";
clipOrder: "random" | "byTitle";
};

// Derived by analysis
type Beat = { t: number; strength: number; isDownbeat?: boolean };
type NoCutZone = { start: number; end: number };
type EffectKind = "fast_cut" | "prism" | "zoom" | "jump_cut" | "flash" | "rgb" | "glitch" | "shake";
type Intensity = "low" | "med" | "high";
type ClipRef = {
filePath: string; // absolute
in: number; // seconds in source
out: number; // seconds in source
speed?: number; // default 1.0
effects?: { kind: EffectKind; intensity: Intensity }[];
audioGainDb?: number; // optional per-clip gain
xfadeToNextMs?: number; // optional crossfade
};
type Timeline = {
fps: number;
previewScale: number; // 0.25/0.5/1.0
globalTempo: number; // 0.5 .. 2.0 affects density/intensity
noCutZones: NoCutZone[]; // on audio timeline
clips: ClipRef[]; // ordered
};

UI Wiring (React)

    • Create Panel: radio/select for audio preset & video length; file picker for audio; order toggle (random/byTitle); Create button.
    • Preview Controls: Preview and Stop buttons; small “Preview running” indicator.
    • Timeline Editor:
        ○ Beat grid overlay.
        ○ Draw No-Cut Zones (drag across timeline).
        ○ Per-cut effect popover: the 8 effects with low|med|high.
        ○ Global Tempo slider: 0.5–2.0 (default 1.0).

When any of: clips[], effects, globalTempo, noCutZones, or xfadeToNextMs change → call preview.restartDebounced().

Generation Logic (Create)

    1. Audio Analysis
        ○ Use python worker (librosa/madmom) to extract beats & downbeats for selected audio window (use preset to cap length).
        ○ If tempo curve fails, fall back to onset strength peaks. Persist to ${cache}/analysis/<audio_hash>.json.
    2. Select & Order Clips
        ○ Read available clips in chosen folder; order per clipOrder.
        ○ Estimate needed total segment time = videoLength (seconds).
        ○ For each beat interval (scaled by globalTempo), pick next clip and trim a span (e.g., inter-beat interval * speed).
        ○ Honor No-Cut Zones: disallow cut points landing inside any zone; if a planned cut hits a zone, slide to the next legal beat boundary.
    3. Per-cut Effects
        ○ Map effect kinds + intensity to FFmpeg filters (see table below).
        ○ Optionally add xfadeToNextMs on downbeats or per “fast_cut” mode.
    4. Emit Timeline
        ○ Save as ${cache}/preview/timeline.json (used by preview + export).

Live Preview (ffplay)

Sidecar Requirements (Tauri v2)

    • Ensure ffplay, ffmpeg, ffprobe are sidecars. Add to tauri.conf.json[5].
    • Spawn via @tauri-apps/plugin-shell Command.sidecar.
    • All temp files under ${AppData}/FAPPTap/cache/preview/.

Implementation Skeleton
// src/preview/ffgraph.ts
export function buildInputList(tl: Timeline): string { /_ concat list 'file '<path>' per clip order _/ }
export function buildFilterComplex(tl: Timeline): { complex: string; vOut: string; aOut: string } {
// For each clip i:
// [i:v] trim=in:out, setpts=PTS-STARTPTS, setpts=(1/speed)_PTS, scale, fps, <effects> [v{i}]
// [i:a] atrim=in:out, asetpts=PTS-STARTPTS, atempo chain, volume=<gain> [a{i}]
// Then either:
// concat video + amix audio (simple), OR
// iterative xfade + acrossfade when xfadeToNextMs present.
}
// src/preview/ffplayPreview.ts
export async function startFfplayPreview(tl: Timeline) {
// write inputs.txt (concat list) + graph.fc (filter_complex)
// spawn ffplay:
// ffplay -hide_banner -autoexit -stats -f concat -safe 0 -protocol_whitelist file,pipe,concat,subfile \
 // -i inputs.txt -filter_complex "script=graph.fc" -map [vout] -map [aout]
}
export async function stopFfplayPreview() { /_ kill proc if running \*/ }
// src/preview/usePreview.ts (hook)
const { startPreview, stopPreview, restartDebounced } = usePreview();
// On any relevant state change: restartDebounced(timeline, 300);

Effect Mapping (first pass)
Effect low med high
fast_cut shorter clip (beats/2) beats/3 beats/4
prism tblend=all_mode=lighten tblend=all_mode=screen tblend=all_mode=add
zoom zoompan z='min(zoom+0.002,1.05)' z='min(zoom+0.004,1.08)' z='min(zoom+0.006,1.12)'
jump_cut add 1–2 frame skip @ beat add 2–3 frame skip add 3–4 frame skip
flash lutyuv=y=val*1.1 y=val*1.2 y=val*1.3
rgb chromashift=cb_h=2:cr_h=-2 cb_h=3:cr_h=-3 cb_h=4:cr_h=-4
glitch displace/waveform light medium params heavier params
shake rotate='0.002*sin(2*PI*t)' 0.004*sin… 0.006*sin…
Agents: implement helpers to translate {kind,intensity} arrays into a ,-joined video filter suffix per clip.

Tempo & Density

    • globalTempo scales:
        ○ cut density (use every Nth beat; lower N for faster tempo),
        ○ effect intensity (map low/med/high boundaries upward with tempo),
        ○ optional speed per clip (cap at say 0.5–2.0; chain atempo).

No-Cut Zones (hard rule)

    • Maintain noCutZones[] in editor store.
    • A cut boundary must not fall inside any {start,end}.
    • If a computed cut lands in a zone, shift it forward to the next allowed beat boundary (or skip that cut).

Export parity

    • The export command must reuse the same generator (buildFilterComplex) with NVENC encode. Only the sink differs:
        ○ Preview: ffplay with -filter_complex.
        ○ Export: ffmpeg with -filter_complex + -map + encoder args.

Error Handling

    • On spawn failure or non-zero exit, surface: the exact sidecar name, args array, and first stderr line. Keep inputs.txt & graph.fc for repro.

Small Utilities (agents implement)

    • normalize(p: string) → forward slashes.
    • pathJoin(...parts) → cross-platform absolute path.
    • writeCache(rel: string, text: string) → writes under AppData cache and returns absolute path.

Integration Checklist (for PR)

    • Add ffplay sidecar to Tauri config.
    • Implement ffgraph.ts, ffplayPreview.ts, usePreview.ts.
    • Wire Create flow → timeline JSON + immediate startPreview.
    • Hook restartDebounced on edits (effects, tempo, no-cut).
    • Map 8 effects with 3 intensities.
    • Enforce No-Cut Zones.
    • Add Preview/Stop buttons + “running” indicator.
    • Confirm no zombie ffplay processes.

Done when the user can: choose presets, pick audio, set order/length, press Create, see an instant live preview, tweak effects/tempo/no-cut zones and watch the preview keep up after a short debounce.
