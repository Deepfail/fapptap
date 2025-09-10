import { create } from "zustand";
import { Transition } from "../types/transitions";

export type TimelineItem = {
  id: string;
  clipId: string; // sessions/{id}/clips/*.mp4
  in: number; // seconds
  out: number; // seconds
  transitionOut?: Transition; // boundary to next
};

export interface EditorStore {
  timeline: TimelineItem[];
  selectedId: string | null;
  updateTimeline(items: TimelineItem[]): void;
  select(id: string | null): void;
  updateTrim(id: string, next: { in?: number; out?: number }): void;
  updateTransitionOut(id: string, t?: Transition): void;
  reorder(fromIdx: number, toIdx: number): void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  timeline: [],
  selectedId: null,

  updateTimeline: (items) => set({ timeline: items }),

  select: (id) => set({ selectedId: id }),

  updateTrim: (id, next) =>
    set((state) => ({
      timeline: state.timeline.map((item) =>
        item.id === id ? { ...item, ...next } : item
      ),
    })),

  updateTransitionOut: (id, t) =>
    set((state) => ({
      timeline: state.timeline.map((item) =>
        item.id === id ? { ...item, transitionOut: t } : item
      ),
    })),

  reorder: (fromIdx, toIdx) =>
    set((state) => {
      const items = [...state.timeline];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return { timeline: items };
    }),
}));
