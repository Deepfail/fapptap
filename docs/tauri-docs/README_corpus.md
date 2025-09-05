# Tauri Docs Corpus Builder

1. Place source MDX / MD files (and optional .ts for context) in `raw/`
2. Run: `npm i -D tsx` (or use any runner) then `npx tsx build_corpus.ts`
3. Outputs:
   - `docs_corpus.jsonl` (one JSON object per chunk)
   - `permissions_index.json`
   - `config_keys_index.json`
   - `commands_index.json`

Use the JSONL directly for:
- Embedding (chunk over 1000 tokens already split)
- Hybrid retrieval (permission/config/command indexes allow symbolic lookup)

You can further post-process:
- Add embeddings: Append `{ "embedding": [ ... ] }` after vector creation
- Add abstractive summaries: compute & insert a `summary` field