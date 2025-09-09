/**
 * Live FFPlay Mode Panel
 * Main interface for the Live FFPlay Basic Mode 2.0
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap } from "lucide-react";
import { CreatePanel } from "./CreatePanel";
import { PreviewControls } from "./PreviewControls";
import { TimelineEditor } from "./TimelineEditor";
import { EmbeddedVideoPlayer } from "./EmbeddedVideoPlayer";
import { useAutoPreview } from "@/preview";
import {
  CreateRequest,
  Timeline,
  generateTimeline,
  updateTimelineWithTempo,
} from "@/preview";
import { useMediaStore } from "@/state/mediaStore";

interface LiveFFPlayPanelProps {
  onBack?: () => void;
}

export function LiveFFPlayPanel({ onBack }: LiveFFPlayPanelProps) {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderedVideoPath, setRenderedVideoPath] = useState<string | null>(
    null
  );

  // Get selected clips from media store
  const selectedClipIds = useMediaStore((state) => state.selectedClipIds);
  const selectedClipPaths = Array.from(selectedClipIds);

  // Auto preview with debounced restart on timeline changes
  const preview = useAutoPreview(timeline, [
    timeline?.globalTempo,
    timeline?.noCutZones,
  ]);

  const handleCreateRequest = useCallback(
    async (request: CreateRequest) => {
      if (selectedClipPaths.length === 0) {
        setError("No clips selected");
        return;
      }

      setIsCreating(true);
      setError(null);

      try {
        console.log("Creating timeline with request:", request);
        console.log("Selected clips:", selectedClipPaths);

        const newTimeline = await generateTimeline(
          request,
          selectedClipPaths,
          [] // Start with no no-cut zones
        );

        console.log("Generated timeline:", newTimeline);
        setTimeline(newTimeline);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Timeline generation failed:", errorMessage);
        setError(errorMessage);
      } finally {
        setIsCreating(false);
      }
    },
    [selectedClipPaths]
  );

  const handleTempoChange = useCallback(
    (newTempo: number) => {
      if (!timeline) return;

      const updatedTimeline = updateTimelineWithTempo(timeline, newTempo);
      setTimeline(updatedTimeline);
    },
    [timeline]
  );

  const handleReset = () => {
    setTimeline(null);
    setError(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Live FFPlay Mode</h2>
          </div>
        </div>

        {timeline && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            New Timeline
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-6xl mx-auto">
          {/* Error Display */}
          {error && (
            <Card className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <CardContent className="p-4">
                <div className="text-red-800 dark:text-red-200">
                  <strong>Error:</strong> {error}
                </div>
              </CardContent>
            </Card>
          )}

          {!timeline ? (
            /* Create Mode */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create Panel */}
              <div className="space-y-4">
                <CreatePanel
                  onCreateRequest={handleCreateRequest}
                  isCreating={isCreating}
                  selectedClipPaths={selectedClipPaths}
                />

                {/* Selected Clips Info */}
                {selectedClipPaths.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        Selected Clips ({selectedClipPaths.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {selectedClipPaths.slice(0, 10).map((path, index) => (
                          <div
                            key={index}
                            className="text-xs text-muted-foreground truncate"
                          >
                            {path.split("/").pop()?.split("\\").pop() || path}
                          </div>
                        ))}
                        {selectedClipPaths.length > 10 && (
                          <div className="text-xs text-muted-foreground">
                            ... and {selectedClipPaths.length - 10} more
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Instructions */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">How it Works</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <div>
                      <strong>1. Select Audio:</strong> Choose an audio file for
                      beat analysis.
                    </div>
                    <div>
                      <strong>2. Choose Duration:</strong> Set how much of the
                      audio to analyze.
                    </div>
                    <div>
                      <strong>3. Video Length:</strong> Set the target length
                      for your video.
                    </div>
                    <div>
                      <strong>4. Clip Order:</strong> Random or alphabetical
                      arrangement.
                    </div>
                    <div>
                      <strong>5. Create:</strong> Generate timeline and start
                      instant preview!
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Requirements</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div>• Select video clips from the library first</div>
                    <div>• Audio file (MP3, WAV, FLAC, etc.)</div>
                    <div>• Desktop mode for FFplay preview</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            /* Edit Mode */
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Preview Controls & Video Player */}
              <div className="xl:col-span-2 space-y-4">
                <PreviewControls
                  timeline={timeline}
                  disabled={isCreating}
                  onRenderedPath={setRenderedVideoPath}
                />

                <EmbeddedVideoPlayer
                  timeline={timeline}
                  previewPath={renderedVideoPath || undefined}
                  disabled={isCreating}
                />
              </div>

              {/* Timeline Editor & Info */}
              <div className="space-y-4">
                <TimelineEditor
                  timeline={timeline}
                  onTempoChange={handleTempoChange}
                  disabled={isCreating || preview.isRunning}
                />
              </div>

              {/* Timeline Info & Future Extensions */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Timeline Status</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <div>
                      <strong>Clips:</strong> {timeline.clips.length} video
                      segments
                    </div>
                    <div>
                      <strong>FPS:</strong> {timeline.fps} frames per second
                    </div>
                    <div>
                      <strong>Tempo:</strong> {timeline.globalTempo.toFixed(1)}x
                      speed
                    </div>
                    <div>
                      <strong>Preview:</strong> Auto-renders MP4 for playback
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">How to Use</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <div>
                      <strong>External Preview:</strong> Opens FFplay window for
                      real-time preview
                    </div>
                    <div>
                      <strong>Embedded Player:</strong> Watch rendered MP4 in
                      the app
                    </div>
                    <div>
                      <strong>Tempo Control:</strong> Adjust speed and
                      regenerate
                    </div>
                    <div>
                      <strong>Render MP4:</strong> Export final video file
                    </div>
                  </CardContent>
                </Card>

                {/* Future: Effects Panel, No-Cut Zones, etc. */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Coming Soon</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <div>• Per-clip effect controls</div>
                    <div>• No-cut zones drawing</div>
                    <div>• Beat grid visualization</div>
                    <div>• Export to cutlist</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
