---
applyTo: "**"
---

# FAPPTap – Project Context & Coding Guidelines (Pinned)

npm run tauri dev ✅ CORRECT - Launches the actual Tauri desktop app
NOT npm run dev ❌ WRONG - Only browser mode

## Stack & Paths

- App: **Tauri v2** + **React 19** + **TypeScript** + **Vite** + **Tailwind v4** + **shadcn/ui**
- Root: `C:\Files\Projects\fapptap`
- Dev server: `npm run dev` (Vite)
- Desktop: `npx tauri dev|build`
- Worker (desktop only): `python worker/main.py <stage>` (stages: beats | shots | cutlist | render)
- Media tools: **via Shell plugin sidecars** (preferred), scoped by capability; fall back to PATH only if explicitly allowed in shell scope.
- Data dirs (must exist): `${workspaceFolder}/cache` and `${workspaceFolder}/out`
- SQLite DB: `${workspaceFolder}/cache/analysis.db`

## MCP Tools (use these, not ad-hoc shells)

- **process-manager**: start/stop/status/logs for long-running processes
- **shell sidecars**: `ffprobe`, `ffmpeg` (use sidecars, not PATH binaries)
- **sqlite**: `query`, `exec` for durable memory/settings
- **playwright** (optional): local dev verification, screenshots (headless)
- **context7** (optional): long-form summaries; SQLite remains the source of truth for settings

### HARD RULES

1. Start/stop dev **only via process-manager**. Don’t open terminals for `npm`.
2. Use **ffprobe/ffmpeg via sidecar only**. No PATH fallbacks.
3. Write artifacts to `${workspaceFolder}/cache` or `${workspaceFolder}/out` (create dirs if missing).
4. After any action, report the **exact command/args** run and **stderr** on failure.
5. If a required tool is missing: **STOP** and emit a **[TOOL REQUEST]** (see Escalation). No workarounds.
6. **Memory is read-first**: consult SQLite memory keys before asking questions or recomputing.

### MEMORY (SQLite)

- Tables (idempotent; create if missing):
  - `memory(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)`
  - `memory_tags(key TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY(key,tag))`
- Canonical keys:
  - `dev.port` (`"5175"` default), `dev.command` (`"npm run tauri dev"`)
  - `paths.cache`, `paths.out`, `db.path.analysis`
  - `ffmpeg.preset.preview` (e.g., `"-preset p5 -rc vbr -cq 22"`)
- Always **read**: `SELECT key,value FROM memory WHERE key IN (...)`
- Upsert with: `INSERT ... ON CONFLICT(key) DO UPDATE ...` and `updated_at=strftime('%s','now')`

### CANONICAL CALLS

- **Start dev (port from memory, default 5175)**  
  `process-manager.start { name:"dev", command:"npm", args:["run","dev"], env:{ "PORT":"<dev.port or 5175>" }, cwd:"${workspaceFolder}" }`
- **Probe media**  
  `shell.sidecar("ffprobe", ["-v","quiet","-print_format","json","-show_streams","-show_format","<abs_path>"])`
- **Render preview (NVENC)**  
  `shell.sidecar("ffmpeg", ["-f","concat","-safe","0","-i","<cutlist.txt>","-r","30","-pix_fmt","yuv420p","-c:v","h264_nvenc","-preset","p5","-rc","vbr","-cq","22","-c:a","aac","-b:a","192k","-movflags","+faststart","${workspaceFolder}/out/preview.mp4"])`
  - If `ffmpeg.preset.preview` exists in memory, substitute those flags.
- **Playwright smoke (optional)**  
  Launch headless → `goto("http://localhost:<dev.port>")` → save screenshot to `${workspaceFolder}/cache/playwright/*.png` → close.

## AUTO-MODE (PRIORITY) — machine-mode defaults

> If a message begins with:
>
> ```
> ---
> mode: agent
> ---
> ```
>
> then follow these rules:

- Goal-oriented: state objective, constraints, deliverables, acceptance tests.
- Non-interactive: assume `CI=true`; no watch servers; no prompts.
- Make the smallest reasonable assumption; document it.
- Prefer one-shot commands (e.g., `vitest run --watch=false`).
- Use **npm** scripts. If missing, propose the smallest addition.
- Avoid destructive ops unless explicitly asked (no `git reset --hard`, `rm -rf`, `robocopy /MIR`, etc.).
- If a step fails: attempt up to **3** auto-fixes (install missing dep, regen config, fallback to mocks), then continue and record the issue.
- Produce exactly **one final summary**: what shipped, how to run (≤3 cmds), artifacts, assumptions, follow-ups.

---

- **MCP**: process-manager, ffmpeg/ffprobe sidecars, sqlite; (optional) playwright, context7, memory.

### Useful Files

`src/App.tsx`, `src/lib/worker.ts`, `src/state/editorStore.tsx`, `src/components/Timeline.tsx`, `src/components/PreviewPlayer.tsx`, `public/mock/clips.json`, `worker/main.py`, `worker/stages/*.py`, `cache/analysis.db` (SQLite), `package.json`, `tauri.conf.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.cjs`, `postcss.config.cjs`, `shadcn.config.json`.

```

### What about your separate `copilot-instructions` file?

- If that file isn’t referenced anywhere, treat it as **dead** or convert it into a **Prompt File** (so you can insert pieces on demand). Your always-on rules belong in **Instructions** (the file above).

If you want, I’ll also hand you a matching **Tool Set** JSON (tiny whitelist) keyed to the exact tool IDs you see in Copilot’s Tools panel.
```
