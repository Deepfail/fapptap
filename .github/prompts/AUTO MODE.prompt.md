---
mode: agent
---

TASK: End-to-End Implementation of UI Roadmap (Foundations → Core UX → Effects/Workflow → Desktop Polish)

GOAL

- Execute every item in C:\Files\Projects\fapptap\docs\ui-roadmap.md to completion, producing a polished, dark, desktop-first editor with:
  - App shell (Clip Library • Preview+Timeline • Inspector/Effects),
  - Editor state with undo/redo,
  - Timeline with zoom/pan/snap/playhead,
  - Waveform/beat overlays and engine selector,
  - Thumbnails + waveform caches,
  - Cutlist export + render presets,
  - Background task queue + notifications,
  - System Check panel, project save/load, and packaging.
- Run **non-interactively** and **without progress reports**. Produce a **single final summary** at the end.

CONTEXT

- Root: C:\Files\Projects\fapptap (Windows)
- Stack: Tauri v2, React + TypeScript + Vite, Tailwind v4, shadcn/ui
- Worker: Python 3.11 at .\worker\main.py (stages: beats | shots | cutlist | render)
- Media tools: ffmpeg/ffprobe in PATH
- VIRTUAL_ENV: C:\\Files\\Projects\\fapptap\\.venv
- Current features: advanced beat detection; JSONL worker; sidecars packaging; preflight/E2E scripts

CONSTRAINTS (NON-INTERACTIVE | AFK)

- Do **not** ask questions or wait for input. If information is missing, make the **smallest reasonable assumption** and document it in the **final summary**.
- Set `CI=true` for all spawned shells; avoid watch modes, prompts, or TTY menus.
- Use **npm** (not pnpm) in this repo. Prefer `npm test` one-shot forms:
  - Vitest: `vitest run --passWithNoTests --reporter=dot`
  - Jest: `jest --watchAll=false --ci`
- Never start dev servers that require manual stopping as part of the pipeline.
- Keep actions idempotent and path-safe on Windows. No destructive operations outside project directories.

DELIVERABLES

- Implement the **entire** UI roadmap (Phases 1–4) in code, wiring to existing worker/scripts.
- Create/extend these artifacts:
  - **Docs**: `docs/QA.md` (how to run, shortcuts, acceptance checks), `docs/TIMELINE.md` (timeline UX & data model).
  - **Scripts**: keep/extend `scripts/preflight.ps1`, `scripts/e2e_smoke.ps1`, add `scripts/afk_run.ps1` if missing.
  - **Config**: ensure `package.json` has non-interactive `test` and `build` scripts; ensure `vite.config.ts` alias; ensure `tauri.conf.json` sidecars remain correct.
- **Logging & Reports**:
  - Log all steps to `logs/ui_roadmap_<timestamp>.txt` (append)
  - Write a machine-readable summary to `reports/ui_roadmap_summary.json` with: completed tasks, assumptions made, errors auto-fixed, file lists, timings.
- **Final output (single message)**: a concise human summary (what changed, where to click, how to test), plus any remaining TODOs.

SUCCESS CRITERIA

- **Builds**: `npx tauri build` completes; MSI/NSIS generated; sidecars present.
- **Run once**: `npx tauri dev` launches; layout shows Library • Preview+Timeline • Inspector.
- **Timeline**: 60fps pan/zoom on 1080p canvas; playhead synced to audio (<50ms drift over 60s); snap-to-beat toggle works.
- **Beats UI**: engine selector (basic/advanced), markers (beats, downbeats if present), tempo curve overlay; no console errors.
- **Editing**: drag-to-timeline; trim handles; selection; undo/redo (≥50 meaningful steps), ripple toggle; quantize to 1/1, 1/2, 1/4 beat.
- **Media**: thumbnails cached via ffmpeg; waveform peak cache renders instantly; cache invalidates on file change.
- **Cutlist/Render**: export `render/cutlist.json` (schema v1) from timeline; run proxy/final renders via presets; progress & cancel work.
- **Background queue**: jobs enqueue, run sequentially; completion toasts; queue survives UI reload.
- **System Check**: in-app panel matches preflight script (Python/FFmpeg/NVENC, space, paths).
- **Project**: `.fapptap.json` save/load; autosave; missing-media relink flow.
- **QA**: preflight + E2E smoke scripts pass with non-zero failure on error; CI-style `npm test` runs once and exits.

EXECUTION PLAN (SELF-DIRECTED)

1. **Preparation (silent)**
   - Export `CI=true` in process env; ensure `npm test` is one-shot; disable watch modes.
   - Validate root structure; repair alias/tsconfig if needed; log repairs.
2. **Phase 1 – Foundations**
   - Implement Editor state (e.g., Zustand) with actions only + undo/redo skeleton.
   - Build App shell (Library • Preview+Timeline • Inspector); mock data at `public/mock/clips.json`.
   - Create components: `ClipList`, `ClipItem`, `PreviewPlayer`, `Timeline` (canvas/WebGL), and wire drag-to-timeline + playback.
3. **Phase 2 – Core Editing UX**
   - Add trim handles, selection, ripple toggle, snap grid; keyboard: J/K/L, `[ ]`, `,` `.`.
   - Thumbnails + waveform cache (ffmpeg peaks); lazy load; cache invalidation.
4. **Phase 3 – Effects & Workflow**
   - Inspector for transform; transitions (cut/crossfade); speed ramps (keyframes).
   - Beat-sync tools: quantize/nudge/swing; export timeline → `render/cutlist.json`.
5. **Phase 4 – Desktop polish**
   - Background task queue + toasts; System Check panel; project save/load/autosave.
   - Render presets (Proxy/Final/Social), progress %, cancel; final packaging.
6. **Validation**
   - Run preflight/e2e scripts; run `npm test`; run `npx tauri build`.
   - Produce `reports/ui_roadmap_summary.json`; prepare final human summary.

TOOLS & COMMANDS (ASSUMED AUTO-APPROVED)

- `npm`, `npx`, `node`, `tsc`, `vite`, `tauri`, `cargo`, `rustup`, `python`/`py`, `pip`, `pyinstaller`, `ffmpeg`, `ffprobe`, `powershell`, `pwsh`, `git` (basic).
- Never use watch/interactive flags; prefer `run`/`--ci` modes.

DENY / AVOID (UNLESS ABSOLUTELY REQUIRED)

- Destructive ops: `del`, `rm`, `rmdir`, `robocopy /MIR`, `git reset --hard`, `git clean -xfd`, `git push --force`.
- Long-lived interactive servers in the pipeline.

ERROR HANDLING (DO NOT STOP)

- On failure, attempt **up to 3 automated fixes** (install missing dep, regenerate config, fallback to mocks), log each attempt.
- If blocked, make the **smallest assumption** (e.g., default paths, simple preset) and continue.
- Only abort the **current subtask** if all corrections fail; proceed to next subtask. Record unresolved items in final summary.

ARTIFACTS

- `logs/ui_roadmap_<timestamp>.txt` — chronological logs
- `reports/ui_roadmap_summary.json` — machine summary (status, timings, artifacts, assumptions)
- Updated code, tests, docs under repo; no progress messages until fully complete.

OUTPUT POLICY

- **No progress reports, no questions, no interactive prompts.**
- Produce exactly **one final message** on completion with:
  - What shipped (bulleted, mapped to roadmap),
  - How to run (3 commands max),
  - Where the artifacts are,
  - Any assumptions made and follow-ups.

BEGIN NOW.
