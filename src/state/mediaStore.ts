import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { IS_DESKTOP } from "@/lib/platform";

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
  snapToBeat: boolean;
  pixelsPerSecond: number;
  theme: "dark" | "light";
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
  snapToBeat: true,
  pixelsPerSecond: 50,
  theme: "dark",
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
    },

    setSongPath: (path: string) => {
      set({ songPath: path });
      get().updatePrefs({ songPath: path });
    },

    setCurrentClip: (clipId?: string) => {
      set({ currentClipId: clipId });
    },

    toggleClipSelection: (clipId: string) => {
      const { selectedClipIds } = get();
      const newSelection = new Set(selectedClipIds);

      if (newSelection.has(clipId)) {
        newSelection.delete(clipId);
      } else {
        newSelection.add(clipId);
      }

      set({ selectedClipIds: newSelection });
      get().updatePrefs({ selectedClipIds: newSelection });
    },

    setSelectedClips: (clipIds: string[]) => {
      const newSelection = new Set(clipIds);
      set({ selectedClipIds: newSelection });
      get().updatePrefs({ selectedClipIds: newSelection });
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
      set((state) => ({
        mediaFiles: state.mediaFiles.filter((file) => file.id !== id),
        selectedClipIds: new Set(
          [...state.selectedClipIds].filter((cid) => cid !== id)
        ),
      }));
    },

    clearMediaFiles: () => {
      set({ mediaFiles: [], selectedClipIds: new Set() });
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
            // Convert selectedClipIds array back to Set
            if (
              parsed.selectedClipIds &&
              Array.isArray(parsed.selectedClipIds)
            ) {
              parsed.selectedClipIds = new Set(parsed.selectedClipIds);
            }
            set({ prefs: { ...defaultPrefs, ...parsed } });
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
          // Convert selectedClipIds array back to Set
          if (stored.selectedClipIds && Array.isArray(stored.selectedClipIds)) {
            stored.selectedClipIds = new Set(stored.selectedClipIds as any);
          }
          set({ prefs: { ...defaultPrefs, ...stored } });
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
let saveTimeout: number | null = null;

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
        a.snapToBeat === b.snapToBeat &&
        a.pixelsPerSecond === b.pixelsPerSecond &&
        a.theme === b.theme &&
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
