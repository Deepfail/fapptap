import { EffectType, Intensity } from '../state/playerStore';

export const EFFECT_PRESETS = {
  flash: {
    low: { duration: 0.08, brightness: 1.8 },
    med: { duration: 0.12, brightness: 2.2 },
    high: { duration: 0.16, brightness: 2.8 },
  },
  rgb_glitch: {
    low: { jitterPx: 2, splitPx: 2, rate: 8 },
    med: { jitterPx: 4, splitPx: 4, rate: 12 },
    high: { jitterPx: 8, splitPx: 8, rate: 16 },
  },
  zoom: {
    low: { scale: 1.05, ease: 'inOutSine', dur: 0.2 },
    med: { scale: 1.12, ease: 'inOutSine', dur: 0.25 },
    high: { scale: 1.2, ease: 'inOutCubic', dur: 0.3 },
  },
  shake: {
    low: { ampPx: 8, freqHz: 8, dur: 0.25 },
    med: { ampPx: 16, freqHz: 12, dur: 0.3 },
    high: { ampPx: 24, freqHz: 16, dur: 0.35 },
  },
} as const;

export const EFFECT_COLORS = {
  flash: '#fbbf24', // yellow-400
  rgb_glitch: '#e879f9', // fuchsia-400
  zoom: '#06b6d4', // cyan-500
  shake: '#fb7185', // rose-400
} as const;

export const INTENSITY_DENSITIES = {
  low: 0.1,   // ~10% of beats
  med: 0.25,  // ~25% of beats
  high: 0.4,  // ~40% of beats
} as const;

export function getEffectPreset(type: EffectType, intensity: Intensity) {
  return EFFECT_PRESETS[type][intensity];
}

export function getEffectColor(type: EffectType): string {
  return EFFECT_COLORS[type];
}

export function getEffectDensity(intensity: Intensity): number {
  return INTENSITY_DENSITIES[intensity];
}