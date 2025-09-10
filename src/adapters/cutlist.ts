import { TimelineItem } from "../store/timeline";
import { Transition } from "../types/transitions";

export type CutDoc = {
  version?: 1;
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

export const cutlistToItems = (doc: CutDoc): TimelineItem[] =>
  doc.events.map((e, i) => ({
    id: `item-${i}`,
    clipId: e.src,
    in: e.in,
    out: e.out,
    transitionOut: e.transition_out,
  }));

export const itemsToCutlist = (
  items: TimelineItem[],
  base: Partial<CutDoc> = {}
): CutDoc => ({
  version: 1,
  fps: base.fps ?? 60,
  width: base.width ?? 1920,
  height: base.height ?? 1080,
  audio: String(base.audio ?? ""),
  events: items.map((it) => ({
    src: it.clipId,
    in: it.in,
    out: it.out,
    transition_out: it.transitionOut || undefined,
  })),
});
