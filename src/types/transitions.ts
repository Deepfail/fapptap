// types/transitions.ts
export type Transition =
  | { type: "flash_cut"; durF?: number; intensity?: number }
  | { type: "crossfade"; durF: number }
  | { type: "whip_pan"; durF: number; dir: "left" | "right" }
  | { type: "dip_to_black"; durF: number };

// Helper functions for working with transitions
export const defaultTransitions = {
  flash_cut: { type: "flash_cut" as const, durF: 2, intensity: 1 },
  crossfade: { type: "crossfade" as const, durF: 8 },
  whip_pan_left: { type: "whip_pan" as const, durF: 8, dir: "left" as const },
  whip_pan_right: { type: "whip_pan" as const, durF: 8, dir: "right" as const },
  dip_to_black: { type: "dip_to_black" as const, durF: 6 },
};

export const getTransitionLabel = (transition?: Transition): string => {
  if (!transition) return "None";
  
  switch (transition.type) {
    case "flash_cut":
      return `Flash Cut ${transition.durF || 2}f`;
    case "crossfade":
      return `Crossfade ${transition.durF}f`;
    case "whip_pan":
      return `Whip ${transition.dir === "left" ? "L" : "R"} ${transition.durF}f`;
    case "dip_to_black":
      return `Dip ${transition.durF}f`;
    default:
      return "Unknown";
  }
};

export const getTransitionDurationFrames = (transition?: Transition): number => {
  if (!transition) return 0;
  return transition.durF || 0;
};