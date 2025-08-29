# UI Roadmap — AutoEdit

Goal: Transform the current UI into a polished, dark, desktop-first video editor with a modern timeline, clip library, preview, effects, and full pipeline integration.

Phases

1. Foundations (UI shell & state)

   - Create app shell: left Clip Library, center Preview+Timeline, right Inspector/Effects
   - Dark theme and typography
   - Editor global state (clips, timeline model, transport)
   - Mock data for browser dev
   - Components: `ClipList`, `ClipItem`, `PreviewPlayer`, `Timeline`
   - Deliverable: interactive mock capable of drag-to-timeline and preview playback

2. Core Editing UX

   - Implement trimming, drag/drop, snapping, selection, undo/redo
   - Thumbnails & waveform previews (mock -> worker integration)
   - Deliverable: Create simple edit and playback flow

3. Effects & Workflow

   - Effects panel with transforms and transitions
   - Beat-sync UI, markers, cutlist generation
   - Deliverable: UI-driven cutlist generation and render pipeline integration

4. Desktop integration & polish
   - Full Tauri worker wiring (thumbnails, render, background tasks)
   - Performance optimizations, keyboard shortcuts, packaging
   - Deliverable: Packaged desktop application with CI and tests

Immediate todos (Phase 1)

- Add `EditorProvider` and simple context API
- Create `ClipList`, `ClipItem`, `PreviewPlayer`, `Timeline` components
- Provide `public/mock/clips.json` and thumbnails for dev
- Wire components into `App.tsx` and enable mock-driven preview

How we'll proceed

- Implement incremental components, run smoke checks, and demo after each milestone.
- Keep browser dev useful (mock data) but gate heavy operations to Desktop/Tauri.

Perfect—here’s a **goal-oriented, copy-pasteable backlog** your agent can chew through while you’re gone. Each item is brief (objective > constraints > acceptance), ordered so you get visible wins fast and a clear path to a pro editor.

---

## Task 1 — Editor State & Undo/Redo Skeleton

**GOAL** Establish a single source of truth for clips, timeline, transport; scaffold history.
**CONSTRAINTS** Keep state framework-agnostic (e.g., Zustand); actions only (no side effects).
**ACCEPTANCE** `addClip`, `addEvent`, `setSelection`, `setPlayhead`, `undo/redo` work; 100-operation history cap.

## Task 2 — Mock Clip Library & Drag-to-Timeline

**GOAL** Developer-mode library with mock `clips.json` + thumbs; drag to create events.
**CONSTRAINTS** No worker calls; all mock.
**ACCEPTANCE** Drag from library drops an event at playhead; persists in state.

## Task 3 — Preview Player & Transport (Centralized)

**GOAL** One transport controls audio (WaveSurfer) + timeline playhead; J/K/L, `[` `]`.
**CONSTRAINTS** WaveSurfer time is the truth; timeline updates via rAF.
**ACCEPTANCE** <50 ms drift over 60 s; shortcuts work outside inputs.

## Task 4 — Timeline v0.5 (Zoom/Pan/Virtualize + Snap Grid)

**GOAL** Fast timeline with lanes, zoom/pan, beat grid overlay, playhead.
**CONSTRAINTS** Canvas/WebGL render; virtualization for long timelines.
**ACCEPTANCE** 10k events pan/zoom at 60 fps on 1080p; grid toggles; beats show.

## Task 5 — Thumbnail Extractor (Worker) + Lazy UI

**GOAL** Generate and cache thumbs via ffmpeg; lazy-load in UI.
**CONSTRAINTS** Cache key = file path + mtime; sidecar-safe.
**ACCEPTANCE** First load generates; second load uses cache; missing files handled gracefully.

## Task 6 — Waveform Cache for Song

**GOAL** Precompute downsampled peaks to draw waveform fast (dev & prod).
**CONSTRAINTS** JSON ≤ \~1–2 MB; regenerate on song change.
**ACCEPTANCE** Waveform renders instantly; toggling zoom is smooth.

## Task 7 — Selection, Trim Handles & Ripple Toggle

**GOAL** Mouse trim in/out; ripple on/off; snap to beat grid.
**CONSTRAINTS** Keyboard: `,`/`.` nudge ±1 frame (or ±10 ms proxy).
**ACCEPTANCE** Trimming updates event; ripple shifts neighbors only when enabled.

## Task 8 — Undo/Redo Implementation (Time-Travel)

**GOAL** Real history with grouped actions (drag = single entry).
**CONSTRAINTS** Serialize deltas, not snapshots; cap + compaction.
**ACCEPTANCE** 50 meaningful steps undo/redo without perf hiccups.

## Task 9 — Effects Inspector v1 (Transform)

**GOAL** Per-clip position/scale/crop/opacity with handles + numeric fields.
**CONSTRAINTS** Persist in event data; no render yet required.
**ACCEPTANCE** Values round-trip (UI ⇄ state); multiple clips recall settings.

## Task 10 — Transitions v1 (Cut, Crossfade)

**GOAL** Add transitions between adjacent events; length adjustable.
**CONSTRAINTS** Represent as adjacency metadata; map to ffmpeg filters later.
**ACCEPTANCE** Visual badges on timeline; no overlaps; validation prevents illegal combos.

## Task 11 — Speed Ramps v1 (Beat-Aware)

**GOAL** Add speed segments (e.g., 1×→0.5×→1×) anchored to beats.
**CONSTRAINTS** Encode as keyframes in event; preview approximates, render exact.
**ACCEPTANCE** Ramp UI edits survive save/load; markers align to beats.

## Task 12 — Beat-Sync Tools (Quantize/Nudge/Swing)

**GOAL** Quantize selected events to nearest 1/1, 1/2, 1/4 beat; swing control.
**CONSTRAINTS** Non-destructive; show delta preview before apply.
**ACCEPTANCE** Quantize moves within tolerance; undo restores exact original times.

## Task 13 — Cutlist Export from Timeline

**GOAL** Generate `render/cutlist.json` from current timeline (local clip times).
**CONSTRAINTS** Validate with Zod; versioned schema v1.
**ACCEPTANCE** Worker consumes file and renders proxy successfully.

## Task 14 — Render Presets & Export Dialog

**GOAL** Proxy 540p, Final 1080p, Social 9:16 presets; progress + ETA.
**CONSTRAINTS** Presets as JSON templates; selectable output dir.
**ACCEPTANCE** Export runs non-interactive; file sizes/durations sane.

## Task 15 — Background Task Queue & Notifications

**GOAL** Queue worker jobs; show system toasts on complete/fail.
**CONSTRAINTS** One render at a time; others queued; cancellable.
**ACCEPTANCE** Queue survives UI reload; statuses correct.

## Task 16 — System Check Panel (In-App)

**GOAL** Surface Python/FFmpeg/NVENC, disk space, sidecars, last paths.
**CONSTRAINTS** Read-only; green/yellow/red badges; “open folder” actions.
**ACCEPTANCE** Matches preflight script results.

## Task 17 — Project Save/Load, Autosave & Recovery

**GOAL** `.fapptap.json` project file; autosave every 30 s; crash recovery.
**CONSTRAINTS** Relative asset paths; missing-asset resolution flow.
**ACCEPTANCE** Reopen restores state; moved media can be relinked.

## Task 18 — Media Manager & Probe DB

**GOAL** Scan clips folder, write SQLite (probe, shots, scores), detect duplicates/offline.
**CONSTRAINTS** Non-blocking scans; progress UI; filters (fps, res, length).
**ACCEPTANCE** Library reflects DB; offline clips flagged with actions.

## Task 19 — Schema v1 Finalization (Zod + Guards)

**GOAL** Strict validators for beats/shots/cutlist; friendly errors.
**CONSTRAINTS** No app crashes on malformed files.
**ACCEPTANCE** Corrupt inputs produce toast + panel message; skip gracefully.

## Task 20 — QA Harness (Playwright + Sample Project)

**GOAL** Headless UI smoke: open project → run proxy render → verify outputs.
**CONSTRAINTS** Synthetic assets only; run in CI.
**ACCEPTANCE** CI green on Windows runner; artifacts uploaded.

## Task 21 — Performance Pass (Profiling & Memo)

**GOAL** 60 fps timeline, low GC churn; memoize heavy selectors; off-main workers.
**CONSTRAINTS** Keep memory stable with 10k events.
**ACCEPTANCE** Flamegraph shows no long main-thread blocks; scroll stays smooth.

## Task 22 — Packaging & Updater

**GOAL** Hardened Tauri build with sidecars + Updater wired.
**CONSTRAINTS** Silent auto-update opt-in; release channel “canary/stable”.
**ACCEPTANCE** Installer runs on a clean VM; update prompt works with test feed.

---

### Parallel “Beat-Aware” Enhancements (queue after UI v1)

1. **HPSS + Transient Emphasis** for onset (DSP).
2. **Drift-aware Snap** (PLP grid ±60 ms; DP cost).
3. **Confidence + Prune/Fill**; expose as overlay.
4. **Downbeats (madmom-gated)**; graceful fallback.
5. **Genre Presets & Tempo Range**; divisors 0.5/1/2.

---

### Prompts to add in each task (keep them non-interactive)

- “Set `CI=true`; do not start watch modes.”
- “No codegen of large assets; synthesize sample media if needed.”
- “If ambiguity, propose smallest assumptions and proceed.”

Want me to expand any single task above into a fuller spec (still goal-oriented) for your agent to start with right now?
