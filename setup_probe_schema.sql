-- Media Probe Database Schema
-- As specified in TODO.md Media Probe (2-Tier) Implementation Brief

BEGIN;

CREATE TABLE IF NOT EXISTS media_probe (
  path TEXT PRIMARY KEY,
  size_bytes INTEGER NOT NULL,
  mtime_ns INTEGER NOT NULL,
  probed_at INTEGER NOT NULL,
  duration_sec REAL,
  video_codec TEXT,
  audio_codec TEXT,
  width INTEGER,
  height INTEGER,
  fps_num INTEGER,
  fps_den INTEGER,
  sample_rate INTEGER,
  channels INTEGER,
  json_path TEXT,
  deep_ready INTEGER NOT NULL DEFAULT 0  -- 0=FAST only, 1=DEEP populated
);

CREATE INDEX IF NOT EXISTS idx_media_probe_mtime ON media_probe(mtime_ns);

PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

COMMIT;