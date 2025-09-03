import { useState } from "react";
import { useEditor } from "../state/editorStore";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";

export const CuttingTools = () => {
  const {
    timeline,
    selectedTimelineItemId,
    trimTimelineItem,
    deleteTimelineItem,
    addClipToTimeline,
    playhead,
  } = useEditor();

  const [razorMode, setRazorMode] = useState(false);
  const [autoCutTolerance, setAutoCutTolerance] = useState(0.2); // seconds

  // Mock beat data - in real app this would come from beat analysis
  const mockBeats = Array.from({ length: 50 }, (_, i) => i * 2); // Beat every 2 seconds

  const cutClipAtTime = (timelineItemId: string, cutTime: number) => {
    const item = timeline.find((t) => t.id === timelineItemId);
    if (!item) return;

    // Calculate the cut position relative to the clip
    const cutPositionInClip = cutTime - item.start + item.in;

    // Ensure cut is within clip bounds
    if (cutPositionInClip <= item.in || cutPositionInClip >= item.out) {
      return;
    }

    // Create two new clips
    const firstHalf = {
      ...item,
      id: `${item.id}-first-${Date.now()}`,
      out: cutPositionInClip,
    };

    const secondHalf = {
      ...item,
      id: `${item.id}-second-${Date.now()}`,
      in: cutPositionInClip,
      start: cutTime,
    };

    // Remove original and add the two halves
    deleteTimelineItem(timelineItemId);
    addClipToTimeline(firstHalf.clipId, firstHalf.start);
    addClipToTimeline(secondHalf.clipId, secondHalf.start);
  };

  const cutAtPlayhead = () => {
    // Find clip at playhead position
    const clipAtPlayhead = timeline.find(
      (item) =>
        playhead >= item.start && playhead <= item.start + (item.out - item.in)
    );

    if (clipAtPlayhead) {
      cutClipAtTime(clipAtPlayhead.id, playhead);
    }
  };

  const cutSelectedClip = () => {
    if (selectedTimelineItemId) {
      cutClipAtTime(selectedTimelineItemId, playhead);
    }
  };

  const autoCutToBeats = () => {
    timeline.forEach((item) => {
      const itemStart = item.start;
      const itemEnd = item.start + (item.out - item.in);

      // Find beats within this clip
      const beatsInClip = mockBeats.filter(
        (beat) =>
          beat > itemStart + autoCutTolerance &&
          beat < itemEnd - autoCutTolerance
      );

      // Cut at each beat (in reverse order to maintain indices)
      beatsInClip.reverse().forEach((beat) => {
        cutClipAtTime(item.id, beat);
      });
    });
  };

  const autoCutToBeatsSingleClip = (timelineItemId: string) => {
    const item = timeline.find((t) => t.id === timelineItemId);
    if (!item) return;

    const itemStart = item.start;
    const itemEnd = item.start + (item.out - item.in);

    // Find beats within this clip
    const beatsInClip = mockBeats.filter(
      (beat) =>
        beat > itemStart + autoCutTolerance && beat < itemEnd - autoCutTolerance
    );

    // Cut at each beat (in reverse order to maintain indices)
    beatsInClip.reverse().forEach((beat) => {
      cutClipAtTime(item.id, beat);
    });
  };

  const snapToNearestBeat = (time: number): number => {
    const closestBeat = mockBeats.reduce((prev, curr) =>
      Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev
    );
    return Math.abs(closestBeat - time) < autoCutTolerance ? closestBeat : time;
  };

  const rippleDelete = () => {
    if (!selectedTimelineItemId) return;

    const item = timeline.find((t) => t.id === selectedTimelineItemId);
    if (!item) return;

    // Delete the item and move all subsequent items left
    deleteTimelineItem(selectedTimelineItemId);

    // Note: The ripple logic is handled in the editorStore deleteTimelineItem function
  };

  const trimToPlayhead = (isStart: boolean) => {
    if (!selectedTimelineItemId) return;

    const item = timeline.find((t) => t.id === selectedTimelineItemId);
    if (!item) return;

    if (isStart) {
      // Trim start to playhead
      const newIn = item.in + (playhead - item.start);
      if (newIn < item.out) {
        trimTimelineItem(selectedTimelineItemId, newIn, item.out);
      }
    } else {
      // Trim end to playhead
      const newOut = item.in + (playhead - item.start);
      if (newOut > item.in) {
        trimTimelineItem(selectedTimelineItemId, item.in, newOut);
      }
    }
  };

  const selectedItem = timeline.find(
    (item) => item.id === selectedTimelineItemId
  );

  return (
    <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Cutting Tools</CardTitle>
        <div className="text-sm text-muted-foreground">
          Razor tool, auto-cutting, and trimming utilities
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Razor Mode Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Razor Tool</h3>
            <Button
              size="sm"
              variant={razorMode ? "default" : "outline"}
              onClick={() => setRazorMode(!razorMode)}
              className="text-xs"
            >
              {razorMode ? "Exit Razor" : "Enter Razor"}
            </Button>
          </div>
          {razorMode && (
            <div className="text-xs text-blue-400 bg-blue-900/20 p-2 rounded">
              🔪 Razor mode active - Click on timeline clips to cut them at the
              playhead
            </div>
          )}
        </div>

        {/* Manual Cutting */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Manual Cutting</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={cutAtPlayhead}
              className="text-xs"
            >
              Cut at Playhead
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={cutSelectedClip}
              disabled={!selectedTimelineItemId}
              className="text-xs"
            >
              Cut Selected
            </Button>
          </div>
        </div>

        <Separator />

        {/* Auto-cutting to Beats */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Auto-Cut to Beats</h3>

          <div className="space-y-2">
            <Label className="text-xs">Cut Tolerance (seconds)</Label>
            <Input
              type="number"
              value={autoCutTolerance}
              onChange={(e) =>
                setAutoCutTolerance(parseFloat(e.target.value) || 0.1)
              }
              className="h-8"
              min="0.1"
              max="2"
              step="0.1"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={autoCutToBeats}
              className="text-xs"
            >
              Auto-Cut All Clips to Beats
            </Button>
            {selectedTimelineItemId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => autoCutToBeatsSingleClip(selectedTimelineItemId)}
                className="text-xs"
              >
                Auto-Cut Selected Clip to Beats
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Trimming Tools */}
        {selectedItem && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Trim Selected Clip</h3>
            <div className="text-xs text-muted-foreground mb-2">
              {selectedItem.clipId} •{" "}
              {(selectedItem.out - selectedItem.in).toFixed(1)}s
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => trimToPlayhead(true)}
                className="text-xs"
              >
                Trim Start to Playhead
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => trimToPlayhead(false)}
                className="text-xs"
              >
                Trim End to Playhead
              </Button>
            </div>

            <Button
              size="sm"
              variant="destructive"
              onClick={rippleDelete}
              className="text-xs w-full"
            >
              Ripple Delete
            </Button>
          </div>
        )}

        <Separator />

        {/* Beat Snapping */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Beat Tools</h3>
          <div className="text-xs text-muted-foreground">
            Next beat:{" "}
            {mockBeats.find((beat) => beat > playhead)?.toFixed(1) || "N/A"}s
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const nextBeat = mockBeats.find((beat) => beat > playhead);
                if (nextBeat && selectedTimelineItemId) {
                  cutClipAtTime(selectedTimelineItemId, nextBeat);
                }
              }}
              disabled={!selectedTimelineItemId}
              className="text-xs"
            >
              Cut at Next Beat
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const snappedTime = snapToNearestBeat(playhead);
                if (selectedTimelineItemId) {
                  cutClipAtTime(selectedTimelineItemId, snappedTime);
                }
              }}
              disabled={!selectedTimelineItemId}
              className="text-xs"
            >
              Cut at Nearest Beat
            </Button>
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        <Separator />
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="font-medium">Keyboard Shortcuts:</div>
          <div>• C: Toggle Razor mode</div>
          <div>• Ctrl+K: Cut at playhead</div>
          <div>• Delete: Delete selected clip</div>
          <div>• [ / ]: Trim start/end to playhead</div>
        </div>
      </CardContent>
    </Card>
  );
};
