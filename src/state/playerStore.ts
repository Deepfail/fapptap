import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface BeatPoint {
  time: number;
  isDownbeat: boolean;
  confidence?: number;
}

export interface Cut {
  id: string;
  start: number; // seconds
  end: number; // seconds
  src: string; // path to video file
  track?: number; // future: multiple tracks
  effects: EffectRef[];
}

export interface EffectRef {
  id: string;
  type: EffectType;
  intensity: Intensity;
  start: number; // seconds relative to cut.start
  duration: number; // seconds
  seed: number; // deterministic placement
  params?: Record<string, number | string | boolean>;
}

export type EffectType = "flash" | "rgb_glitch" | "zoom" | "shake";
export type Intensity = "low" | "med" | "high";

export interface CutSettings {}

export interface PlayerState {
  // Video state
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;

  // Timeline state
  snapToBeats: boolean;
  beats: BeatPoint[];
  cuts: Cut[];
  selectedCutId?: string;

  // Timeline rendering
  pixelsPerSecond: number;
  scrollLeft: number;

  // Performance settings
  batchSize: number;
  maxConcurrentThumbs: number;

  // Cut generation settings
  cutSettings: CutSettings;
}

export interface PlayerActions {
  // Video controls
  loadSource: (src: string, beats: BeatPoint[], duration: number) => void;
  setTime: (t: number) => void;
  playPause: (on?: boolean) => void;
  setPlaybackRate: (rate: number) => void;

  // Cut management
  addCut: (start: number, end: number, src: string) => string;
  updateCut: (id: string, patch: Partial<Cut>) => void;
  deleteCut: (id: string) => void;
  splitCut: (id: string, at: number) => { leftId: string; rightId: string };
  selectCut: (id: string | undefined) => void;

  // Timeline controls
  setSnapToBeats: (enabled: boolean) => void;
  setPixelsPerSecond: (pps: number) => void;
  setScrollLeft: (left: number) => void;

  // Effects
  addEffect: (cutId: string, effect: Omit<EffectRef, "id">) => string;
  updateEffect: (
    cutId: string,
    effectId: string,
    patch: Partial<EffectRef>
  ) => void;
  deleteEffect: (cutId: string, effectId: string) => void;
}

export type PlayerStore = PlayerState & PlayerActions;

const createId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
};

export const usePlayerStore = create<PlayerStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    playbackRate: 1,
    snapToBeats: true,
    beats: [],
    cuts: [],
    selectedCutId: undefined,
    pixelsPerSecond: 50,
    scrollLeft: 0,
    batchSize: 200,
    maxConcurrentThumbs: 3,
    cutSettings: {},

    // Video controls
    loadSource: (src, beats, duration) => {
      set({
        duration,
        currentTime: 0,
        isPlaying: false,
        beats,
        cuts: [], // Clear existing cuts
        selectedCutId: undefined,
      });
      console.log("Loaded source:", src); // Use the src parameter
    },

    setTime: (currentTime) => {
      set({ currentTime });
    },

    playPause: (on) => {
      const { isPlaying } = get();
      set({ isPlaying: on !== undefined ? on : !isPlaying });
    },

    setPlaybackRate: (playbackRate) => {
      set({ playbackRate });
    },

    // Cut management
    addCut: (start, end, src) => {
      const id = createId();
      const newCut: Cut = {
        id,
        start,
        end,
        src,
        effects: [],
      };

      set((state) => ({
        cuts: [...state.cuts, newCut].sort((a, b) => a.start - b.start),
        selectedCutId: id,
      }));

      return id;
    },

    updateCut: (id, patch) => {
      set((state) => ({
        cuts: state.cuts.map((cut) =>
          cut.id === id ? { ...cut, ...patch } : cut
        ),
      }));
    },

    deleteCut: (id) => {
      set((state) => ({
        cuts: state.cuts.filter((cut) => cut.id !== id),
        selectedCutId:
          state.selectedCutId === id ? undefined : state.selectedCutId,
      }));
    },

    splitCut: (id, at) => {
      const state = get();
      const cut = state.cuts.find((c) => c.id === id);
      if (!cut || at <= cut.start || at >= cut.end) {
        return { leftId: "", rightId: "" };
      }

      const leftId = createId();
      const rightId = createId();

      const leftCut: Cut = {
        ...cut,
        id: leftId,
        end: at,
      };

      const rightCut: Cut = {
        ...cut,
        id: rightId,
        start: at,
      };

      set((state) => ({
        cuts: state.cuts
          .filter((c) => c.id !== id)
          .concat([leftCut, rightCut])
          .sort((a, b) => a.start - b.start),
        selectedCutId: leftId,
      }));

      return { leftId, rightId };
    },

    selectCut: (selectedCutId) => {
      set({ selectedCutId });
    },

    // Timeline controls
    setSnapToBeats: (snapToBeats) => {
      set({ snapToBeats });
    },

    setPixelsPerSecond: (pixelsPerSecond) => {
      set({ pixelsPerSecond });
    },

    setScrollLeft: (scrollLeft) => {
      set({ scrollLeft });
    },

    // Effects
    addEffect: (cutId, effect) => {
      const effectId = createId();
      const newEffect: EffectRef = {
        ...effect,
        id: effectId,
      };

      set((state) => ({
        cuts: state.cuts.map((cut) =>
          cut.id === cutId
            ? { ...cut, effects: [...cut.effects, newEffect] }
            : cut
        ),
      }));

      return effectId;
    },

    updateEffect: (cutId, effectId, patch) => {
      set((state) => ({
        cuts: state.cuts.map((cut) =>
          cut.id === cutId
            ? {
                ...cut,
                effects: cut.effects.map((effect) =>
                  effect.id === effectId ? { ...effect, ...patch } : effect
                ),
              }
            : cut
        ),
      }));
    },

    deleteEffect: (cutId, effectId) => {
      set((state) => ({
        cuts: state.cuts.map((cut) =>
          cut.id === cutId
            ? {
                ...cut,
                effects: cut.effects.filter((effect) => effect.id !== effectId),
              }
            : cut
        ),
      }));
    },
  }))
);
