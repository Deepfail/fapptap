/**
 * Probe Store - React state management for media probing
 * Integrates with the probe service to provide reactive UI updates
 */

import { create } from "zustand";
import {
  requestProbe,
  onProbeStatusChange,
  ProbeStatus,
  ProbeMeta,
  getAllProbeStatuses,
} from "../lib/probeService";
import { logger } from "../lib/logging";

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
  updateProbeStatuses: (statuses: Map<string, ProbeStatus>) => void;
}

export const useProbeStore = create<ProbeState>((set, get) => {
  // Subscribe to probe status changes from the service
  onProbeStatusChange((statuses) => {
    get().updateProbeStatuses(statuses);
  });

  // Note: unsubscribe should be called on app cleanup, but for now we'll leave it active

  return {
    probeStatuses: new Map(),
    probeCache: new Map(),

    requestFileProbe: async (path: string) => {
      try {
        logger.debug(`Requesting probe for: ${path}`);

        // Request probe from service
        const cachedResult = await requestProbe(path);

        if (cachedResult) {
          // If we got immediate cached result, store it
          set((state) => ({
            probeCache: new Map(state.probeCache.set(path, cachedResult)),
          }));
        }

        // Status updates will come through the subscription
      } catch (error) {
        logger.error(`Failed to request probe for ${path}:`, error);
      }
    },

    getFileProbeStatus: (path: string) => {
      return get().probeStatuses.get(path);
    },

    getFileProbeData: (path: string) => {
      return get().probeCache.get(path);
    },

    updateProbeStatuses: (statuses: Map<string, ProbeStatus>) => {
      set({ probeStatuses: new Map(statuses) });
    },
  };
});

// Initialize the store with current statuses
setTimeout(() => {
  const currentStatuses = getAllProbeStatuses();
  useProbeStore.getState().updateProbeStatuses(currentStatuses);
}, 0);
