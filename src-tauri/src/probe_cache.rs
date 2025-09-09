use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbeRecord {
    pub path: String,
    pub size_bytes: u64,
    pub mtime_ns: u64,
    pub probed_at: u64,
    pub duration_sec: Option<f64>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps_num: Option<u32>,
    pub fps_den: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub json_path: Option<String>,
    pub deep_ready: bool,
}

pub struct ProbeCache {
    conn: Arc<Mutex<Connection>>,
}

impl ProbeCache {
    pub fn new(db_path: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open(db_path)?;
        
        // Optimize SQLite for performance
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA temp_store=MEMORY;
             PRAGMA cache_size=-20000;"
        )?;

        // Create probe cache schema
        conn.execute(
            "CREATE TABLE IF NOT EXISTS media_probe (
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
                deep_ready INTEGER DEFAULT 0
            )",
            [],
        )?;

        // Create indexes for performance
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_probe_path ON media_probe(path)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_probe_mtime ON media_probe(mtime_ns)",
            [],
        )?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn check_probe_cache(
        &self,
        path: &str,
        size_bytes: u64,
        mtime_ns: u64,
    ) -> SqliteResult<Option<ProbeRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT path, size_bytes, mtime_ns, probed_at, duration_sec, video_codec, audio_codec,
                    width, height, fps_num, fps_den, sample_rate, channels, json_path, deep_ready
             FROM media_probe 
             WHERE path = ?1 AND size_bytes = ?2 AND mtime_ns = ?3"
        )?;

        let mut rows = stmt.query_map(params![path, size_bytes, mtime_ns], |row| {
            Ok(ProbeRecord {
                path: row.get(0)?,
                size_bytes: row.get(1)?,
                mtime_ns: row.get(2)?,
                probed_at: row.get(3)?,
                duration_sec: row.get(4)?,
                video_codec: row.get(5)?,
                audio_codec: row.get(6)?,
                width: row.get(7)?,
                height: row.get(8)?,
                fps_num: row.get(9)?,
                fps_den: row.get(10)?,
                sample_rate: row.get(11)?,
                channels: row.get(12)?,
                json_path: row.get(13)?,
                deep_ready: row.get::<_, i32>(14)? != 0,
            })
        })?;

        match rows.next() {
            Some(Ok(record)) => Ok(Some(record)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    pub fn save_probe_cache(&self, record: &ProbeRecord) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO media_probe 
             (path, size_bytes, mtime_ns, probed_at, duration_sec, video_codec, audio_codec,
              width, height, fps_num, fps_den, sample_rate, channels, json_path, deep_ready)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                record.path,
                record.size_bytes,
                record.mtime_ns,
                record.probed_at,
                record.duration_sec,
                record.video_codec,
                record.audio_codec,
                record.width,
                record.height,
                record.fps_num,
                record.fps_den,
                record.sample_rate,
                record.channels,
                record.json_path,
                if record.deep_ready { 1 } else { 0 }
            ],
        )?;
        Ok(())
    }

    pub fn get_all_probe_cache(&self) -> SqliteResult<Vec<ProbeRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT path, size_bytes, mtime_ns, probed_at, duration_sec, video_codec, audio_codec,
                    width, height, fps_num, fps_den, sample_rate, channels, json_path, deep_ready
             FROM media_probe ORDER BY probed_at DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(ProbeRecord {
                path: row.get(0)?,
                size_bytes: row.get(1)?,
                mtime_ns: row.get(2)?,
                probed_at: row.get(3)?,
                duration_sec: row.get(4)?,
                video_codec: row.get(5)?,
                audio_codec: row.get(6)?,
                width: row.get(7)?,
                height: row.get(8)?,
                fps_num: row.get(9)?,
                fps_den: row.get(10)?,
                sample_rate: row.get(11)?,
                channels: row.get(12)?,
                json_path: row.get(13)?,
                deep_ready: row.get::<_, i32>(14)? != 0,
            })
        })?;

        let mut records = Vec::new();
        for row in rows {
            records.push(row?);
        }
        Ok(records)
    }

    pub fn cleanup_stale_entries(&self, cutoff_timestamp: u64) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM media_probe WHERE probed_at < ?1",
            params![cutoff_timestamp],
        )?;
        Ok(())
    }
}