/**
 * TypeScript definitions for FAPPTap Live FFPlay Basic Mode 2.0
 */

// Chosen by the user on the "Create" screen
export interface CreateRequest {
  audioPath: string;
  audioPreset: "30s" | "1m" | "2m" | "3m" | "full"; // trims analysis/preview length
  videoLength: "30s" | "1m" | "2m" | "3m" | "full";
  clipOrder: "random" | "byTitle";
}

// Derived by analysis
export interface Beat {
  t: number;
  strength: number;
  isDownbeat?: boolean;
}

export interface NoCutZone {
  start: number;
  end: number;
}

export type EffectKind = "fast_cut" | "prism" | "zoom" | "jump_cut" | "flash" | "rgb" | "glitch" | "shake";
export type Intensity = "low" | "med" | "high";

export interface ClipRef {
  filePath: string; // absolute path
  in: number; // seconds in source
  out: number; // seconds in source
  speed?: number; // default 1.0
  effects?: { kind: EffectKind; intensity: Intensity }[];
  audioGainDb?: number; // optional per-clip gain
  xfadeToNextMs?: number; // optional crossfade
}

export interface Timeline {
  fps: number;
  previewScale: number; // 0.25/0.5/1.0
  globalTempo: number; // 0.5 .. 2.0 affects density/intensity
  noCutZones: NoCutZone[]; // on audio timeline
  clips: ClipRef[]; // ordered
}

// Effect intensity mappings
export interface EffectMapping {
  kind: EffectKind;
  intensity: Intensity;
  filterString: string;
}

// Preview process state
export interface PreviewState {
  isRunning: boolean;
  processId?: number;
  startTime?: number;
  error?: string;
}

// Duration presets in seconds
export const DURATION_PRESETS = {
  "30s": 30,
  "1m": 60,
  "2m": 120,
  "3m": 180,
  "full": -1, // Use full track length
} as const;