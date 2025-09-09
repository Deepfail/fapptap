use crate::media_cache::{MediaCache, MediaFile, current_timestamp};
use serde::Serialize;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize)]
pub struct ScanBatch {
    pub files: Vec<MediaFile>,
    pub batch_index: u32,
    pub total_batches: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanProgress {
    pub scanned: u32,
    pub total: Option<u32>,
    pub current_path: String,
}

pub struct FileScanner {
    cache: Arc<MediaCache>,
    supported_extensions: HashSet<String>,
    batch_size: usize,
}

impl FileScanner {
    pub fn new(cache: Arc<MediaCache>) -> Self {
        let mut supported_extensions = HashSet::new();
        supported_extensions.insert("mp4".to_string());
        supported_extensions.insert("avi".to_string());
        supported_extensions.insert("mov".to_string());
        supported_extensions.insert("mkv".to_string());
        supported_extensions.insert("wmv".to_string());
        supported_extensions.insert("flv".to_string());
        supported_extensions.insert("webm".to_string());
        supported_extensions.insert("m4v".to_string());

        Self {
            cache,
            supported_extensions,
            batch_size: 200,
        }
    }

    pub async fn scan_directory(
        &self,
        root_path: PathBuf,
        app_handle: AppHandle,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let (tx, mut rx) = mpsc::channel::<Vec<MediaFile>>(32);
        let app_handle_clone = app_handle.clone();

        // Emit scan start event
        app_handle.emit("scan:start", &root_path)?;

        // Spawn file discovery task
        let supported_extensions = self.supported_extensions.clone();
        let batch_size = self.batch_size;
        tokio::spawn(async move {
            let mut current_batch = Vec::new();
            let mut scanned_count = 0u32;
            let current_time = current_timestamp();

            for entry in WalkDir::new(&root_path)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let path = entry.path();
                
                // Skip hidden files and directories
                if path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with('.'))
                    .unwrap_or(false)
                {
                    continue;
                }

                if let Some(extension) = path.extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.to_lowercase())
                {
                    if supported_extensions.contains(&extension) {
                        if let Ok(metadata) = entry.metadata() {
                            let mtime = metadata
                                .modified()
                                .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                                .duration_since(std::time::SystemTime::UNIX_EPOCH)
                                .unwrap()
                                .as_secs();

                            let file = MediaFile {
                                path: path.to_string_lossy().to_string(),
                                mtime,
                                size: metadata.len(),
                                ext: extension,
                                duration: None, // Will be filled later on demand
                                width: None,
                                height: None,
                                codec: None,
                                thumb: None,
                                last_seen: current_time,
                            };

                            current_batch.push(file);
                            scanned_count += 1;

                            if current_batch.len() >= batch_size {
                                if tx.send(current_batch.clone()).await.is_err() {
                                    break;
                                }
                                current_batch.clear();
                            }

                            // Emit progress periodically
                            if scanned_count % 50 == 0 {
                                let _ = app_handle_clone.emit("scan:progress", ScanProgress {
                                    scanned: scanned_count,
                                    total: None,
                                    current_path: path.to_string_lossy().to_string(),
                                });
                            }
                        }
                    }
                }
            }

            // Send remaining files
            if !current_batch.is_empty() {
                let _ = tx.send(current_batch).await;
            }
        });

        // Process batches and emit to frontend
        let mut batch_index = 0u32;
        while let Some(batch) = rx.recv().await {
            // Store in cache
            if let Err(e) = self.cache.upsert_media_batch(&batch) {
                eprintln!("Failed to store batch in cache: {}", e);
            }

            // Emit batch to frontend
            app_handle.emit("scan:batch", ScanBatch {
                files: batch,
                batch_index,
                total_batches: None,
            })?;

            batch_index += 1;
        }

        // Emit scan complete
        app_handle.emit("scan:done", batch_index)?;

        Ok(())
    }

    pub async fn get_cached_files(
        &self,
        extensions: Option<Vec<String>>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<MediaFile>, Box<dyn std::error::Error + Send + Sync>> {
        let exts = extensions.unwrap_or_else(|| {
            self.supported_extensions.iter().cloned().collect()
        });

        Ok(self.cache.get_media_by_ext(&exts, limit, offset)?)
    }

    pub async fn cleanup_old_files(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let cutoff = current_timestamp() - (7 * 24 * 60 * 60); // 7 days ago
        self.cache.cleanup_old_entries(cutoff)?;
        Ok(())
    }
}