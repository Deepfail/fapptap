use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub kind: JobKind,
    pub path: String,
    pub status: JobStatus,
    pub priority: u32,
    pub created_at: u64,
    pub started_at: Option<u64>,
    pub finished_at: Option<u64>,
    pub payload: serde_json::Value,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobKind {
    Scan,
    Thumb,
    Proxy,
    Analyze,
    Render,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Done,
    Failed,
    Canceled,
}

pub struct JobQueue {
    conn: Arc<Mutex<Connection>>,
}

impl JobQueue {
    pub fn new(db_path: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open(db_path)?;

        // Create jobs table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                path TEXT NOT NULL,
                status TEXT NOT NULL,
                priority INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                started_at INTEGER,
                finished_at INTEGER,
                payload TEXT NOT NULL,
                result TEXT,
                error TEXT
            )",
            [],
        )?;

        // Create index for efficient querying
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON jobs(status, priority)",
            [],
        )?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn add_job(&self, kind: JobKind, path: String, priority: u32, payload: serde_json::Value) -> SqliteResult<String> {
        let id = Uuid::new_v4().to_string();
        let created_at = crate::media_cache::current_timestamp();

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO jobs (id, kind, path, status, priority, created_at, payload)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                serde_json::to_string(&kind).unwrap(),
                path,
                serde_json::to_string(&JobStatus::Queued).unwrap(),
                priority,
                created_at,
                payload.to_string()
            ],
        )?;

        Ok(id)
    }

    pub fn get_next_job(&self) -> SqliteResult<Option<Job>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, kind, path, status, priority, created_at, started_at, finished_at, payload, result, error
             FROM jobs WHERE status = 'queued' ORDER BY priority ASC, created_at ASC LIMIT 1"
        )?;

        let mut rows = stmt.query_map([], |row| {
            Ok(Job {
                id: row.get(0)?,
                kind: serde_json::from_str(&row.get::<_, String>(1)?).unwrap(),
                path: row.get(2)?,
                status: serde_json::from_str(&row.get::<_, String>(3)?).unwrap(),
                priority: row.get(4)?,
                created_at: row.get(5)?,
                started_at: row.get(6)?,
                finished_at: row.get(7)?,
                payload: serde_json::from_str(&row.get::<_, String>(8)?).unwrap(),
                result: row.get::<_, Option<String>>(9)?.map(|s| serde_json::from_str(&s).unwrap()),
                error: row.get(10)?,
            })
        })?;

        Ok(rows.next().transpose()?)
    }

    pub fn update_job_status(&self, id: &str, status: JobStatus, result: Option<serde_json::Value>, error: Option<String>) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        let current_time = crate::media_cache::current_timestamp();

        let (started_at, finished_at) = match status {
            JobStatus::Running => (Some(current_time), None),
            JobStatus::Done | JobStatus::Failed | JobStatus::Canceled => (None, Some(current_time)),
            _ => (None, None),
        };

        conn.execute(
            "UPDATE jobs SET status = ?1, started_at = COALESCE(?2, started_at), finished_at = ?3, result = ?4, error = ?5
             WHERE id = ?6",
            params![
                serde_json::to_string(&status).unwrap(),
                started_at,
                finished_at,
                result.map(|r| r.to_string()),
                error,
                id
            ],
        )?;

        Ok(())
    }

    pub fn cancel_jobs_by_prefix(&self, path_prefix: &str) -> SqliteResult<u32> {
        let conn = self.conn.lock().unwrap();
        let result = conn.execute(
            "UPDATE jobs SET status = 'canceled' WHERE path LIKE ?1 AND status = 'queued'",
            params![format!("{}%", path_prefix)],
        )?;

        Ok(result as u32)
    }

    pub fn get_job_stats(&self) -> SqliteResult<(u32, u32, u32, u32)> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT 
                SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
                SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
             FROM jobs"
        )?;

        let row = stmt.query_row([], |row| {
            Ok((
                row.get::<_, Option<u32>>(0)?.unwrap_or(0),
                row.get::<_, Option<u32>>(1)?.unwrap_or(0),
                row.get::<_, Option<u32>>(2)?.unwrap_or(0),
                row.get::<_, Option<u32>>(3)?.unwrap_or(0),
            ))
        })?;

        Ok(row)
    }

    pub fn cleanup_old_jobs(&self, max_age_days: u32) -> SqliteResult<()> {
        let cutoff = crate::media_cache::current_timestamp() - (max_age_days as u64 * 24 * 60 * 60);
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM jobs WHERE finished_at < ?1 AND status IN ('done', 'failed', 'canceled')",
            params![cutoff],
        )?;
        Ok(())
    }
}