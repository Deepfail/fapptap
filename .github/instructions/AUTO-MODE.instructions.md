````instructionsProject context / what I'm building

Project context / what I'm building

Project: Fapptap — Tauri v2 desktop app with React + TypeScript + Vite + Tailwind v4 + shadcn/ui.

Project: Fapptap — Tauri v2 desktop app with React + TypeScript + Vite + Tailwind v4 + shadcn/ui.

Backend worker: Python 3.11 at .\worker\main.py (stages: beats|shots|cutlist|render), talks via JSONL.

Backend worker: Python 3.11 at .\worker\main.py (stages: beats|shots|cutlist|render), talks via JSONL.

Media tools: ffmpeg/ffprobe in PATH.

Media tools: ffmpeg/ffprobe in PATH.

Manager: npm (not pnpm). Root: C:\Files\Projects\fapptap.

Manager: npm (not pnpm). Root: C:\Files\Projects\fapptap.

Knowledge Base: ALWAYS reference TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md for all Tauri v2 patterns, configurations, and troubleshooting. Update it with any new learnings.ontext / what I’m building

CRITICAL: ALWAYS reference TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md for all Tauri v2 patterns, configurations, and troubleshooting. Update it with any new learnings. This is MANDATORY for all Tauri-related work.

Project: Fapptap — Tauri v2 desktop app with React + TypeScript + Vite + Tailwind v4 + shadcn/ui.

How I want you to work (defaults)

Backend worker: Python 3.11 at .\worker\main.py (stages: beats|shots|cutlist|render), talks via JSONL.

Goal-oriented responses: state the objective, constraints, deliverables, acceptance tests, guardrails.

Media tools: ffmpeg/ffprobe in PATH.

Non-interactive by default: assume CI=true, never start watch modes, never pause for prompts.

Manager: npm (not pnpm). Root: C:\Files\Projects\fapptap.

Make the smallest reasonable assumption if something's missing; document it.

How I want you to work (defaults)

Prefer one-shot commands (e.g., vitest run, jest --ci --watchAll=false).

Goal-oriented responses: state the objective, constraints, deliverables, acceptance tests, guardrails.

Use npm scripts. If a script is missing, propose the smallest addition.

Non-interactive by default: assume CI=true, never start watch modes, never pause for prompts.

Avoid destructive ops unless I explicitly ask (no git reset --hard, rm -rf, robocopy /MIR, etc.).

Make the smallest reasonable assumption if something’s missing; document it.

If a step fails, attempt up to 3 auto-fixes (install missing dep, regen config, fallback to mocks), then continue and record the issue.

Prefer one-shot commands (e.g., vitest run, jest --ci --watchAll=false).

Tauri v2 Requirements (MANDATORY):

- FIRST: Check TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md before implementing any Tauri solutionUse npm scripts. If a script is missing, propose the smallest addition.

- Reference specific KB sections in your response

- Update KB immediately when discovering new patterns or fixesAvoid destructive ops unless I explicitly ask (no git reset --hard, rm -rf, robocopy /MIR, etc.).

- Ensure all sidecar binaries use correct naming conventions

- Verify asset protocol settings match KB patternsIf a step fails, attempt up to 3 auto-fixes (install missing dep, regen config, fallback to mocks), then continue and record the issue.



When I say "agent mode"Tauri v2 Requirements: Reference knowledge base for configurations, update it with new patterns, ensure all sidecar binaries use correct naming conventions, verify asset protocol settings.



If a message begins with a fenced header ---\nmode: agent\n---, you will:When I say “agent mode”



Run end-to-end without status chatter.If a message begins with a fenced header ---\nmode: agent\n---, you will:



No questions, no progress reports, no watch servers.Run end-to-end without status chatter.



Produce exactly one final summary: what shipped, how to run (≤3 cmds), artifacts, assumptions, follow-ups.No questions, no progress reports, no watch servers.



MANDATORY: Include knowledge base references and any updates in the summary.Produce exactly one final summary: what shipped, how to run (≤3 cmds), artifacts, assumptions, follow-ups.



Tools & orderingKnowledge base updates: Include any new Tauri v2 learnings in the summary.



JS/TS: npm, npx, node, vite, tscTools & ordering



Desktop: npx tauri dev|buildJS/TS: npm, npx, node, vite, tsc



Python: python/py, pip, pyinstallerDesktop: npx tauri dev|build



Media: ffmpeg, ffprobePython: python/py, pip, pyinstaller



Scripts: PowerShell (powershell, pwsh) for scripts/\*.ps1Media: ffmpeg, ffprobe



Tauri: ALWAYS reference TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md first for all configurations and patternsScripts: PowerShell (powershell, pwsh) for scripts/\*.ps1



Output styleTauri: Reference TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md for all configurations and patterns



Prefer concise checklists and acceptance criteria over code dumps.Output style



Only provide code when exactness matters (config, ffmpeg filters, schema).Prefer concise checklists and acceptance criteria over code dumps.



Always include "Done when…" bullets.Only provide code when exactness matters (config, ffmpeg filters, schema).



MANDATORY: Include "KB Reference: [section]" or "KB Updated: [section] - [what was learned]" in all Tauri-related responses.Always include "Done when…" bullets.



```Knowledge base: Include "KB Updated:" in summaries if Tauri v2 knowledge base was modified.
````
