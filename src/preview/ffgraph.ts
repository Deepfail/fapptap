/**
 * FFmpeg filtergraph generation for FAPPTap Live FFPlay
 * Builds concat input lists and filter_complex for real-time preview
 */

import { Timeline, ClipRef, EffectKind, Intensity } from './types';

// Cross-platform path normalization
export function normalize(p: string): string {
  return p.replace(/\\/g, '/');
}

// Cross-platform path joining
export function pathJoin(...parts: string[]): string {
  return parts.map(p => p.replace(/\\/g, '/')).join('/');
}

// Effect mapping table (first pass implementation)
const EFFECT_MAPPINGS: Record<EffectKind, Record<Intensity, string>> = {
  fast_cut: {
    low: '', // handled by shorter clip duration (beats/2)
    med: '', // beats/3
    high: '', // beats/4
  },
  prism: {
    low: 'tblend=all_mode=lighten',
    med: 'tblend=all_mode=screen',
    high: 'tblend=all_mode=add',
  },
  zoom: {
    low: "zoompan=z='min(zoom+0.002,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
    med: "zoompan=z='min(zoom+0.004,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
    high: "zoompan=z='min(zoom+0.006,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
  },
  jump_cut: {
    low: 'select=\'not(mod(n\\,60))\'', // skip 1-2 frames every 60
    med: 'select=\'not(mod(n\\,40))\'', // skip 2-3 frames every 40
    high: 'select=\'not(mod(n\\,30))\'', // skip 3-4 frames every 30
  },
  flash: {
    low: 'lutyuv=y=val*1.1',
    med: 'lutyuv=y=val*1.2',
    high: 'lutyuv=y=val*1.3',
  },
  rgb: {
    low: 'chromashift=cbh=2:crh=-2',
    med: 'chromashift=cbh=3:crh=-3',
    high: 'chromashift=cbh=4:crh=-4',
  },
  glitch: {
    low: 'noise=alls=2:allf=t+u',
    med: 'noise=alls=4:allf=t+u',
    high: 'noise=alls=6:allf=t+u',
  },
  shake: {
    low: "rotate='0.002*sin(2*PI*t)'",
    med: "rotate='0.004*sin(2*PI*t)'",
    high: "rotate='0.006*sin(2*PI*t)'",
  },
};

/**
 * Build FFmpeg concat input list from timeline clips
 */
export function buildInputList(tl: Timeline): string {
  const lines: string[] = [];
  
  for (const clip of tl.clips) {
    // Normalize path for cross-platform compatibility
    const normalizedPath = normalize(clip.filePath);
    lines.push(`file '${normalizedPath}'`);
  }
  
  return lines.join('\n');
}

/**
 * Generate effect filter string for a clip
 */
function generateEffectFilters(clip: ClipRef, tl: Timeline): string {
  if (!clip.effects || clip.effects.length === 0) {
    return '';
  }
  
  const filters: string[] = [];
  
  for (const effect of clip.effects) {
    const effectFilter = EFFECT_MAPPINGS[effect.kind]?.[effect.intensity];
    if (effectFilter) {
      // Scale effect intensity based on global tempo
      if (effect.kind === 'zoom' || effect.kind === 'shake') {
        // For parametric effects, scale the values
        let scaledFilter = effectFilter;
        if (tl.globalTempo !== 1.0) {
          // Increase intensity for higher tempo
          const factor = Math.pow(tl.globalTempo, 0.5);
          scaledFilter = scaledFilter.replace(/0\.002/g, (0.002 * factor).toFixed(6));
          scaledFilter = scaledFilter.replace(/0\.004/g, (0.004 * factor).toFixed(6));
          scaledFilter = scaledFilter.replace(/0\.006/g, (0.006 * factor).toFixed(6));
        }
        filters.push(scaledFilter);
      } else {
        filters.push(effectFilter);
      }
    }
  }
  
  return filters.join(',');
}

/**
 * Generate atempo chain for speed adjustment
 */
function generateAtempoChain(speed: number): string {
  if (speed === 1.0) return '';
  
  // FFmpeg atempo filter has limitations: 0.5 <= rate <= 100.0
  // For larger changes, chain multiple atempo filters
  const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
  
  if (clampedSpeed === 1.0) return '';
  
  return `atempo=${clampedSpeed.toFixed(3)}`;
}

/**
 * Build complex filtergraph for FFmpeg
 */
export function buildFilterComplex(tl: Timeline): { complex: string; vOut: string; aOut: string } {
  const videoFilters: string[] = [];
  const audioFilters: string[] = [];
  const videoLabels: string[] = [];
  const audioLabels: string[] = [];
  
  // Process each clip
  for (let i = 0; i < tl.clips.length; i++) {
    const clip = tl.clips[i];
    const speed = clip.speed || 1.0;
    
    // Video processing for clip i
    let videoChain = `[${i}:v]`;
    
    // Trim video
    videoChain += `trim=start=${clip.in.toFixed(3)}:end=${clip.out.toFixed(3)},`;
    videoChain += 'setpts=PTS-STARTPTS,';
    
    // Apply speed change
    if (speed !== 1.0) {
      videoChain += `setpts=${(1/speed).toFixed(3)}*PTS,`;
    }
    
    // Apply scale for preview
    if (tl.previewScale !== 1.0) {
      const scale = Math.max(0.25, Math.min(1.0, tl.previewScale));
      videoChain += `scale=iw*${scale}:ih*${scale},`;
    }
    
    // Apply effects
    const effectFilters = generateEffectFilters(clip, tl);
    if (effectFilters) {
      videoChain += effectFilters + ',';
    }
    
    // Set FPS
    videoChain += `fps=${tl.fps}`;
    
    const videoLabel = `v${i}`;
    videoChain += `[${videoLabel}]`;
    videoFilters.push(videoChain);
    videoLabels.push(videoLabel);
    
    // Audio processing for clip i
    let audioChain = `[${i}:a]`;
    
    // Trim audio
    audioChain += `atrim=start=${clip.in.toFixed(3)}:end=${clip.out.toFixed(3)},`;
    audioChain += 'asetpts=PTS-STARTPTS,';
    
    // Apply speed change
    const atempoChain = generateAtempoChain(speed);
    if (atempoChain) {
      audioChain += atempoChain + ',';
    }
    
    // Apply volume adjustment
    if (clip.audioGainDb) {
      const volumeDb = Math.max(-20, Math.min(20, clip.audioGainDb));
      audioChain += `volume=${volumeDb}dB,`;
    }
    
    // Remove trailing comma
    if (audioChain.endsWith(',')) {
      audioChain = audioChain.slice(0, -1);
    }
    
    const audioLabel = `a${i}`;
    audioChain += `[${audioLabel}]`;
    audioFilters.push(audioChain);
    audioLabels.push(audioLabel);
  }
  
  // Concatenate all clips
  let concatFilter = '';
  if (tl.clips.length > 1) {
    // Video concat
    const vInputs = videoLabels.join('');
    concatFilter += `${vInputs}concat=n=${tl.clips.length}:v=1:a=0[vout];`;
    
    // Audio mix (simple amix for now, could be improved with crossfades)
    const aInputs = audioLabels.join('');
    concatFilter += `${aInputs}amix=inputs=${tl.clips.length}:duration=longest[aout]`;
  } else if (tl.clips.length === 1) {
    // Single clip, just rename labels
    concatFilter = `[${videoLabels[0]}]copy[vout];[${audioLabels[0]}]copy[aout]`;
  }
  
  // Combine all filters
  const allFilters = [...videoFilters, ...audioFilters];
  if (concatFilter) {
    allFilters.push(concatFilter);
  }
  
  return {
    complex: allFilters.join(';'),
    vOut: 'vout',
    aOut: 'aout',
  };
}

/**
 * Write content to cache directory and return absolute path
 */
export async function writeCache(relPath: string, content: string): Promise<string> {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  const { appDataDir } = await import('@tauri-apps/api/path');
  
  const appData = await appDataDir();
  const fullPath = pathJoin(appData, 'FAPPTap', 'cache', 'preview', relPath);
  
  await writeTextFile(fullPath, content, { 
    createNew: false,
    baseDir: undefined 
  });
  
  return fullPath;
}