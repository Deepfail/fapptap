# Fapptap — Project Rules (PC Beatleap)

## Scope & Paths

- Workspace root: `C:/Files/Projects/fapptap`
- **Allowed writes**: `cache/`, `render/`
- **Read-only**: `media_samples/`, `.venv/`, `.vscode/`, `cline.json`

## MCP Usage (must follow)

- **filesystem**: only within workspace; create missing folders before writes.
- **process**: allowed commands ONLY:
  - `ffprobe -v error -show_streams -show_format -of json "<path>"`
  - `ffmpeg` commands generated from our templates (see “FFmpeg Templates”).
- **sqlite**: DB file `cache/analysis.db`; use CREATE TABLE IF NOT EXISTS + UPSERT via parameters.
- **github**: issues/PRs allowed; include checklist & paths touched.
- **software-planning**: single source of truth plan at `cache/plans/v0.json`.

## Analysis Artifacts (all JSON unless noted)

- `cache/probe/<basename>.json` — ffprobe output, one per media file.
- `cache/beats.json` — `{ "audio": "<path>", "sr": int, "tempo": float, "beats_sec": number[] }`
- `cache/shots.json` — `{ "<video path>": [{ "start": s, "end": s }] }`
- `cache/index.sqlite` (optional) — per-file duration/fps/width/height/hash.
