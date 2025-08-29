# Process MCP Rules (AutoEdit)

## Purpose

Run **only** media-safe commands reproducibly.

## Allowed commands (exact shapes)

- `ffprobe -v error -show_streams -show_format -of json "<path>"`
- `ffmpeg` per the project template (filter_complex concat, NVENC). No other processes.

## Golden Rules

1. **Plan → Act**: print command preview, then run.
2. Never overwrite outputs; add timestamp suffix.
3. Keep logs minimal (`-loglevel error`).

## Auto-approved

- None (preview first). Show command and target files.

## Manual approval required

- Any spawn/exec invocation.

## Inputs/Outputs

- Inputs must exist under workspace.
- Outputs must be under `render/` or `cache/`.

## Safety

- If fps, SAR, or timebase unknown → stop and ask.
- If a segment is under 0.25s after speed effects → stretch to 0.25s or skip.
