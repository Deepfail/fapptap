// services/styles.ts
import { TimelineItem } from "../state/editorStore";
import { Transition, defaultTransitions } from "../types/transitions";

export type StylePreset = "flashy" | "smooth" | "punchy" | "whip";

/**
 * Apply style preset transitions to timeline items
 */
export function applyStylePreset(
  items: TimelineItem[], 
  preset: StylePreset
): TimelineItem[] {
  return items.map((item, index) => {
    // Don't add transitions to the last item
    if (index === items.length - 1) {
      return { ...item, transitionOut: undefined };
    }

    let transition: Transition | undefined;

    switch (preset) {
      case "flashy":
        // Flash cuts on beats, every 4th gets whip pan alternating L/R
        if (index % 4 === 3) {
          transition = index % 8 === 3 
            ? defaultTransitions.whip_pan_left 
            : defaultTransitions.whip_pan_right;
        } else {
          transition = defaultTransitions.flash_cut;
        }
        break;

      case "smooth":
        // Crossfade everywhere
        transition = defaultTransitions.crossfade;
        break;

      case "punchy":
        // Hard cuts with flash on every 4th (downbeats)
        if (index % 4 === 3) {
          transition = defaultTransitions.flash_cut;
        }
        // No transition = hard cut
        break;

      case "whip":
        // Whip pan alternating directions
        transition = index % 2 === 0 
          ? defaultTransitions.whip_pan_left 
          : defaultTransitions.whip_pan_right;
        break;

      default:
        // No transitions
        break;
    }

    return { ...item, transitionOut: transition };
  });
}

/**
 * Get description for a style preset
 */
export function getStyleDescription(preset: StylePreset): string {
  switch (preset) {
    case "flashy":
      return "Flash cuts on beats with whip pans";
    case "smooth":
      return "Crossfades everywhere";
    case "punchy":
      return "Hard cuts with flash on downbeats";
    case "whip":
      return "Whip pans on all boundaries";
    default:
      return "";
  }
}