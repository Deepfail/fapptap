export type Transition =
  | { type: "flash_cut"; durF?: number; intensity?: number }
  | { type: "crossfade"; durF: number }
  | { type: "whip_pan"; durF: number; dir: "left" | "right" }
  | { type: "dip_to_black"; durF: number };

export const DEFAULT_TRANSITION_FRAMES = {
  flash_cut: 2,
  crossfade: 8,
  whip_pan: 8,
  dip_to_black: 6,
} as const;

export const TRANSITION_LABELS = {
  flash_cut: "Flash Cut",
  crossfade: "Crossfade",
  whip_pan: "Whip Pan",
  dip_to_black: "Dip to Black",
} as const;
