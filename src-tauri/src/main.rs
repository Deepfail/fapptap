// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod media_cache;
mod file_scanner;
mod thumbnail_generator;
mod job_queue;

use media_cache::{MediaCache, MediaFile};
use file_scanner::FileScanner;
use thumbnail_generator::ThumbnailGenerator;
use job_queue::{JobQueue, JobKind, JobStatus};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;

// Application state
#[derive(Default)]
pub struct AppState {
    pub media_cache: Option<Arc<MediaCache>>,
    pub file_scanner: Option<Arc<FileScanner>>,
    pub thumbnail_generator: Option<Arc<ThumbnailGenerator>>,
    pub job_queue: Option<Arc<JobQueue>>,
}

// Tauri commands
#[tauri::command]
async fn scan_directory(
    path: String,
    app_handle: AppHandle,
    state: State<'_, RwLock<AppState>>,
) -> Result<String, String> {
    let state = state.read().await;
    
    if let Some(scanner) = &state.file_scanner {
        let path_buf = PathBuf::from(path);
        scanner.scan_directory(path_buf, app_handle).await
            .map_err(|e| e.to_string())?;
        Ok("Scan started".to_string())
    } else {
        Err("File scanner not initialized".to_string())
    }
}

#[tauri::command]
async fn get_cached_files(
    extensions: Option<Vec<String>>,
    limit: Option<u32>,
    offset: Option<u32>,
    state: State<'_, RwLock<AppState>>,
) -> Result<Vec<MediaFile>, String> {
    let state = state.read().await;
    
    if let Some(scanner) = &state.file_scanner {
        scanner.get_cached_files(extensions, limit, offset).await
            .map_err(|e| e.to_string())
    } else {
        Err("File scanner not initialized".to_string())
    }
}

#[tauri::command]
async fn request_thumbnail(
    src_path: String,
    app_handle: AppHandle,
    state: State<'_, RwLock<AppState>>,
) -> Result<String, String> {
    let state_read = state.read().await;
    
    if let (Some(generator), Some(queue)) = (&state_read.thumbnail_generator, &state_read.job_queue) {
        let generator = Arc::clone(generator);
        let queue = Arc::clone(queue);
        drop(state_read);

        // Add job to queue
        let job_id = queue.add_job(
            JobKind::Thumb,
            src_path.clone(),
            0, // High priority for viewport items
            serde_json::json!({ "src_path": src_path })
        ).map_err(|e| e.to_string())?;

        // Start processing job immediately if possible
        let job_id_clone = job_id.clone();
        tokio::spawn(async move {
            if let Ok(Some(job)) = queue.get_next_job() {
                if job.id == job_id_clone {
                    let _ = queue.update_job_status(&job.id, JobStatus::Running, None, None);
                    
                    match generator.generate_thumbnail(PathBuf::from(&job.path), app_handle).await {
                        Ok(result) => {
                            let _ = queue.update_job_status(&job.id, JobStatus::Done, Some(serde_json::to_value(result).unwrap()), None);
                        }
                        Err(e) => {
                            let _ = queue.update_job_status(&job.id, JobStatus::Failed, None, Some(e.to_string()));
                        }
                    }
                }
            }
        });

        Ok(job_id)
    } else {
        Err("Thumbnail generator not initialized".to_string())
    }
}

#[tauri::command]
async fn request_proxy(
    src_path: String,
    app_handle: AppHandle,
    state: State<'_, RwLock<AppState>>,
) -> Result<String, String> {
    let state_read = state.read().await;
    
    if let Some(generator) = &state_read.thumbnail_generator {
        let generator = Arc::clone(generator);
        drop(state_read);

        generator.generate_proxy_clip(PathBuf::from(src_path), app_handle).await
            .map_err(|e| e.to_string())
    } else {
        Err("Thumbnail generator not initialized".to_string())
    }
}

#[tauri::command]
async fn get_video_metadata(
    src_path: String,
    state: State<'_, RwLock<AppState>>,
) -> Result<(Option<f64>, Option<u32>, Option<u32>, Option<String>), String> {
    let state = state.read().await;
    
    if let Some(generator) = &state.thumbnail_generator {
        generator.get_video_metadata(PathBuf::from(src_path)).await
            .map_err(|e| e.to_string())
    } else {
        Err("Thumbnail generator not initialized".to_string())
    }
}

#[tauri::command]
async fn get_job_stats(
    state: State<'_, RwLock<AppState>>,
) -> Result<(u32, u32, u32, u32), String> {
    let state = state.read().await;
    
    if let Some(queue) = &state.job_queue {
        queue.get_job_stats().map_err(|e| e.to_string())
    } else {
        Err("Job queue not initialized".to_string())
    }
}

#[tauri::command]
async fn cancel_jobs_by_prefix(
    path_prefix: String,
    state: State<'_, RwLock<AppState>>,
) -> Result<u32, String> {
    let state = state.read().await;
    
    if let Some(queue) = &state.job_queue {
        queue.cancel_jobs_by_prefix(&path_prefix).map_err(|e| e.to_string())
    } else {
        Err("Job queue not initialized".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(RwLock::new(AppState::default()))
        .setup(|app| {
            // Initialize caches and services
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data directory");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

            let cache_db_path = app_data_dir.join("media_cache.db");
            let job_db_path = app_data_dir.join("jobs.db");
            let thumbnail_cache_dir = app_data_dir.join("thumbnails");

            let media_cache = Arc::new(MediaCache::new(cache_db_path).expect("Failed to initialize media cache"));
            let file_scanner = Arc::new(FileScanner::new(Arc::clone(&media_cache)));
            let thumbnail_generator = Arc::new(ThumbnailGenerator::new(Arc::clone(&media_cache), thumbnail_cache_dir));
            let job_queue = Arc::new(JobQueue::new(job_db_path).expect("Failed to initialize job queue"));

            // Update app state
            let state = app.state::<RwLock<AppState>>();
            let mut state_guard = state.blocking_write();
            state_guard.media_cache = Some(media_cache);
            state_guard.file_scanner = Some(file_scanner);
            state_guard.thumbnail_generator = Some(thumbnail_generator);
            state_guard.job_queue = Some(job_queue);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            get_cached_files,
            request_thumbnail,
            request_proxy,
            get_video_metadata,
            get_job_stats,
            cancel_jobs_by_prefix
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

