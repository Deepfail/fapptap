import { useState } from "react";
import { useEditor } from "../state/editorStore";
import { beatSyncTools, generateMockBeats } from "../lib/beatSync";
import type { BeatSyncOptions } from "../lib/beatSync";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { Slider } from "./ui/slider";

export const BeatSyncTools = () => {
  const {
    selectedTimelineItemId,
    timeline,
    updateTimelineItems,
    replaceTimelineItem,
    playhead,
    setPlayhead,
  } = useEditor();

  const [syncOptions, setSyncOptions] = useState<BeatSyncOptions>({
    tolerance: 0.1,
    quantizeLevel: "1/4",
    swing: 0,
  });

  const [nudgeAmount, setNudgeAmount] = useState(1);
  const [autoCutOptions, setAutoCutOptions] = useState({
    minCutLength: 1.0,
    energyThreshold: 0.7,
    onlyOnBeats: true,
  });

  // Initialize with mock beat data for development
  useState(() => {
    const mockBeats = generateMockBeats(300, 120); // 5 minutes at 120 BPM
    beatSyncTools.updateBeats(mockBeats);
  });

  const selectedItem = timeline.find(
    (item) => item.id === selectedTimelineItemId
  );

  const quantizeSelected = () => {
    if (!selectedItem) return;

    const quantizedStart = beatSyncTools.quantizeTime(
      selectedItem.start,
      syncOptions
    );
    const quantizedIn = beatSyncTools.quantizeTime(
      selectedItem.in,
      syncOptions
    );
    const quantizedOut = beatSyncTools.quantizeTime(
      selectedItem.out,
      syncOptions
    );

    const updatedTimeline = timeline.map((item) =>
      item.id === selectedItem.id
        ? { ...item, start: quantizedStart, in: quantizedIn, out: quantizedOut }
        : item
    );

    updateTimelineItems(updatedTimeline);
  };

  const quantizeAll = () => {
    const quantizedItems = beatSyncTools.quantizeTimelineItems(
      timeline,
      syncOptions
    );
    updateTimelineItems(quantizedItems);
  };

  const nudgeSelected = (direction: "forward" | "backward") => {
    if (!selectedItem) return;

    const nudgedStart = beatSyncTools.nudgeTime(
      selectedItem.start,
      direction,
      nudgeAmount,
      syncOptions.quantizeLevel
    );

    const updatedTimeline = timeline.map((item) =>
      item.id === selectedItem.id
        ? { ...item, start: Math.max(0, nudgedStart) }
        : item
    );

    updateTimelineItems(updatedTimeline);
  };

  const nudgePlayhead = (direction: "forward" | "backward") => {
    const nudgedTime = beatSyncTools.nudgeTime(
      playhead,
      direction,
      nudgeAmount,
      syncOptions.quantizeLevel
    );

    setPlayhead(Math.max(0, nudgedTime));
  };

  const snapToNearestBeat = () => {
    const nearestBeat = beatSyncTools.findNearestBeat(
      playhead,
      syncOptions.tolerance
    );
    if (nearestBeat) {
      setPlayhead(nearestBeat.time);
    }
  };

  const autoCutSelected = () => {
    if (!selectedItem) return;

    const cutPoints = beatSyncTools.detectAutoCutPoints(
      selectedItem.start + selectedItem.in,
      selectedItem.start + selectedItem.out,
      autoCutOptions
    );

    if (cutPoints.length === 0) return;

    // Create new timeline items from cut points
    const newItems = [];

    for (let i = 0; i < cutPoints.length; i++) {
      const cutTime = cutPoints[i];
      const nextCutTime =
        i < cutPoints.length - 1
          ? cutPoints[i + 1]
          : selectedItem.start + selectedItem.out;

      // Convert absolute times back to relative clip times
      const clipIn = Math.max(0, cutTime - selectedItem.start);
      const clipOut = Math.min(
        selectedItem.out,
        nextCutTime - selectedItem.start
      );

      if (clipOut > clipIn) {
        newItems.push({
          ...selectedItem,
          id: `${selectedItem.id}-cut-${i}`,
          start: cutTime,
          in: clipIn,
          out: clipOut,
        });
      }
    }

    // Replace selected item with new cut items
    replaceTimelineItem(selectedItem.id, newItems);
  };

  const previewQuantize = () => {
    if (!selectedItem) return null;

    const originalStart = selectedItem.start;
    const quantizedStart = beatSyncTools.quantizeTime(
      selectedItem.start,
      syncOptions
    );
    const delta = quantizedStart - originalStart;

    return {
      original: originalStart,
      quantized: quantizedStart,
      delta: delta,
      deltaMs: Math.round(delta * 1000),
    };
  };

  const preview = previewQuantize();

  return (
    <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Beat Sync Tools</CardTitle>
        <div className="text-sm text-muted-foreground">
          Quantize, nudge, and sync timeline items to musical beats
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quantize Settings */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Quantize Settings</Label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Grid Level</Label>
              <Select
                value={syncOptions.quantizeLevel}
                onValueChange={(value: BeatSyncOptions["quantizeLevel"]) =>
                  setSyncOptions({ ...syncOptions, quantizeLevel: value })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1/1">Whole Note (1/1)</SelectItem>
                  <SelectItem value="1/2">Half Note (1/2)</SelectItem>
                  <SelectItem value="1/4">Quarter Note (1/4)</SelectItem>
                  <SelectItem value="1/8">Eighth Note (1/8)</SelectItem>
                  <SelectItem value="1/16">Sixteenth Note (1/16)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Tolerance (s)</Label>
              <Input
                type="number"
                value={syncOptions.tolerance}
                onChange={(e) =>
                  setSyncOptions({
                    ...syncOptions,
                    tolerance: parseFloat(e.target.value) || 0.1,
                  })
                }
                className="h-8"
                min="0.01"
                max="1"
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">
              Swing Amount: {syncOptions.swing}%
            </Label>
            <Slider
              value={[syncOptions.swing]}
              onValueChange={([value]) =>
                setSyncOptions({ ...syncOptions, swing: value })
              }
              min={0}
              max={50}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        {/* Quantize Preview */}
        {preview && selectedItem && (
          <div className="p-3 bg-slate-900/50 rounded border">
            <h4 className="text-sm font-semibold mb-2">Quantize Preview</h4>
            <div className="text-xs space-y-1">
              <div>Original: {preview.original.toFixed(3)}s</div>
              <div>Quantized: {preview.quantized.toFixed(3)}s</div>
              <div
                className={`font-medium ${
                  preview.deltaMs > 0
                    ? "text-green-400"
                    : preview.deltaMs < 0
                    ? "text-red-400"
                    : "text-gray-400"
                }`}
              >
                Delta: {preview.deltaMs > 0 ? "+" : ""}
                {preview.deltaMs}ms
              </div>
            </div>
          </div>
        )}

        {/* Quantize Actions */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Quantize Actions</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={quantizeSelected}
              disabled={!selectedItem}
              className="text-xs"
            >
              Quantize Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={quantizeAll}
              className="text-xs"
            >
              Quantize All
            </Button>
          </div>
        </div>

        <Separator />

        {/* Nudge Controls */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Nudge Controls</Label>

          <div className="space-y-2">
            <Label className="text-xs">Nudge Amount (subdivisions)</Label>
            <Input
              type="number"
              value={nudgeAmount}
              onChange={(e) => setNudgeAmount(parseInt(e.target.value) || 1)}
              className="h-8"
              min="1"
              max="16"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Nudge Selected Item</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => nudgeSelected("backward")}
                disabled={!selectedItem}
                className="text-xs"
              >
                ← Nudge Back
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => nudgeSelected("forward")}
                disabled={!selectedItem}
                className="text-xs"
              >
                Nudge Forward →
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Nudge Playhead</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => nudgePlayhead("backward")}
                className="text-xs"
              >
                ← Back
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => nudgePlayhead("forward")}
                className="text-xs"
              >
                Forward →
              </Button>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={snapToNearestBeat}
            className="text-xs w-full"
          >
            Snap Playhead to Beat
          </Button>
        </div>

        <Separator />

        {/* Auto-Cut Tools */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Auto-Cut Tools</Label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Min Cut Length (s)</Label>
              <Input
                type="number"
                value={autoCutOptions.minCutLength}
                onChange={(e) =>
                  setAutoCutOptions({
                    ...autoCutOptions,
                    minCutLength: parseFloat(e.target.value) || 1.0,
                  })
                }
                className="h-8"
                min="0.1"
                max="10"
                step="0.1"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Energy Threshold</Label>
              <Input
                type="number"
                value={autoCutOptions.energyThreshold}
                onChange={(e) =>
                  setAutoCutOptions({
                    ...autoCutOptions,
                    energyThreshold: parseFloat(e.target.value) || 0.7,
                  })
                }
                className="h-8"
                min="0"
                max="1"
                step="0.1"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="onlyOnBeats"
              checked={autoCutOptions.onlyOnBeats}
              onChange={(e) =>
                setAutoCutOptions({
                  ...autoCutOptions,
                  onlyOnBeats: e.target.checked,
                })
              }
              className="w-4 h-4"
            />
            <Label htmlFor="onlyOnBeats" className="text-xs">
              Only cut on beat markers
            </Label>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={autoCutSelected}
            disabled={!selectedItem}
            className="text-xs w-full"
          >
            Auto-Cut Selected to Beats
          </Button>
        </div>

        <Separator />

        {/* Beat Info */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Beat Information</Label>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Current Playhead: {playhead.toFixed(3)}s</div>
            {(() => {
              const nearestBeat = beatSyncTools.findNearestBeat(playhead, 0.5);
              return nearestBeat ? (
                <div>
                  Nearest Beat: {nearestBeat.time.toFixed(3)}s (
                  {nearestBeat.type})
                </div>
              ) : (
                <div>No beat nearby</div>
              );
            })()}
            <div>Current BPM: ~120 (estimated)</div>
          </div>
        </div>

        {!selectedItem && (
          <div className="text-center text-muted-foreground py-4 text-sm">
            Select a timeline item to use beat sync tools
          </div>
        )}
      </CardContent>
    </Card>
  );
};
