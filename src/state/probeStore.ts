/**
 * Probe Store - React state management for media probing
 * Simple implementation for file probe status tracking
 */

import { create } from "zustand";

// Simple probe status types
type ProbeStatus = "pending" | "completed" | "failed" | "idle";

interface ProbeMeta {
  path: string;
  duration?: number;
  width?: number;
  height?: number;
  format?: string;
}

interface ProbeState {
  // Probe statuses for all files
  probeStatuses: Map<string, ProbeStatus>;

  // Cached probe metadata
  probeCache: Map<string, ProbeMeta>;

  // Actions
  requestFileProbe: (path: string) => Promise<void>;
  getFileProbeStatus: (path: string) => ProbeStatus | undefined;
  getFileProbeData: (path: string) => ProbeMeta | undefined;

  // Internal state management
  updateProbeStatus: (path: string, status: ProbeStatus) => void;
  updateProbeData: (path: string, data: ProbeMeta) => void;
}

export const useProbeStore = create<ProbeState>((set, get) => {
  return {
    probeStatuses: new Map(),
    probeCache: new Map(),

    requestFileProbe: async (path: string) => {
      try {
        console.log(`Requesting probe for: ${path}`);

        // Set status to pending
        get().updateProbeStatus(path, "pending");

        // TODO: Implement actual probe logic here
        // For now, just simulate a successful probe
        setTimeout(() => {
          const mockData: ProbeMeta = {
            path,
            // Don't return a hardcoded duration here -- leave undefined until a real probe runs.
            // Returning a fixed value (like 60) made every thumbnail show "60s".
            // duration: 60,
            width: 1920,
            height: 1080,
            format: "mp4",
          };

          get().updateProbeData(path, mockData);
          get().updateProbeStatus(path, "completed");
        }, 1000);
      } catch (error) {
        console.error(`Failed to request probe for ${path}:`, error);
        get().updateProbeStatus(path, "failed");
      }
    },

    getFileProbeStatus: (path: string) => {
      return get().probeStatuses.get(path);
    },

    getFileProbeData: (path: string) => {
      return get().probeCache.get(path);
    },

    updateProbeStatus: (path: string, status: ProbeStatus) => {
      set((state) => ({
        probeStatuses: new Map(state.probeStatuses.set(path, status)),
      }));
    },

    updateProbeData: (path: string, data: ProbeMeta) => {
      set((state) => ({
        probeCache: new Map(state.probeCache.set(path, data)),
      }));
    },
  };
});
