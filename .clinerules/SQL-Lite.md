# SQLite MCP Rules (Faptapp)

## DB

- File: `cache/analysis.db`

## Tables

- `clips(path TEXT PRIMARY KEY, duration REAL, fps REAL, width INT, height INT, hash TEXT)`
- `beats(audio_path TEXT PRIMARY KEY, tempo REAL, sr INT, beats_json TEXT)`
- `shots(video_path TEXT PRIMARY KEY, shots_json TEXT)`

## Golden Rules

1. Create tables if missing.
2. Use **parameterized** queries (no string concat).
3. Upsert instead of duplicate inserts.
4. Never DROP/DELETE without explicit approval.

## Auto-approved

- `query`, `execute` for CREATE TABLE IF NOT EXISTS, INSERT OR REPLACE, SELECT

## Manual approval

- UPDATE/DELETE without WHERE by primary key.
- Any schema change after initial creation.

## Patterns

```sql
-- upsert clip
INSERT INTO clips(path,duration,fps,width,height,hash)
VALUES(?,?,?,?,?,?)
ON CONFLICT(path) DO UPDATE SET duration=excluded.duration,fps=excluded.fps,width=excluded.width,height=excluded.height,hash=excluded.hash;

-- read beats
SELECT tempo, sr, beats_json FROM beats WHERE audio_path = ?;
```
