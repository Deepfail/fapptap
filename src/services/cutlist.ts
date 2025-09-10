// services/cutlist.ts
import { writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { TimelineItem } from "../state/editorStore";
import { itemsToCutlist, CutDoc } from "../adapters/cutlist";
import { isTauriAvailable } from "../lib/platform";

/**
 * Write canonical cutlist to render/cutlist.json
 * Always overwrites, never merges - this is the authoritative format
 */
export async function writeCanonicalCutlist(
  timelineItems: TimelineItem[], 
  baseCutlist: Partial<CutDoc>
): Promise<void> {
  if (!isTauriAvailable()) {
    throw new Error("Cutlist writing requires desktop mode");
  }

  // Ensure render directory exists
  await mkdir("render", { recursive: true });

  // Convert timeline items to cutlist format
  const cutlist = itemsToCutlist(timelineItems, baseCutlist);

  // Write canonical cutlist (always overwrite)
  const cutlistJson = JSON.stringify(cutlist, null, 2);
  await writeTextFile("render/cutlist.json", cutlistJson);
  
  console.log("Wrote canonical cutlist:", cutlist);
}

/**
 * Debounced cutlist writer for live editing
 * Waits 650ms after last change before writing + rendering
 */
let cutlistUpdateTimeout: NodeJS.Timeout | null = null;

export async function debouncedCutlistUpdate(
  timelineItems: TimelineItem[],
  baseCutlist: Partial<CutDoc>,
  onUpdate?: () => void
): Promise<void> {
  // Clear existing timeout
  if (cutlistUpdateTimeout) {
    clearTimeout(cutlistUpdateTimeout);
  }

  // Set new timeout for 650ms
  cutlistUpdateTimeout = setTimeout(async () => {
    try {
      await writeCanonicalCutlist(timelineItems, baseCutlist);
      
      // Trigger proxy re-render
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to update cutlist:", error);
    }
  }, 650);
}