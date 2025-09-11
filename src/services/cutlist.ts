// src/services/cutlist.ts
import { join } from "@tauri-apps/api/path";

export type Transition =
  | { type: "flash_cut"; durF?: number; intensity?: number }
  | { type: "crossfade"; durF: number }
  | { type: "whip_pan"; durF: number; dir: "left" | "right" }
  | { type: "dip_to_black"; durF: number };

type CutDoc = {
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
};

export function cutlistToItems(doc: CutDoc) {
  return (doc.events || []).map((e, i) => ({
    id: `item-${i}`,
    clipId: e.src,
    in: e.in,
    out: e.out,
    transitionOut: e.transition_out,
  }));
}

export async function hydrateEditorFromSessionCutlist(
  sessionRoot: string,
  editor: {
    updateTimelineItems: (items: any[]) => void;
    selectTimelineItem: (id: string | null) => void;
  }
) {
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const p = await join(sessionRoot, "cache", "cutlist.json");
  const raw = await readTextFile(p);
  const doc = JSON.parse(raw) as CutDoc;
  const items = cutlistToItems(doc);
  editor.updateTimelineItems(items); // REPLACE (don't append)
  editor.selectTimelineItem(items[0]?.id ?? null);
}
