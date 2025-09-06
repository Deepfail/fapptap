/**
 * React hook for FFplay preview management with debouncing
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Timeline, PreviewState } from './types';
import { ffplayPreview } from './ffplayPreview';

interface UsePreviewOptions {
  debounceMs?: number;
  autoCleanup?: boolean;
}

interface UsePreviewReturn {
  state: PreviewState;
  isRunning: boolean;
  startPreview: (timeline: Timeline) => Promise<void>;
  stopPreview: () => Promise<void>;
  restartPreview: (timeline: Timeline) => Promise<void>;
  restartDebounced: (timeline: Timeline) => void;
  error: string | undefined;
}

export function usePreview(options: UsePreviewOptions = {}): UsePreviewReturn {
  const { debounceMs = 350, autoCleanup = true } = options;
  
  const [state, setState] = useState<PreviewState>(() => {
    return ffplayPreview.getState();
  });
  const [error, setError] = useState<string | undefined>();
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastTimelineRef = useRef<Timeline | null>(null);
  const mountedRef = useRef(true);

  // Update state when preview manager state changes
  useEffect(() => {
    const handleStarted = (newState: PreviewState) => {
      if (mountedRef.current) {
        setState(newState);
        setError(undefined);
      }
    };

    const handleStopped = () => {
      if (mountedRef.current) {
        setState({ isRunning: false });
      }
    };

    const handleError = (err: any) => {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        setState(prev => ({ ...prev, isRunning: false, error: errorMessage }));
      }
    };

    // Subscribe to preview manager events
    ffplayPreview.on('started', handleStarted);
    ffplayPreview.on('stopped', handleStopped);
    ffplayPreview.on('error', handleError);

    return () => {
      ffplayPreview.off('started', handleStarted);
      ffplayPreview.off('stopped', handleStopped);
      ffplayPreview.off('error', handleError);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      if (autoCleanup) {
        ffplayPreview.cleanup().catch(console.error);
      }
    };
  }, [autoCleanup]);

  // Start preview
  const startPreview = useCallback(async (timeline: Timeline) => {
    try {
      setError(undefined);
      await ffplayPreview.startPreview(timeline);
      lastTimelineRef.current = timeline;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Stop preview
  const stopPreview = useCallback(async () => {
    try {
      // Clear any pending debounced restart
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = undefined;
      }
      
      await ffplayPreview.stopPreview();
      lastTimelineRef.current = null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Restart preview immediately
  const restartPreview = useCallback(async (timeline: Timeline) => {
    try {
      setError(undefined);
      await ffplayPreview.restartPreview(timeline);
      lastTimelineRef.current = timeline;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Debounced restart for frequent updates
  const restartDebounced = useCallback((timeline: Timeline) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Store the timeline for the debounced call
    lastTimelineRef.current = timeline;

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && lastTimelineRef.current) {
        restartPreview(lastTimelineRef.current).catch((err) => {
          console.error('Debounced restart failed:', err);
        });
      }
      debounceTimeoutRef.current = undefined;
    }, debounceMs);
  }, [debounceMs, restartPreview]);

  return {
    state,
    isRunning: state.isRunning,
    startPreview,
    stopPreview,
    restartPreview,
    restartDebounced,
    error,
  };
}

// Convenience hook for simple preview control
export function useSimplePreview(timeline: Timeline | null, enabled: boolean = true): UsePreviewReturn {
  const preview = usePreview();
  
  useEffect(() => {
    if (!enabled || !timeline) {
      if (preview.isRunning) {
        preview.stopPreview().catch(console.error);
      }
      return;
    }

    // Start preview when timeline is available and enabled
    if (!preview.isRunning) {
      preview.startPreview(timeline).catch(console.error);
    }
  }, [timeline, enabled, preview]);

  return preview;
}

// Hook for preview with automatic restart on timeline changes
export function useAutoPreview(
  timeline: Timeline | null, 
  dependencies: any[] = []
): UsePreviewReturn {
  const preview = usePreview();
  
  useEffect(() => {
    if (!timeline) {
      if (preview.isRunning) {
        preview.stopPreview().catch(console.error);
      }
      return;
    }

    // Use debounced restart for timeline changes
    preview.restartDebounced(timeline);
  }, [timeline, ...dependencies, preview.restartDebounced]);

  return preview;
}