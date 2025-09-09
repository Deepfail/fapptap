// Temporary stub for probe store to fix compilation
export function useProbeStore() {
  return {
    // Add any properties that are actually used in StaticUnifiedApp
    isProbing: false,
    probeProgress: 0,
    startProbe: () => {},
    requestFileProbe: (_path: string) => {},
    getFileProbeStatus: (_path: string) => ({ status: 'pending' }),
    getFileProbeData: (_path: string) => ({ duration_sec: 0 }),
    probeStatuses: {},
    probeCache: {},
  };
}
