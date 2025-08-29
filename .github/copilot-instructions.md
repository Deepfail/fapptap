```instructions
AUTO-MODE (PRIORITY) — machine-mode defaults (place these rules first; agents should obey these by default)

Project context / what I’m building

Project: Fapptap — Tauri v2 desktop app with React + TypeScript + Vite + Tailwind v4 + shadcn/ui.

Backend worker: Python 3.11 at .\worker\main.py (stages: beats|shots|cutlist|render), talks via JSONL.

Media tools: ffmpeg/ffprobe in PATH.

Manager: npm (not pnpm). Root: C:\Files\Projects\fapptap.

How I want you to work (defaults)

Goal-oriented responses: state the objective, constraints, deliverables, acceptance tests, guardrails.

Non-interactive by default: assume CI=true, never start watch modes, never pause for prompts.

Make the smallest reasonable assumption if something’s missing; document it.

Prefer one-shot commands (e.g., vitest run, jest --ci --watchAll=false).

Use npm scripts. If a script is missing, propose the smallest addition.

Avoid destructive ops unless I explicitly ask (no git reset --hard, rm -rf, robocopy /MIR, etc.).

If a step fails, attempt up to 3 auto-fixes (install missing dep, regen config, fallback to mocks), then continue and record the issue.

When I say “agent mode”

If a message begins with a fenced header
---
mode: agent
---, you will:

Run end-to-end without status chatter.

No questions, no progress reports, no watch servers.

Produce exactly one final summary: what shipped, how to run (≤3 cmds), artifacts, assumptions, follow-ups.

Tools & ordering

JS/TS: npm, npx, node, vite, tsc

Desktop: npx tauri dev|build

Python: python/py, pip, pyinstaller

Media: ffmpeg, ffprobe

Scripts: PowerShell (powershell, pwsh) for scripts/*.ps1

Output style

Prefer concise checklists and acceptance criteria over code dumps.

Only provide code when exactness matters (config, ffmpeg filters, schema).

Always include “Done when…” bullets.


----

REPOSITORY GUIDE — human- & agent-friendly instructions (fallback / expanded guidance)

This repository is a Tauri + React + TypeScript desktop-first video editor (AutoEdit). The instructions below give focused, actionable context an AI coding agent needs to be immediately productive.

1) Big-picture architecture
- Frontend: `src/` — React + Vite + Tailwind UI. Main app shell is `src/App.tsx`.
- Desktop glue: `src/lib/worker.ts` wraps Tauri APIs and provides browser fallbacks for development (`selectSong`, `selectClipsDirectory`, `readFile`, `runStage`). Treat `PythonWorker` as the bridge to heavy media processing (Python worker). Don't call `runStage` in browser-only contexts (it throws when Tauri is absent).
- State: `src/state/editorStore.tsx` — single React context for clips, timeline, selection, playhead, and editor settings (pixelsPerSecond). Use `useEditor()` to read/modify editor state.
- Components: `src/components/` contains UI pieces (ClipList, ClipItem, PreviewPlayer, Timeline, DragGhost, ZoomControls). These are lightweight and expect the EditorProvider context.
- Backend/worker: Python scripts live under `worker/` and are invoked by `PythonWorker` (Tauri shell). The rendering pipeline expects a `render/cutlist.json` output (see roadmap tasks).

2) Developer workflows & commands
- Start dev server (browser): `npm run dev` — Vite dev server for UI work.
- Build: `npm run build` (runs `tsc && vite build`).
- Run tests: `npm test` (Vitest). Tests use `jsdom` for DOM behavior; `npm install --legacy-peer-deps` may be required due to mixed peer dependencies.
- Typecheck: `npx tsc --noEmit` is used repeatedly in CI steps and the agent's workflow; run it after edits.
- Desktop run (Tauri): use Tauri CLI (`npm run tauri`) and ensure Rust toolchain + Tauri deps are installed when testing desktop behavior.

3) Project-specific conventions & patterns
- Browser-first dev with graceful Tauri fallbacks: `src/lib/worker.ts` intentionally provides browser file/input fallbacks — prefer using these helper methods to interact with files so code works both in the browser and desktop.
- Mock-driven UI: `public/mock/clips.json` is used by `EditorProvider` and `ClipList` in browser dev to supply sample clips. Avoid hardcoding sample data; use the mock file or `EditorProvider`'s `initialClips` prop.
- Editor state shape: The editor context holds `clips`, `timeline` (events), `selectedTimelineItemId`, `playhead`, and `pixelsPerSecond`. Mutations should go through the store API (`addClipToTimeline`, `selectTimelineItem`, `setPlayhead`, `setPixelsPerSecond`) to keep UI consistent.
- Drag & Drop: `ClipItem` sets `dataTransfer` entries `text/clip-id` and `application/json` (with id/path/duration) for robust drops. Additionally it emits custom events `fapptap-drag-start`, `-move`, `-end` for the `DragGhost` overlay.
- PreviewPlayer sync: `PreviewPlayer` listens to `selectedTimelineItemId` and `playhead` from the store; seeking/playing logic is centralized here. Avoid duplicate transport state elsewhere.

4) Integration & external dependencies
- Tauri plugins used: `@tauri-apps/plugin-shell`, `plugin-dialog`, `plugin-fs`. Use `isTauriAvailable()` from `src/lib/worker.ts` to gate native calls.
- Python worker/ffmpeg: Worker is invoked via `PythonWorker.runStage(stage, args)`. `runStage` spawns `python worker/main.py <stage> ...` through Tauri shell (desktop) and streams JSON messages to UI. In browser mode `runStage` will raise; tests or UI must not call it unless desktop/runtime available.
- Tests: `vitest` + `@testing-library/react` are used. The repository needed `jsdom` installed; tests run with `npx vitest run --environment jsdom`.

5) Useful files to check when working on features
- `src/App.tsx` — app shell and pipeline stage wiring (status badges, buttons, Toaster, DragGhost mount).
- `src/lib/worker.ts` — Tauri/browser bridging and PythonWorker implementation.
- `src/state/editorStore.tsx` — canonical place to add new editor state and history/undo.
- `src/components/Timeline.tsx` — drop logic, uses `pixelsPerSecond` for scaling; update here for virtualization/zoom/pan.
- `src/components/PreviewPlayer.tsx` — playing/seek behavior; respects `playhead` and `selectedTimelineItemId`.
- `public/mock/clips.json` — sample data used in browser dev.
- `docs/ui-roadmap.md` — authoritative backlog and next steps; the agent should consult it to prioritize Phase 1–4 work.
- `.github/workflows/auto-approve.yml` — contains the auto-approve CI step (requires `AUTO_APPROVE_TOKEN` secret). Use caution before enabling auto-merge.

6) Editing patterns & tests
- When editing store APIs, update `src/state/editorStore.test.tsx` or add tests; the existing test uses a small DOM consumer to obtain and exercise the store.
- After UI edits: run `npx tsc --noEmit`, then `npx vitest run --environment jsdom` (or `npm test`).

7) Security & runtime notes for automated agents
- Avoid invoking `runStage` in browser-only operations; check `isTauriAvailable()` first. The Python worker and ffmpeg calls should be treated as desktop-only and require review.
- The repo contains an auto-approve workflow `.github/workflows/auto-approve.yml` that requires a PAT in `AUTO_APPROVE_TOKEN`; do not assume it's safe to auto-approve PRs without operator consent.

8) Short examples (copy-paste)
- Add a clip at drop: use `addClipToTimeline(clipId, startSeconds)` (store will auto-select and set playhead).
- Change zoom: `setPixelsPerSecond(100)` (Timeline renders left offsets with `item.start * pixelsPerSecond`).
- Read a file safely in UI: `if (isTauriAvailable()) await worker.readFile(path) else await worker.readFile(blobOrUrl)` — `worker.readFile` wraps the complexity.

If you want, I will iterate further on this combined guidance. AUTO-MODE rules above must be treated as authoritative when an "agent mode" or non-interactive run is requested.
```
