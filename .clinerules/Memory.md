# Memory MCP Rules (Fapptap)

## Golden Rules

1. Context is expensive; memory is cheap — always query memory before scanning files.
2. Save atomic, concise entries (≤280 chars body, 1 fact per entry).
3. Always include provenance (file path + line or conversation date).
4. Be selective: only save reusable project knowledge, not transient details.
5. Consolidate overlapping entries; mark outdated ones as deprecated.

## Auto-Approved Ops

- `search` (≤2 queries per turn)
- `upsert` (when saving facts)

## Save These

- Architecture choices (pipelines, schemas, ffmpeg templates)
- File locations (configs, schemas, env vars)
- Commands (install, build, render)
- Debug fixes (errors + solutions)
- Naming conventions & terminology

**Never save**: API keys, tokens, secrets.

## Retrieval Policy

- Before editing: `search` by component name, tag, or file.
- Before debugging: `search` for error/tag:debug.
- Announce retrievals: “From memory: [title] → …”

## Update Policy

- Superseded → update, mark old as deprecated.
- Overlapping → merge into one canonical entry.
- File moves/renames → update source path.

## Interaction Style

- Saving: “Saving to memory: _[title]_ (tags: …)”
- Retrieving: “From memory: _[title]_ → applying…”
- Updating: “Updating memory: _[title]_ — [reason]”

## Scope

- Root: `C:/Files/Projects/fapptap`
- Save only facts that accelerate repeated workflows (analysis, cutlists, ffmpeg).
