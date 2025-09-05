import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { IS_DESKTOP } from "@/lib/platform";

// after imports
const norm = (p: string) => p.replace(/\\/g, "/");

export interface MediaFile {
  id: string;
  name: string;
  path: string;
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  size: number;
  mtime: number;
  thumbnail?: string;
  thumbnailSprite?: string; // Path to thumbnail sprite (e.g., 8-16 frames)
  metadata?: {
    codec: string;
    bitrate?: number;
    format?: string;
  };
}

export interface JobStatus {
  id: string;
  type: "probe" | "thumbnail" | "beats" | "shots" | "cutlist" | "render";
  mediaId?: string;
  status: "pending" | "running" | "completed" | "error";
  progress: number;
  message?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface PrefsState {
  clipsDir?: string;
  songPath?: string;
  selectedClipIds: Set<string>;
  engine: "basic" | "advanced";
  preset: "landscape" | "portrait" | "square";
  cuttingMode: "slow" | "medium" | "fast" | "ultra_fast" | "random" | "auto";
  enableShotDetection: boolean;
  pixelsPerSecond: number;
  theme: "dark" | "light";
  minClipLength: number; // seconds
  maxClipLength: number; // seconds
  minBeats: number; // minimum number of beats
  crossfadeDuration: number; // seconds
  preferDownbeats: boolean;
  respectShotBoundaries: boolean;
  energyThreshold: number; // 0-1
}

export interface MediaStore {
  // Media management
  mediaFiles: MediaFile[];
  clipsDir?: string;
  songPath?: string;
  currentClipId?: string;
  selectedClipIds: Set<string>;

  // Playback state
  playhead: number; // seconds
  isPlaying: boolean;

  // UI state
  pixelsPerSecond: number;

  // Job queue
  jobs: JobStatus[];

  // Preferences (persisted)
  prefs: PrefsState;

  // Actions
  setClipsDir: (dir: string) => void;
  setSongPath: (path: string) => void;
  setCurrentClip: (clipId?: string) => void;
  toggleClipSelection: (clipId: string) => void;
  setSelectedClips: (clipIds: string[]) => void;
  clearSelection: () => void;

  // Media file management
  addMediaFiles: (files: MediaFile[]) => void;
  updateMediaFile: (id: string, updates: Partial<MediaFile>) => void;
  removeMediaFile: (id: string) => void;
  clearMediaFiles: () => void;

  // Playback controls
  setPlayhead: (seconds: number) => void;
  setPlaying: (playing: boolean) => void;

  // UI controls
  setPixelsPerSecond: (pps: number) => void;

  // Job management
  addJob: (job: Omit<JobStatus, "id">) => string;
  updateJob: (id: string, updates: Partial<JobStatus>) => void;
  removeJob: (id: string) => void;
  clearCompletedJobs: () => void;

  // Preferences
  updatePrefs: (updates: Partial<PrefsState>) => void;
  loadPrefs: () => Promise<void>;
  savePrefs: () => Promise<void>;
}

const createId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
};

const defaultPrefs: PrefsState = {
  selectedClipIds: new Set(),
  engine: "basic",
  preset: "landscape",
  cuttingMode: "medium",
  enableShotDetection: true,
  pixelsPerSecond: 50,
  theme: "dark",
  minClipLength: 0.5, // 500ms minimum
  maxClipLength: 8.0, // 8 seconds maximum
  minBeats: 4, // 4 beats minimum
  crossfadeDuration: 0.1, // 100ms crossfade
  preferDownbeats: true,
  respectShotBoundaries: true,
  energyThreshold: 0.3,
};

export const useMediaStore = create<MediaStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    mediaFiles: [],
    selectedClipIds: new Set(),
    playhead: 0,
    isPlaying: false,
    pixelsPerSecond: 50,
    jobs: [],
    prefs: { ...defaultPrefs },

    // Actions
    setClipsDir: (dir: string) => {
      set({ clipsDir: dir });
      get().updatePrefs({ clipsDir: dir });

      // Clear media, jobs, AND selection when directory changes
      const cleared = new Set<string>();
      set({ mediaFiles: [], jobs: [], selectedClipIds: cleared });
      get().updatePrefs({ selectedClipIds: cleared });
    },

    setSongPath: (path: string) => {
      const p = norm(path);
      set({ songPath: p });
      get().updatePrefs({ songPath: p });
    },

    setCurrentClip: (clipId?: string) => {
      set({ currentClipId: clipId ? norm(clipId) : undefined });
    },

    toggleClipSelection: (clipId: string) => {
      const p = norm(clipId);
      const { selectedClipIds } = get();
      const next = new Set(selectedClipIds); // IMMUTABLE
      next.has(p) ? next.delete(p) : next.add(p);
      set({ selectedClipIds: next });
      get().updatePrefs({ selectedClipIds: next }); // if you want to persist selection
    },

    setSelectedClips: (clipIds: string[]) => {
      const next = new Set(clipIds.map(norm)); // IMMUTABLE
      set({ selectedClipIds: next });
      get().updatePrefs({ selectedClipIds: next });
    },

    clearSelection: () => {
      set({ selectedClipIds: new Set() });
      get().updatePrefs({ selectedClipIds: new Set() });
    },

    addMediaFiles: (files: MediaFile[]) => {
      const { mediaFiles } = get();
      const existingIds = new Set(mediaFiles.map((f) => f.id));
      const newFiles = files.filter((f) => !existingIds.has(f.id));

      set({ mediaFiles: [...mediaFiles, ...newFiles] });
    },

    updateMediaFile: (id: string, updates: Partial<MediaFile>) => {
      set((state) => ({
        mediaFiles: state.mediaFiles.map((file) =>
          file.id === id ? { ...file, ...updates } : file
        ),
      }));
    },

    removeMediaFile: (id: string) => {
      set((state) => {
        // Find by id; if caller accidentally passes a path, handle that too
        const file = state.mediaFiles.find(
          (f) => f.id === id || norm(f.path) === norm(id)
        );
        const toRemovePath = file ? norm(file.path) : norm(id);

        return {
          mediaFiles: state.mediaFiles.filter(
            (f) => f.id !== id && norm(f.path) !== norm(id)
          ),
          selectedClipIds: new Set(
            [...state.selectedClipIds].filter((cid) => cid !== toRemovePath)
          ),
        };
      });
    },

    clearMediaFiles: () => {
      const cleared = new Set<string>();
      set({ mediaFiles: [], selectedClipIds: cleared });
      get().updatePrefs({ selectedClipIds: cleared });
    },

    setPlayhead: (seconds: number) => {
      set({ playhead: Math.max(0, seconds) });
    },

    setPlaying: (playing: boolean) => {
      set({ isPlaying: playing });
    },

    setPixelsPerSecond: (pps: number) => {
      set({ pixelsPerSecond: Math.max(10, Math.min(500, pps)) });
      get().updatePrefs({ pixelsPerSecond: pps });
    },

    addJob: (job: Omit<JobStatus, "id">) => {
      const id = createId();
      const newJob: JobStatus = {
        ...job,
        id,
        startTime: Date.now(),
      };

      set((state) => ({ jobs: [...state.jobs, newJob] }));
      return id;
    },

    updateJob: (id: string, updates: Partial<JobStatus>) => {
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === id ? { ...job, ...updates } : job
        ),
      }));
    },

    removeJob: (id: string) => {
      set((state) => ({
        jobs: state.jobs.filter((job) => job.id !== id),
      }));
    },

    clearCompletedJobs: () => {
      set((state) => ({
        jobs: state.jobs.filter(
          (job) => job.status === "pending" || job.status === "running"
        ),
      }));
    },

    updatePrefs: (updates: Partial<PrefsState>) => {
      set((state) => ({
        prefs: { ...state.prefs, ...updates },
      }));
      // Debounced save will be triggered by subscription
    },

    loadPrefs: async () => {
      if (!IS_DESKTOP) {
        // Browser fallback - use localStorage
        try {
          const stored = localStorage.getItem("fapptap-prefs");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (
              parsed.selectedClipIds &&
              Array.isArray(parsed.selectedClipIds)
            ) {
              parsed.selectedClipIds = new Set(parsed.selectedClipIds);
            }
            // 1) prefs
            set({ prefs: { ...defaultPrefs, ...parsed } });
            // 2) root selection (normalized)
            if (parsed.selectedClipIds instanceof Set) {
              set({
                selectedClipIds: new Set(
                  Array.from(parsed.selectedClipIds as Set<string>).map(norm)
                ),
              });
            }
          }
        } catch (error) {
          console.warn("Failed to load preferences from localStorage:", error);
        }
        return;
      }

      try {
        const { load } = await import("@tauri-apps/plugin-store");
        const store = await load(".fapptap.dat", { defaults: {} });
        const stored = await store.get<Partial<PrefsState>>("prefs");
        if (stored) {
          if (stored.selectedClipIds && Array.isArray(stored.selectedClipIds)) {
            stored.selectedClipIds = new Set(stored.selectedClipIds as any);
          }
          // 1) prefs
          set({ prefs: { ...defaultPrefs, ...stored } });
          // 2) root selection (normalized)
          if (stored.selectedClipIds instanceof Set) {
            set({
              selectedClipIds: new Set(
                Array.from(stored.selectedClipIds as Set<string>).map(norm)
              ),
            });
          }
        }
      } catch (error) {
        console.warn("Failed to load preferences from Tauri Store:", error);
      }
    },

    savePrefs: async () => {
      const { prefs } = get();

      if (!IS_DESKTOP) {
        // Browser fallback - use localStorage
        try {
          const toSave = {
            ...prefs,
            selectedClipIds: Array.from(prefs.selectedClipIds),
          };
          localStorage.setItem("fapptap-prefs", JSON.stringify(toSave));
        } catch (error) {
          console.warn("Failed to save preferences to localStorage:", error);
        }
        return;
      }

      try {
        const { load } = await import("@tauri-apps/plugin-store");
        const store = await load(".fapptap.dat", { defaults: {} });

        // Convert Set to Array for serialization
        const toSave = {
          ...prefs,
          selectedClipIds: Array.from(prefs.selectedClipIds),
        };

        await store.set("prefs", toSave);
      } catch (error) {
        console.warn("Failed to save preferences to Tauri Store:", error);
      }
    },
  }))
);

// Auto-save preferences when they change (debounced)
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

useMediaStore.subscribe(
  (state) => state.prefs,
  () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      useMediaStore.getState().savePrefs();
    }, 1000);
  },
  {
    equalityFn: (a, b) => {
      // Deep equality check for prefs
      if (a === b) return true;
      if (!a || !b) return false;

      return (
        a.clipsDir === b.clipsDir &&
        a.songPath === b.songPath &&
        a.engine === b.engine &&
        a.preset === b.preset &&
        a.cuttingMode === b.cuttingMode &&
        a.enableShotDetection === b.enableShotDetection &&
        a.pixelsPerSecond === b.pixelsPerSecond &&
        a.theme === b.theme &&
        a.minClipLength === b.minClipLength &&
        a.maxClipLength === b.maxClipLength &&
        a.minBeats === b.minBeats &&
        a.crossfadeDuration === b.crossfadeDuration &&
        a.preferDownbeats === b.preferDownbeats &&
        a.respectShotBoundaries === b.respectShotBoundaries &&
        a.energyThreshold === b.energyThreshold &&
        a.selectedClipIds.size === b.selectedClipIds.size &&
        [...a.selectedClipIds].every((id) => b.selectedClipIds.has(id))
      );
    },
  }
);

// Load preferences on store creation
if (typeof window !== "undefined") {
  useMediaStore.getState().loadPrefs();
}
