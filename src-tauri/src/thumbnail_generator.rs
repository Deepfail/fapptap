use crate::media_cache::{MediaCache, current_timestamp};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct ThumbnailResult {
    pub src_path: String,
    pub thumb_path: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThumbnailProgress {
    pub src_path: String,
    pub status: String, // "generating" | "completed" | "failed"
    pub error: Option<String>,
}

pub struct ThumbnailGenerator {
    cache: Arc<MediaCache>,
    cache_dir: PathBuf,
    max_concurrent: usize,
}

impl ThumbnailGenerator {
    pub fn new(cache: Arc<MediaCache>, cache_dir: PathBuf) -> Self {
        // Ensure cache directory exists
        if let Err(e) = std::fs::create_dir_all(&cache_dir) {
            eprintln!("Failed to create thumbnail cache directory: {}", e);
        }

        Self {
            cache,
            cache_dir,
            max_concurrent: 2, // Limit concurrent ffmpeg processes
        }
    }

    pub fn generate_cache_key(&self, file_path: &str, mtime: u64) -> String {
        let mut hasher = Sha1::new();
        hasher.update(file_path.as_bytes());
        hasher.update(mtime.to_string().as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub async fn generate_thumbnail(
        &self,
        src_path: PathBuf,
        app_handle: AppHandle,
    ) -> Result<ThumbnailResult, Box<dyn std::error::Error + Send + Sync>> {
        let src_str = src_path.to_string_lossy().to_string();
        
        // Emit progress
        app_handle.emit("thumb:progress", ThumbnailProgress {
            src_path: src_str.clone(),
            status: "generating".to_string(),
            error: None,
        })?;

        // Get file metadata for cache key
        let metadata = tokio::fs::metadata(&src_path).await?;
        let mtime = metadata
            .modified()?
            .duration_since(std::time::SystemTime::UNIX_EPOCH)?
            .as_secs();

        let cache_key = self.generate_cache_key(&src_str, mtime);
        let thumb_path = self.cache_dir.join(format!("{}.jpg", cache_key));

        // Check if thumbnail already exists
        if thumb_path.exists() {
            // Read dimensions if available (you could store these in DB too)
            let result = ThumbnailResult {
                src_path: src_str.clone(),
                thumb_path: thumb_path.to_string_lossy().to_string(),
                width: 480, // Default fallback
                height: 270,
            };

            app_handle.emit("thumb:ready", &result)?;
            return Ok(result);
        }

        // Generate thumbnail using ffmpeg
        let output = Command::new("ffmpeg")
            .args([
                "-y",                                    // Overwrite output
                "-ss", "00:00:03",                      // Seek to 3 seconds
                "-i", &src_str,                         // Input file
                "-frames:v", "1",                       // Single frame
                "-vf", "scale='min(480,iw)':-1:flags=bicubic", // Scale preserving aspect
                "-q:v", "3",                            // JPEG quality
                &thumb_path.to_string_lossy(),          // Output
            ])
            .output()
            .await?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            app_handle.emit("thumb:progress", ThumbnailProgress {
                src_path: src_str.clone(),
                status: "failed".to_string(),
                error: Some(error_msg.to_string()),
            })?;
            return Err(format!("FFmpeg failed: {}", error_msg).into());
        }

        // Update cache with thumbnail path
        self.cache.update_heavy_fields(&src_str, None, None, None, None)?;

        let result = ThumbnailResult {
            src_path: src_str.clone(),
            thumb_path: thumb_path.to_string_lossy().to_string(),
            width: 480, // You could probe actual dimensions here
            height: 270,
        };

        app_handle.emit("thumb:ready", &result)?;
        app_handle.emit("thumb:progress", ThumbnailProgress {
            src_path: src_str,
            status: "completed".to_string(),
            error: None,
        })?;

        Ok(result)
    }

    pub async fn generate_proxy_clip(
        &self,
        src_path: PathBuf,
        app_handle: AppHandle,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let src_str = src_path.to_string_lossy().to_string();
        
        let metadata = tokio::fs::metadata(&src_path).await?;
        let mtime = metadata
            .modified()?
            .duration_since(std::time::SystemTime::UNIX_EPOCH)?
            .as_secs();

        let cache_key = self.generate_cache_key(&src_str, mtime);
        let proxy_path = self.cache_dir.join(format!("{}_proxy.mp4", cache_key));

        // Check if proxy already exists
        if proxy_path.exists() {
            let result = proxy_path.to_string_lossy().to_string();
            app_handle.emit("proxy:ready", serde_json::json!({
                "src": src_str,
                "proxyPath": result
            }))?;
            return Ok(result);
        }

        // Generate 3-5 second preview clip
        let output = Command::new("ffmpeg")
            .args([
                "-y",                                    // Overwrite output
                "-ss", "2",                             // Start at 2 seconds
                "-i", &src_str,                         // Input file
                "-t", "4",                              // Duration 4 seconds
                "-an",                                  // No audio
                "-vf", "scale=426:-2",                  // Scale to 426px wide
                "-c:v", "libx264",                      // H.264 codec
                "-preset", "veryfast",                  // Fast encoding
                "-crf", "28",                           // Compression
                "-pix_fmt", "yuv420p",                  // Pixel format
                &proxy_path.to_string_lossy(),          // Output
            ])
            .output()
            .await?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg proxy generation failed: {}", error_msg).into());
        }

        let result = proxy_path.to_string_lossy().to_string();
        app_handle.emit("proxy:ready", serde_json::json!({
            "src": src_str,
            "proxyPath": result
        }))?;

        Ok(result)
    }

    pub async fn get_video_metadata(
        &self,
        src_path: PathBuf,
    ) -> Result<(Option<f64>, Option<u32>, Option<u32>, Option<String>), Box<dyn std::error::Error + Send + Sync>> {
        let src_str = src_path.to_string_lossy().to_string();

        let output = Command::new("ffprobe")
            .args([
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                &src_str,
            ])
            .output()
            .await?;

        if !output.status.success() {
            return Ok((None, None, None, None));
        }

        let json: serde_json::Value = serde_json::from_slice(&output.stdout)?;
        
        let mut duration = None;
        let mut width = None;
        let mut height = None;
        let mut codec = None;

        // Extract duration from format
        if let Some(format) = json.get("format") {
            if let Some(dur_str) = format.get("duration").and_then(|v| v.as_str()) {
                duration = dur_str.parse::<f64>().ok();
            }
        }

        // Extract video stream info
        if let Some(streams) = json.get("streams").and_then(|v| v.as_array()) {
            for stream in streams {
                if stream.get("codec_type").and_then(|v| v.as_str()) == Some("video") {
                    width = stream.get("width").and_then(|v| v.as_u64()).map(|v| v as u32);
                    height = stream.get("height").and_then(|v| v.as_u64()).map(|v| v as u32);
                    codec = stream.get("codec_name").and_then(|v| v.as_str()).map(|s| s.to_string());
                    break;
                }
            }
        }

        Ok((duration, width, height, codec))
    }
}