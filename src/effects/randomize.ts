import { BeatPoint, Cut, EffectRef, EffectType, Intensity } from '../state/playerStore';
import { getEffectPreset, getEffectDensity } from './presets';
import { createSeededRNG } from '../utils/prng';

function getEffectDuration(type: EffectType, intensity: Intensity): number {
  const preset = getEffectPreset(type, intensity);
  if ('duration' in preset) return preset.duration;
  if ('dur' in preset) return preset.dur;
  return 0.1; // Default fallback
}

export interface RandomizeRequest {
  projectSeed: number;
  intensity: Intensity;
  types: EffectType[];
  cuts: Cut[];
  beats: BeatPoint[];
  perCutMax?: number;
}

export interface RandomizeResult {
  updates: Array<{ cutId: string; effects: EffectRef[] }>;
}

export function randomizeEffectPlacement(request: RandomizeRequest): RandomizeResult {
  const { projectSeed, intensity, types, cuts, beats, perCutMax = 20 } = request;
  const density = getEffectDensity(intensity);
  const updates: Array<{ cutId: string; effects: EffectRef[] }> = [];

  for (const cut of cuts) {
    const cutEffects: EffectRef[] = [];
    
    // Get beats within this cut
    const localBeats = beats.filter(beat => 
      beat.time >= cut.start && beat.time < cut.end
    );

    if (localBeats.length === 0) continue;

    // Calculate number of effects per type
    const totalEffectsTarget = Math.floor(density * localBeats.length);
    const effectsPerType = Math.max(1, Math.floor(totalEffectsTarget / types.length));

    for (const effectType of types) {
      const rng = createSeededRNG(projectSeed, cut.id, effectType);
      const preset = getEffectPreset(effectType, intensity);
      
      // Sample beats for this effect type
      const sampledBeats = sampleBeatsWithoutReplacement(
        localBeats,
        Math.min(effectsPerType, perCutMax),
        rng
      );

      for (const beat of sampledBeats) {
        // Add small jitter (±30ms) to beat placement
        const jitter = (rng() - 0.5) * 0.06; // ±30ms
        const startTime = Math.max(0, beat.time - cut.start + jitter);
        
        const effect: EffectRef = {
          id: generateId(),
          type: effectType,
          intensity,
          start: startTime,
          duration: getEffectDuration(effectType, intensity),
          seed: Math.floor(rng() * 1000000),
          params: { ...preset },
        };

        cutEffects.push(effect);
      }
    }

    // Resolve overlaps within the same cut
    const resolvedEffects = resolveEffectOverlaps(cutEffects);
    
    updates.push({
      cutId: cut.id,
      effects: resolvedEffects,
    });
  }

  return { updates };
}

function sampleBeatsWithoutReplacement(
  beats: BeatPoint[],
  count: number,
  rng: () => number
): BeatPoint[] {
  if (count >= beats.length) return [...beats];
  
  const shuffled = [...beats];
  
  // Fisher-Yates shuffle using seeded RNG
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, count);
}

function resolveEffectOverlaps(effects: EffectRef[]): EffectRef[] {
  // Sort by start time
  const sorted = [...effects].sort((a, b) => a.start - b.start);
  const resolved: EffectRef[] = [];
  
  for (const effect of sorted) {
    let canPlace = true;
    const effectEnd = effect.start + effect.duration;
    
    // Check for overlaps with already placed effects
    for (const existing of resolved) {
      const existingEnd = existing.start + existing.duration;
      
      // Check if effects overlap
      if (!(effect.start >= existingEnd || effectEnd <= existing.start)) {
        canPlace = false;
        break;
      }
    }
    
    if (canPlace) {
      resolved.push(effect);
    }
    // If can't place, drop the effect (greedy approach)
  }
  
  return resolved;
}

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}