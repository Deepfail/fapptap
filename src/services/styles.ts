import { Transition } from "@/types/transitions";

export type StylePreset = "flashy" | "smooth" | "punchy" | "whip";

export function getStyleTransitions(
  style: StylePreset,
  beatCount: number
): Transition[] {
  const transitions: Transition[] = [];

  switch (style) {
    case "flashy":
      // flash_cut 2f on beats; every 4th → whip_pan 8f alternating L/R
      for (let i = 0; i < beatCount; i++) {
        if (i % 4 === 3) {
          // Every 4th beat gets whip pan, alternating direction
          transitions.push({
            type: "whip_pan",
            durF: 8,
            dir: i % 8 === 3 ? "left" : "right",
          });
        } else {
          // Regular beats get flash cut
          transitions.push({
            type: "flash_cut",
            durF: 2,
          });
        }
      }
      break;

    case "smooth":
      // crossfade 8f everywhere
      for (let i = 0; i < beatCount; i++) {
        transitions.push({
          type: "crossfade",
          durF: 8,
        });
      }
      break;

    case "punchy":
      // Hard cuts with flash_cut on downbeats only (every 4th)
      for (let i = 0; i < beatCount; i++) {
        if (i % 4 === 0) {
          transitions.push({
            type: "flash_cut",
            durF: 2,
          });
        }
        // No transition for other beats (hard cuts)
      }
      break;

    case "whip":
      // whip_pan 8f on all boundaries, dir alternates
      for (let i = 0; i < beatCount; i++) {
        transitions.push({
          type: "whip_pan",
          durF: 8,
          dir: i % 2 === 0 ? "left" : "right",
        });
      }
      break;
  }

  return transitions;
}
