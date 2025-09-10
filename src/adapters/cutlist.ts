// adapters/cutlist.ts
import { TimelineItem } from "../state/editorStore";
import { Transition } from "../types/transitions";

export interface CutDoc {
  version?: number;
  fps: number;
  width: number;
  height: number;
  audio: string;
  events: {
    src: string;
    in: number;
    out: number;
    transition_out?: Transition;
  }[];
}

/**
 * Convert cutlist document to timeline items
 */
export const cutlistToItems = (doc: CutDoc): TimelineItem[] => {
  let currentStart = 0;
  
  return doc.events.map((event, i) => {
    const duration = event.out - event.in;
    const item: TimelineItem = {
      id: `item-${i}`,
      clipId: event.src,
      start: currentStart,
      in: event.in,
      out: event.out,
      transitionOut: event.transition_out,
    };
    
    currentStart += duration;
    return item;
  });
};

/**
 * Convert timeline items to cutlist document
 */
export const itemsToCutlist = (
  items: TimelineItem[],
  base: Partial<CutDoc>
): CutDoc => {
  // Sort items by start time to ensure proper order
  const sortedItems = [...items].sort((a, b) => a.start - b.start);
  
  return {
    version: 1,
    fps: base.fps ?? 60,
    width: base.width ?? 1920,
    height: base.height ?? 1080,
    audio: String(base.audio ?? ""),
    events: sortedItems.map((item) => ({
      src: item.clipId,
      in: item.in,
      out: item.out,
      transition_out: item.transitionOut,
    })),
  };
};

/**
 * Create a default cutlist base configuration
 */
export const createCutlistBase = (audioPath: string, preset: "landscape" | "portrait" | "square" = "landscape"): Partial<CutDoc> => {
  const presetConfigs = {
    landscape: { width: 1920, height: 1080, fps: 60 },
    portrait: { width: 1080, height: 1920, fps: 60 },
    square: { width: 1080, height: 1080, fps: 60 },
  };
  
  return {
    audio: audioPath,
    ...presetConfigs[preset],
  };
};