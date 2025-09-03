import { useState } from "react";
import { useEditor } from "../state/editorStore";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

interface Transition {
  id: string;
  type: "fade" | "crossfade" | "wipe" | "slide" | "dissolve" | "cut";
  duration: number; // seconds
  fromClipId: string;
  toClipId: string;
  position: number; // timeline position where transition starts
  parameters?: {
    direction?: "left" | "right" | "up" | "down";
    ease?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
    feather?: number;
  };
}

export const TransitionsInspector = () => {
  const { timeline } = useEditor();
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [selectedTransition, setSelectedTransition] = useState<string | null>(
    null
  );

  // Find adjacent clips for creating transitions
  const getAdjacentClips = () => {
    const sortedTimeline = [...timeline].sort((a, b) => a.start - b.start);
    const adjacentPairs: Array<{
      from: (typeof timeline)[0];
      to: (typeof timeline)[0];
    }> = [];

    for (let i = 0; i < sortedTimeline.length - 1; i++) {
      const current = sortedTimeline[i];
      const next = sortedTimeline[i + 1];

      // Check if clips are close enough for a transition (within 2 seconds)
      const currentEnd = current.start + (current.out - current.in);
      const gap = next.start - currentEnd;

      if (gap <= 2 && gap >= -1) {
        // Allow slight overlap or gap
        adjacentPairs.push({ from: current, to: next });
      }
    }

    return adjacentPairs;
  };

  const createTransition = (
    fromClipId: string,
    toClipId: string,
    type: Transition["type"],
    duration: number = 1
  ) => {
    const fromClip = timeline.find((c) => c.id === fromClipId);
    const toClip = timeline.find((c) => c.id === toClipId);

    if (!fromClip || !toClip) return;

    const fromEnd = fromClip.start + (fromClip.out - fromClip.in);
    const position = Math.max(fromEnd - duration / 2, fromClip.start);

    const newTransition: Transition = {
      id: `transition-${Date.now()}`,
      type,
      duration,
      fromClipId,
      toClipId,
      position,
      parameters: {
        direction: "right",
        ease: "ease-in-out",
        feather: 0.5,
      },
    };

    setTransitions((prev) => [...prev, newTransition]);
  };

  const updateTransition = (id: string, updates: Partial<Transition>) => {
    setTransitions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const removeTransition = (id: string) => {
    setTransitions((prev) => prev.filter((t) => t.id !== id));
    if (selectedTransition === id) {
      setSelectedTransition(null);
    }
  };

  const selectedTransitionData = transitions.find(
    (t) => t.id === selectedTransition
  );
  const adjacentClips = getAdjacentClips();

  return (
    <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Transitions</CardTitle>
        <div className="text-sm text-muted-foreground">
          Create smooth transitions between clips
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Transition Creation */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Add Transitions</h3>
          {adjacentClips.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No adjacent clips found. Place clips closer together to create
              transitions.
            </div>
          ) : (
            <div className="space-y-2">
              {adjacentClips.map(({ from, to }) => (
                <div
                  key={`${from.id}-${to.id}`}
                  className="p-2 bg-slate-700/50 rounded"
                >
                  <div className="text-xs text-muted-foreground mb-2">
                    {from.clipId} → {to.clipId}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        "fade",
                        "crossfade",
                        "wipe",
                        "slide",
                        "dissolve",
                      ] as const
                    ).map((type) => (
                      <Button
                        key={type}
                        size="sm"
                        variant="outline"
                        onClick={() => createTransition(from.id, to.id, type)}
                        className="text-xs h-7"
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Existing Transitions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Active Transitions</h3>
          {transitions.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No transitions created yet
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {transitions.map((transition) => {
                const fromClip = timeline.find(
                  (c) => c.id === transition.fromClipId
                );
                const toClip = timeline.find(
                  (c) => c.id === transition.toClipId
                );

                return (
                  <div
                    key={transition.id}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      selectedTransition === transition.id
                        ? "bg-blue-600/20 border border-blue-500"
                        : "bg-slate-700/50 hover:bg-slate-600/50"
                    }`}
                    onClick={() => setSelectedTransition(transition.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        <div className="font-medium capitalize">
                          {transition.type}
                        </div>
                        <div className="text-muted-foreground">
                          {fromClip?.clipId} → {toClip?.clipId}
                        </div>
                        <div className="text-muted-foreground">
                          {transition.duration.toFixed(1)}s @{" "}
                          {transition.position.toFixed(1)}s
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTransition(transition.id);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Transition Properties Editor */}
        {selectedTransitionData && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Transition Properties</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Type</Label>
                  <select
                    value={selectedTransitionData.type}
                    onChange={(e) =>
                      updateTransition(selectedTransitionData.id, {
                        type: e.target.value as Transition["type"],
                      })
                    }
                    className="w-full h-8 px-2 bg-slate-700 border border-slate-600 rounded text-xs"
                  >
                    <option value="fade">Fade</option>
                    <option value="crossfade">Crossfade</option>
                    <option value="wipe">Wipe</option>
                    <option value="slide">Slide</option>
                    <option value="dissolve">Dissolve</option>
                    <option value="cut">Cut</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Duration (seconds)</Label>
                  <Input
                    type="number"
                    value={selectedTransitionData.duration}
                    onChange={(e) =>
                      updateTransition(selectedTransitionData.id, {
                        duration: parseFloat(e.target.value) || 0.1,
                      })
                    }
                    className="h-8"
                    min="0.1"
                    max="5"
                    step="0.1"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Position</Label>
                  <Input
                    type="number"
                    value={selectedTransitionData.position}
                    onChange={(e) =>
                      updateTransition(selectedTransitionData.id, {
                        position: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-8"
                    step="0.1"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Ease</Label>
                  <select
                    value={
                      selectedTransitionData.parameters?.ease || "ease-in-out"
                    }
                    onChange={(e) =>
                      updateTransition(selectedTransitionData.id, {
                        parameters: {
                          ...selectedTransitionData.parameters,
                          ease: e.target.value as any,
                        },
                      })
                    }
                    className="w-full h-8 px-2 bg-slate-700 border border-slate-600 rounded text-xs"
                  >
                    <option value="linear">Linear</option>
                    <option value="ease-in">Ease In</option>
                    <option value="ease-out">Ease Out</option>
                    <option value="ease-in-out">Ease In-Out</option>
                  </select>
                </div>
              </div>

              {/* Direction for Wipe/Slide transitions */}
              {(selectedTransitionData.type === "wipe" ||
                selectedTransitionData.type === "slide") && (
                <div className="space-y-2">
                  <Label className="text-xs">Direction</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {["left", "right", "up", "down"].map((direction) => (
                      <Button
                        key={direction}
                        size="sm"
                        variant={
                          selectedTransitionData.parameters?.direction ===
                          direction
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          updateTransition(selectedTransitionData.id, {
                            parameters: {
                              ...selectedTransitionData.parameters,
                              direction: direction as any,
                            },
                          })
                        }
                        className="text-xs h-7"
                      >
                        {direction.charAt(0).toUpperCase() + direction.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feather for softer transitions */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Feather</Label>
                  <span className="text-xs text-muted-foreground">
                    {(
                      (selectedTransitionData.parameters?.feather || 0.5) * 100
                    ).toFixed(0)}
                    %
                  </span>
                </div>
                <Input
                  type="range"
                  value={selectedTransitionData.parameters?.feather || 0.5}
                  onChange={(e) =>
                    updateTransition(selectedTransitionData.id, {
                      parameters: {
                        ...selectedTransitionData.parameters,
                        feather: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="h-6"
                  min="0"
                  max="1"
                  step="0.01"
                />
              </div>
            </div>
          </>
        )}

        {/* Quick Actions */}
        <Separator />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Auto-create crossfade transitions for all adjacent clips
                adjacentClips.forEach(({ from, to }) => {
                  const existing = transitions.find(
                    (t) => t.fromClipId === from.id && t.toClipId === to.id
                  );
                  if (!existing) {
                    createTransition(from.id, to.id, "crossfade", 0.5);
                  }
                });
              }}
              className="text-xs"
            >
              Auto Crossfade
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTransitions([])}
              className="text-xs"
            >
              Clear All
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
