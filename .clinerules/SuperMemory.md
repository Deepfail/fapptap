# Supermemory MCP Rules (AutoEdit)

## Purpose

Use Supermemory as a long-term, semantic memory for facts that repeatedly speed up development and editing. Query it first, save only durable knowledge.

## Scope

- Root project: `C:/Files/Projects/fapptap`
- Supermemory MCP tools: `search`, `upsert` (and `delete` if available — manual only)

## Golden Rules

1. Query before you ask me or scan files.
2. Save atomic, evergreen facts (≤ 280 chars body; one fact per entry).
3. Include provenance for every fact (file path + lines or conversation date).
4. Prefer updating existing facts over creating near-duplicates.
5. Never store secrets or API keys; store pointers to config locations instead.

## Auto-approved operations

- `search` (≤ 2 queries per turn)
- `upsert` (for new/updated facts that meet “What to Save”)

## Manual approval required

- `delete` or bulk updates
- Any write that references paths outside the project root

## What to Save (AutoEdit-specific)

- **Schemas & contracts**: cutlist JSON fields, accepted `effects`, ffmpeg template variants
- **File locations**: where beats/shots/probe JSONs live; DB schema; script entrypoints
- **Commands**: canonical probe/render commands; torch install line for CUDA
- **Conventions**: naming, output folders, timestamping, versioning rules
- **Troubleshooting**: known ffmpeg pitfalls, PyTorch GPU gotchas, scenedetect thresholds
- **Pipelines**: exact step order and minimal inputs/outputs per step

**Do NOT Save**: API keys, auth tokens, personal data, raw large logs

## Entry format (required fields)

- `title`: 5–9 words (imperative or descriptive)
- `body`: 1–3 sentences or one canonical command/pattern
- `tags`: e.g. `["pipeline","ffmpeg","schema","sqlite","torch","debug"]`
- `source`: relative path + lines OR “chat yyyy-mm-dd”
- `scope`: `"project"` (default) or a module path (e.g., `"analysis/"`)
- `status`: `"active"` | `"deprecated"`

### Examples

- **title**: Cutlist JSON required fields  
  **body**: version,fps,width,height,audio,events[]. Each event has src,in,out,effects? (punch_in:x|speed:y).  
  **tags**: ["schema","render"]  
  **source**: render/cutlist.schema.json  
  **scope**: project  
  **status**: active

- **title**: NVENC proxy render template  
  **body**: Use h264_nvenc p5 vbr 12M/20M buf 24M, map audio 0:a, concat filter to [vout].  
  **tags**: ["ffmpeg","render","nvenc"]  
  **source**: .clinerules/process.md  
  **scope**: render/  
  **status**: active

- **title**: Torch CUDA install (GPU)  
  **body**: pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu129  
  **tags**: ["torch","cuda","setup"]  
  **source**: chat 2025-08-27  
  **scope**: project  
  **status**: active

## Retrieval policy

- On new task: `search` with 2–4 focused queries (component name, tag, or file).
- Before editing schemas/commands: `search` by tag (“schema”, “ffmpeg”, “torch”).
- Announce usage: “From supermemory: _[title]_ → applying…”

## Update policy

- If an entry is superseded, `upsert` a corrected version and set previous `status: deprecated`.
- Merge overlapping entries; union tags; keep the clearest title/body.
- When files move/rename, update `source` paths.

## Context budget

- Max 2 memory ops per turn unless curating.
- Never dump large memory contents into chat; quote only the relevant title/body.

## Safety

- No secrets or credentials.
- Only reference paths under `C:/Files/Projects/fapptap`.
- Treat user-provided paths as untrusted; normalize/validate before saving.
