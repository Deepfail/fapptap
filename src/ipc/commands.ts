import { invoke } from '@tauri-apps/api/core';

export interface MediaFile {
  path: string;
  mtime: number;
  size: number;
  ext: string;
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
  thumb?: string;
  last_seen: number;
}

export interface ThumbnailResult {
  src_path: string;
  thumb_path: string;
  width: number;
  height: number;
}

export interface JobStats {
  queued: number;
  running: number;
  done: number;
  failed: number;
}

// File scanning commands
export async function scanDirectory(path: string): Promise<string> {
  return invoke('scan_directory', { path });
}

export async function getCachedFiles(
  extensions?: string[],
  limit?: number,
  offset?: number
): Promise<MediaFile[]> {
  return invoke('get_cached_files', { extensions, limit, offset });
}

// Thumbnail commands
export async function requestThumbnail(srcPath: string): Promise<string> {
  return invoke('request_thumbnail', { srcPath });
}

export async function requestProxy(srcPath: string): Promise<string> {
  return invoke('request_proxy', { srcPath });
}

// Video metadata
export async function getVideoMetadata(
  srcPath: string
): Promise<[number | null, number | null, number | null, string | null]> {
  return invoke('get_video_metadata', { srcPath });
}

// Job management
export async function getJobStats(): Promise<[number, number, number, number]> {
  return invoke('get_job_stats');
}

export async function cancelJobsByPrefix(pathPrefix: string): Promise<number> {
  return invoke('cancel_jobs_by_prefix', { pathPrefix });
}

// Event listeners for real-time updates
export function setupScanListeners(callbacks: {
  onScanStart?: (path: string) => void;
  onScanBatch?: (batch: { files: MediaFile[]; batch_index: number; total_batches?: number }) => void;
  onScanProgress?: (progress: { scanned: number; total?: number; current_path: string }) => void;
  onScanDone?: (totalBatches: number) => void;
  onThumbReady?: (result: ThumbnailResult) => void;
  onProxyReady?: (result: { src: string; proxyPath: string }) => void;
}) {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    const { listen } = require('@tauri-apps/api/event');
    
    if (callbacks.onScanStart) {
      listen('scan:start', (event: any) => callbacks.onScanStart!(event.payload));
    }
    
    if (callbacks.onScanBatch) {
      listen('scan:batch', (event: any) => callbacks.onScanBatch!(event.payload));
    }
    
    if (callbacks.onScanProgress) {
      listen('scan:progress', (event: any) => callbacks.onScanProgress!(event.payload));
    }
    
    if (callbacks.onScanDone) {
      listen('scan:done', (event: any) => callbacks.onScanDone!(event.payload));
    }
    
    if (callbacks.onThumbReady) {
      listen('thumb:ready', (event: any) => callbacks.onThumbReady!(event.payload));
    }
    
    if (callbacks.onProxyReady) {
      listen('proxy:ready', (event: any) => callbacks.onProxyReady!(event.payload));
    }
  }
}

// Browser fallbacks for development
const IS_TAURI = typeof window !== 'undefined' && window.__TAURI__;

export function createMockMediaFile(path: string): MediaFile {
  return {
    path,
    mtime: Date.now() / 1000,
    size: Math.floor(Math.random() * 1000000000), // Random size
    ext: path.split('.').pop()?.toLowerCase() || 'mp4',
    duration: 30 + Math.random() * 300, // 30-330 seconds
    width: 1920,
    height: 1080,
    codec: 'h264',
    thumb: undefined,
    last_seen: Date.now() / 1000,
  };
}

// Wrapper functions that provide browser fallbacks
export async function scanDirectoryWithFallback(path: string): Promise<string> {
  if (IS_TAURI) {
    return scanDirectory(path);
  }
  
  // Browser fallback - simulate scan
  console.log(`[Mock] Scanning directory: ${path}`);
  
  // Simulate some mock files
  setTimeout(() => {
    const mockFiles = [
      createMockMediaFile(`${path}/video1.mp4`),
      createMockMediaFile(`${path}/video2.avi`),
      createMockMediaFile(`${path}/video3.mov`),
    ];
    
    // Dispatch mock events if listeners are set up
    window.dispatchEvent(new CustomEvent('mock:scan:batch', {
      detail: { files: mockFiles, batch_index: 0 }
    }));
  }, 1000);
  
  return 'Mock scan started';
}

export async function getCachedFilesWithFallback(
  extensions?: string[],
  limit?: number,
  offset?: number
): Promise<MediaFile[]> {
  if (IS_TAURI) {
    return getCachedFiles(extensions, limit, offset);
  }
  
  // Browser fallback - return mock files
  return [
    createMockMediaFile('/mock/sample1.mp4'),
    createMockMediaFile('/mock/sample2.avi'),
    createMockMediaFile('/mock/sample3.mov'),
  ].slice(offset || 0, (offset || 0) + (limit || 50));
}