/**
 * Timeline generation logic for FAPPTap Live FFPlay
 * Creates timelines from beats, clips, and user preferences
 */

import { Beat, ClipRef, Timeline, CreateRequest, NoCutZone, DURATION_PRESETS } from './types';
import { PythonWorker } from '@/lib/worker';
import { isTauriAvailable } from '@/lib/platform';

// Constants for timeline generation
const MIN_CLIP_DURATION = 0.1; // minimum clip duration in seconds
const MAX_CLIP_DURATION = 5.0; // maximum clip duration in seconds
const DEFAULT_FPS = 30;
const DEFAULT_PREVIEW_SCALE = 0.5;

/**
 * Audio analysis result from Python worker
 */
interface AudioAnalysis {
  audio: string;
  sr: number;
  tempo: number;
  beats_sec: number[];
  downbeats_sec?: number[];
}

/**
 * Generate timeline from create request
 */
export async function generateTimeline(
  request: CreateRequest,
  clipPaths: string[],
  noCutZones: NoCutZone[] = []
): Promise<Timeline> {
  if (!isTauriAvailable()) {
    throw new Error('Timeline generation requires desktop mode for audio analysis');
  }

  // Step 1: Analyze audio
  const audioAnalysis = await analyzeAudio(request.audioPath, request.audioPreset);
  
  // Step 2: Convert to Beat objects
  const beats = convertToBeats(audioAnalysis);
  
  // Step 3: Determine target duration
  const targetDuration = getTargetDuration(request.videoLength, audioAnalysis);
  
  // Step 4: Order clips
  const orderedClips = orderClips(clipPaths, request.clipOrder);
  
  // Step 5: Generate clip references from beats
  const clipRefs = generateClipRefs(
    beats,
    orderedClips,
    targetDuration,
    noCutZones,
    1.0 // default tempo, will be adjustable in UI
  );

  return {
    fps: DEFAULT_FPS,
    previewScale: DEFAULT_PREVIEW_SCALE,
    globalTempo: 1.0,
    noCutZones,
    clips: clipRefs,
  };
}

/**
 * Analyze audio using Python worker
 */
async function analyzeAudio(audioPath: string, preset: CreateRequest['audioPreset']): Promise<AudioAnalysis> {
  const worker = new PythonWorker();
  
  // Determine analysis duration
  const maxDuration = preset === 'full' ? undefined : DURATION_PRESETS[preset];
  
  // Prepare arguments for the worker
  const args: Record<string, string | boolean> = {
    'audio-path': audioPath,
    'output': 'cache/analysis/beats.json',
  };
  
  if (maxDuration && maxDuration > 0) {
    args['max-duration'] = maxDuration.toString();
  }

  try {
    // Run beats analysis
    await worker.runStage('beats', args);
    
    // Read the results
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const { appDataDir } = await import('@tauri-apps/api/path');
    
    const appData = await appDataDir();
    const beatsPath = `${appData}/FAPPTap/cache/analysis/beats.json`;
    
    const beatsContent = await readTextFile(beatsPath);
    const analysis: AudioAnalysis = JSON.parse(beatsContent);
    
    return analysis;
  } catch (error) {
    console.error('Audio analysis failed:', error);
    throw new Error(`Failed to analyze audio: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert audio analysis to Beat objects
 */
function convertToBeats(analysis: AudioAnalysis): Beat[] {
  const beats: Beat[] = [];
  const downbeatSet = new Set(analysis.downbeats_sec || []);
  
  for (const time of analysis.beats_sec) {
    beats.push({
      t: time,
      strength: downbeatSet.has(time) ? 1.0 : 0.7, // Higher strength for downbeats
      isDownbeat: downbeatSet.has(time),
    });
  }
  
  return beats.sort((a, b) => a.t - b.t);
}

/**
 * Get target duration based on video length setting and audio analysis
 */
function getTargetDuration(videoLength: CreateRequest['videoLength'], analysis: AudioAnalysis): number {
  if (videoLength === 'full') {
    // Use the duration of the analyzed audio
    const lastBeat = Math.max(...analysis.beats_sec);
    return lastBeat + 2; // Add small buffer
  }
  
  const requestedDuration = DURATION_PRESETS[videoLength];
  const lastBeat = Math.max(...analysis.beats_sec);
  
  // Don't exceed available audio
  return Math.min(requestedDuration, lastBeat + 2);
}

/**
 * Order clips based on user preference
 */
function orderClips(clipPaths: string[], order: CreateRequest['clipOrder']): string[] {
  const clips = [...clipPaths];
  
  if (order === 'random') {
    // Fisher-Yates shuffle
    for (let i = clips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [clips[i], clips[j]] = [clips[j], clips[i]];
    }
  } else if (order === 'byTitle') {
    // Sort by filename
    clips.sort((a, b) => {
      const nameA = a.split('/').pop()?.split('\\').pop() || '';
      const nameB = b.split('/').pop()?.split('\\').pop() || '';
      return nameA.localeCompare(nameB);
    });
  }
  
  return clips;
}

/**
 * Generate clip references from beats
 */
function generateClipRefs(
  beats: Beat[],
  clipPaths: string[],
  targetDuration: number,
  noCutZones: NoCutZone[],
  globalTempo: number
): ClipRef[] {
  if (beats.length === 0 || clipPaths.length === 0) {
    return [];
  }

  const clips: ClipRef[] = [];
  let currentTime = 0;
  let clipIndex = 0;
  let clipCursors: Map<string, number> = new Map(); // Track position in each clip
  
  // Filter beats that are within no-cut zones
  const allowedBeats = beats.filter(beat => 
    !noCutZones.some(zone => beat.t >= zone.start && beat.t <= zone.end)
  );
  
  // Apply tempo scaling to beat intervals
  const scaledBeats = applyTempoScaling(allowedBeats, globalTempo);
  
  for (let i = 0; i < scaledBeats.length - 1 && currentTime < targetDuration; i++) {
    const currentBeat = scaledBeats[i];
    const nextBeat = scaledBeats[i + 1];
    
    // Calculate segment duration
    let segmentDuration = (nextBeat.t - currentBeat.t) / globalTempo;
    segmentDuration = Math.max(MIN_CLIP_DURATION, Math.min(MAX_CLIP_DURATION, segmentDuration));
    
    // Don't exceed target duration
    if (currentTime + segmentDuration > targetDuration) {
      segmentDuration = targetDuration - currentTime;
      if (segmentDuration < MIN_CLIP_DURATION) {
        break;
      }
    }
    
    // Select clip
    const clipPath = clipPaths[clipIndex % clipPaths.length];
    clipIndex++;
    
    // Get or initialize cursor for this clip
    let cursor = clipCursors.get(clipPath) || 0;
    
    // Create clip reference
    const clipRef: ClipRef = {
      filePath: clipPath,
      in: cursor,
      out: cursor + segmentDuration,
      speed: 1.0,
      effects: generateEffectsForBeat(currentBeat, i),
    };
    
    clips.push(clipRef);
    
    // Update cursor
    cursor += segmentDuration;
    // TODO: Handle clip duration limits and wraparound
    clipCursors.set(clipPath, cursor);
    
    currentTime += segmentDuration;
  }
  
  return clips;
}

/**
 * Apply tempo scaling to beats
 */
function applyTempoScaling(beats: Beat[], globalTempo: number): Beat[] {
  if (globalTempo === 1.0) {
    return beats;
  }
  
  // For higher tempo, use more frequent beats (every Nth beat)
  const stride = Math.max(1, Math.round(2 - globalTempo));
  
  return beats.filter((_, index) => index % stride === 0);
}

/**
 * Generate effects for a beat based on its properties
 */
function generateEffectsForBeat(beat: Beat, index: number): ClipRef['effects'] {
  const effects: NonNullable<ClipRef['effects']> = [];
  
  // Add effects based on beat strength and position
  if (beat.isDownbeat) {
    // Stronger effects on downbeats
    if (Math.random() < 0.3) {
      effects.push({
        kind: 'flash',
        intensity: beat.strength > 0.8 ? 'high' : 'med'
      });
    }
  }
  
  // Random effects based on index pattern
  if (index % 4 === 0 && Math.random() < 0.2) {
    effects.push({
      kind: 'zoom',
      intensity: 'low'
    });
  }
  
  if (index % 8 === 0 && Math.random() < 0.15) {
    effects.push({
      kind: 'prism',
      intensity: 'med'
    });
  }
  
  return effects.length > 0 ? effects : undefined;
}

/**
 * Update timeline with new tempo
 */
export function updateTimelineWithTempo(timeline: Timeline, newTempo: number): Timeline {
  return {
    ...timeline,
    globalTempo: newTempo,
    clips: timeline.clips.map(clip => ({
      ...clip,
      // Could adjust clip speed here if desired
      effects: clip.effects?.map(effect => ({
        ...effect,
        // Could scale effect intensity based on tempo
      }))
    }))
  };
}

/**
 * Update timeline with new no-cut zones
 */
export function updateTimelineWithNoCutZones(timeline: Timeline, noCutZones: NoCutZone[]): Timeline {
  return {
    ...timeline,
    noCutZones,
    // Note: For real-time editing, you might want to regenerate clips
    // to respect the new no-cut zones, but that would require re-running
    // the full generation logic
  };
}

/**
 * Add or update effects on a specific clip
 */
export function updateClipEffects(
  timeline: Timeline,
  clipIndex: number,
  effects: ClipRef['effects']
): Timeline {
  if (clipIndex < 0 || clipIndex >= timeline.clips.length) {
    return timeline;
  }
  
  const updatedClips = [...timeline.clips];
  updatedClips[clipIndex] = {
    ...updatedClips[clipIndex],
    effects
  };
  
  return {
    ...timeline,
    clips: updatedClips
  };
}