/**
 * MP4 renderer for FAPPTap - generates actual video files as alternative to ffplay
 */

import { Command } from '@tauri-apps/plugin-shell';
import { Timeline } from './types';
import { buildInputList, buildFilterComplex, writeCache, normalize } from './ffgraph';
import { isTauriAvailable } from '@/lib/platform';

export interface RenderOptions {
  outputPath?: string;
  preset?: 'preview' | 'draft' | 'final';
}

export interface RenderProgress {
  isRendering: boolean;
  progress?: number;
  currentFrame?: number;
  totalFrames?: number;
  error?: string;
}

/**
 * Render timeline to MP4 file
 */
export async function renderToMP4(
  timeline: Timeline,
  options: RenderOptions = {}
): Promise<string> {
  if (!isTauriAvailable()) {
    throw new Error('MP4 rendering requires desktop mode');
  }

  const outputPath = options.outputPath || 'C:/Files/Projects/fapptap/cache/preview/rendered.mp4';
  const preset = options.preset || 'preview';

  try {
    // Generate input list and filter complex
    const inputList = buildInputList(timeline);
    const { complex, vOut, aOut } = buildFilterComplex(timeline);

    // Write temporary files
    const inputsPath = await writeCache('render_inputs.txt', inputList);
    // Don't write filter graph to file, use directly in command
    
    // Build ffmpeg command arguments for rendering
    const args = [
      '-hide_banner',
      '-y', // Overwrite output file
      '-f', 'concat',
      '-safe', '0',
      '-protocol_whitelist', 'file,pipe,concat,subfile',
      '-i', normalize(inputsPath),
      '-filter_complex', complex, // Use filter_complex directly instead of script file
      '-map', `[${vOut}]`,
      '-map', `[${aOut}]`,
    ];

    // Add quality settings based on preset
    switch (preset) {
      case 'preview':
        args.push(
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-pix_fmt', 'yuv420p',
          '-r', '24',
          '-c:a', 'aac',
          '-b:a', '96k',
          '-ac', '2',
          '-movflags', '+faststart'
        );
        break;
      case 'draft':
        args.push(
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-r', '30',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ac', '2',
          '-movflags', '+faststart'
        );
        break;
      case 'final':
        args.push(
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '18',
          '-pix_fmt', 'yuv420p',
          '-r', `${timeline.fps}`,
          '-c:a', 'aac',
          '-b:a', '192k',
          '-ac', '2',
          '-movflags', '+faststart'
        );
        break;
    }

    args.push(normalize(outputPath));

    console.log('Rendering MP4 with ffmpeg args:', args);

    // Start the rendering process
    const command = Command.sidecar('binaries/ffmpegbin', args);
    const output = await command.execute();

    if (output.code !== 0) {
      throw new Error(`FFmpeg render failed with code ${output.code}: ${output.stderr}`);
    }

    console.log('MP4 render completed:', outputPath);
    return outputPath;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to render MP4:', errorMessage);
    throw error;
  }
}

/**
 * Check if rendered MP4 file exists and get info
 */
export async function getRenderedFileInfo(filePath: string) {
  const { exists, stat } = await import('@tauri-apps/plugin-fs');
  
  if (!(await exists(filePath))) {
    return null;
  }

  const meta = await stat(filePath);
  return {
    size: meta.size,
    created: meta.birthtime || meta.mtime,
    modified: meta.mtime,
  };
}

/**
 * Open rendered MP4 file in default video player
 */
export async function openRenderedFile(filePath: string) {
  const { open } = await import('@tauri-apps/plugin-shell');
  return open(filePath);
}