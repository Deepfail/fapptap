use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaFile {
    pub path: String,
    pub mtime: u64,
    pub size: u64,
    pub ext: String,
    pub duration: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub codec: Option<String>,
    pub thumb: Option<String>,
    pub last_seen: u64,
}

pub struct MediaCache {
    conn: Arc<Mutex<Connection>>,
}

impl MediaCache {
    pub fn new(db_path: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open(db_path)?;
        
        // Optimize SQLite for performance
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA temp_store=MEMORY;
             PRAGMA mmap_size=30000000000;
             PRAGMA cache_size=-200000;"
        )?;

        // Create schema
        conn.execute(
            "CREATE TABLE IF NOT EXISTS media (
                path TEXT PRIMARY KEY,
                mtime INTEGER NOT NULL,
                size INTEGER NOT NULL,
                ext TEXT NOT NULL,
                duration REAL,
                width INTEGER,
                height INTEGER,
                codec TEXT,
                thumb TEXT,
                last_seen INTEGER NOT NULL
            )",
            [],
        )?;

        // Create indexes for performance
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_media_ext ON media(ext)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_media_seen ON media(last_seen)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_media_mtime ON media(mtime)",
            [],
        )?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn upsert_media_batch(&self, files: &[MediaFile]) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "INSERT OR REPLACE INTO media 
             (path, mtime, size, ext, duration, width, height, codec, thumb, last_seen)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
        )?;

        for file in files {
            stmt.execute(params![
                file.path,
                file.mtime,
                file.size,
                file.ext,
                file.duration,
                file.width,
                file.height,
                file.codec,
                file.thumb,
                file.last_seen
            ])?;
        }

        Ok(())
    }

    pub fn update_heavy_fields(&self, path: &str, duration: Option<f64>, width: Option<u32>, height: Option<u32>, codec: Option<String>) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE media SET duration = ?1, width = ?2, height = ?3, codec = ?4 WHERE path = ?5",
            params![duration, width, height, codec, path],
        )?;
        Ok(())
    }

    pub fn get_media_by_ext(&self, extensions: &[String], limit: Option<u32>, offset: Option<u32>) -> SqliteResult<Vec<MediaFile>> {
        let conn = self.conn.lock().unwrap();
        let ext_placeholders = extensions.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        
        let mut query = format!(
            "SELECT path, mtime, size, ext, duration, width, height, codec, thumb, last_seen 
             FROM media WHERE ext IN ({}) ORDER BY last_seen DESC",
            ext_placeholders
        );

        if let Some(limit) = limit {
            query.push_str(&format!(" LIMIT {}", limit));
            if let Some(offset) = offset {
                query.push_str(&format!(" OFFSET {}", offset));
            }
        }

        let mut stmt = conn.prepare(&query)?;
        let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();
        for ext in extensions {
            params.push(ext);
        }

        let rows = stmt.query_map(&params[..], |row| {
            Ok(MediaFile {
                path: row.get(0)?,
                mtime: row.get(1)?,
                size: row.get(2)?,
                ext: row.get(3)?,
                duration: row.get(4)?,
                width: row.get(5)?,
                height: row.get(6)?,
                codec: row.get(7)?,
                thumb: row.get(8)?,
                last_seen: row.get(9)?,
            })
        })?;

        let mut files = Vec::new();
        for row in rows {
            files.push(row?);
        }
        Ok(files)
    }

    pub fn cleanup_old_entries(&self, cutoff_timestamp: u64) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM media WHERE last_seen < ?1",
            params![cutoff_timestamp],
        )?;
        Ok(())
    }
}

pub fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}