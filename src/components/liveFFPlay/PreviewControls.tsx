/**
 * Preview Controls for Live FFPlay Mode
 * Play/Stop buttons and running indicator
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Square, AlertCircle } from 'lucide-react';
import { usePreview } from '@/preview';
import { Timeline } from '@/preview/types';

interface PreviewControlsProps {
  timeline: Timeline | null;
  disabled?: boolean;
}

export function PreviewControls({ timeline, disabled = false }: PreviewControlsProps) {
  const { 
    isRunning, 
    startPreview, 
    stopPreview, 
    error,
    state 
  } = usePreview({ 
    debounceMs: 350,
    autoCleanup: true 
  });

  const handleStart = async () => {
    if (!timeline) return;
    
    try {
      await startPreview(timeline);
    } catch (err) {
      console.error('Failed to start preview:', err);
    }
  };

  const handleStop = async () => {
    try {
      await stopPreview();
    } catch (err) {
      console.error('Failed to stop preview:', err);
    }
  };

  const canStart = timeline && !isRunning && !disabled;
  const canStop = isRunning && !disabled;

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* Preview Controls */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleStart}
              disabled={!canStart}
              variant="default"
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              Preview
            </Button>
            
            <Button
              onClick={handleStop}
              disabled={!canStop}
              variant="outline"
              size="sm"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center gap-2">
            {isRunning && (
              <Badge variant="default" className="bg-green-600">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  Preview Running
                </div>
              </Badge>
            )}
            
            {error && (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Error
              </Badge>
            )}
            
            {!timeline && (
              <Badge variant="secondary">
                No Timeline
              </Badge>
            )}
          </div>
        </div>

        {/* Process Info */}
        {isRunning && state.processId && (
          <div className="mt-2 text-xs text-muted-foreground">
            Process ID: {state.processId}
            {state.startTime && (
              <span className="ml-2">
                Started: {new Date(state.startTime).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}

        {/* Error Details */}
        {error && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Timeline Info */}
        {timeline && (
          <div className="mt-2 text-xs text-muted-foreground">
            {timeline.clips.length} clips • {timeline.fps} FPS • Tempo: {timeline.globalTempo.toFixed(1)}x
            {timeline.noCutZones.length > 0 && (
              <span className="ml-2">• {timeline.noCutZones.length} no-cut zone{timeline.noCutZones.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}