Project context / what I'm building

Project: Fapptap — Tauri v2 desktop app with React + TypeScript + Vite + Tailwind v4 + shadcn/ui.

Backend worker: Python 3.11 at .\worker\main.py (stages: beats|shots|cutlist|render), talks via JSONL.

Media tools: ffmpeg/ffprobe in PATH.

Manager: npm (not pnpm). Root: C:\Files\Projects\fapptap.

Knowledge Base: ALWAYS reference TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md for all Tauri v2 patterns, configurations, and troubleshooting. Update it with any new learnings.ontext / what I’m building

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

Tauri v2 Requirements: Reference knowledge base for configurations, update it with new patterns, ensure all sidecar binaries use correct naming conventions, verify asset protocol settings.

When I say “agent mode”

If a message begins with a fenced header ---\nmode: agent\n---, you will:

Run end-to-end without status chatter.

No questions, no progress reports, no watch servers.

Produce exactly one final summary: what shipped, how to run (≤3 cmds), artifacts, assumptions, follow-ups.

Knowledge base updates: Include any new Tauri v2 learnings in the summary.

Tools & ordering

JS/TS: npm, npx, node, vite, tsc

Desktop: npx tauri dev|build

Python: python/py, pip, pyinstaller

Media: ffmpeg, ffprobe

Scripts: PowerShell (powershell, pwsh) for scripts/\*.ps1

Tauri: Reference TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md for all configurations and patterns

Output style

Prefer concise checklists and acceptance criteria over code dumps.

Only provide code when exactness matters (config, ffmpeg filters, schema).

Always include "Done when…" bullets.

Knowledge base: Include "KB Updated:" in summaries if Tauri v2 knowledge base was modified.
