import React, { useEffect } from "react";
import { useEditorStore } from "@/store/timeline";
import {
  Transition,
  DEFAULT_TRANSITION_FRAMES,
  TRANSITION_LABELS,
} from "@/types/transitions";
import { useProxyRenderer } from "@/hooks/useProxyRenderer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Inspector({
  children,
  title = "Inspector",
}: {
  children?: React.ReactNode;
  title?: string;
}) {
  const editor = useEditorStore();
  const { debouncedProxyRender } = useProxyRenderer();
  const selectedItem = editor.timeline.find(
    (item) => item.id === editor.selectedId
  );

  // Trigger proxy render on any timeline changes
  useEffect(() => {
    if (editor.timeline.length > 0) {
      debouncedProxyRender();
    }
  }, [editor.timeline, debouncedProxyRender]);

  const handleTransitionChange = (transitionType: string) => {
    if (!selectedItem) return;

    let newTransition: Transition | undefined;

    if (transitionType === "none") {
      newTransition = undefined;
    } else if (transitionType === "flash_cut") {
      newTransition = {
        type: "flash_cut",
        durF: DEFAULT_TRANSITION_FRAMES.flash_cut,
      };
    } else if (transitionType === "crossfade") {
      newTransition = {
        type: "crossfade",
        durF: DEFAULT_TRANSITION_FRAMES.crossfade,
      };
    } else if (transitionType === "whip_pan_left") {
      newTransition = {
        type: "whip_pan",
        durF: DEFAULT_TRANSITION_FRAMES.whip_pan,
        dir: "left",
      };
    } else if (transitionType === "whip_pan_right") {
      newTransition = {
        type: "whip_pan",
        durF: DEFAULT_TRANSITION_FRAMES.whip_pan,
        dir: "right",
      };
    } else if (transitionType === "dip_to_black") {
      newTransition = {
        type: "dip_to_black",
        durF: DEFAULT_TRANSITION_FRAMES.dip_to_black,
      };
    }

    editor.updateTransitionOut(selectedItem.id, newTransition);
  };

  const handleFramesChange = (frames: number) => {
    if (!selectedItem?.transitionOut) return;

    const updatedTransition = { ...selectedItem.transitionOut, durF: frames };
    editor.updateTransitionOut(selectedItem.id, updatedTransition);
  };

  const getTransitionValue = () => {
    if (!selectedItem?.transitionOut) return "none";

    const t = selectedItem.transitionOut;
    if (t.type === "whip_pan") {
      return `whip_pan_${t.dir}`;
    }
    return t.type;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs uppercase text-slate-400">{title}</div>

      {selectedItem ? (
        <div className="space-y-4">
          {/* Trim Controls */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-300">Trim</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-slate-400">In (s)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={selectedItem.in}
                  onChange={(e) =>
                    editor.updateTrim(selectedItem.id, {
                      in: Number(e.target.value),
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Out (s)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={selectedItem.out}
                  onChange={(e) =>
                    editor.updateTrim(selectedItem.id, {
                      out: Number(e.target.value),
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Transition Controls */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-300">Transition Out</Label>
            <Select
              value={getTransitionValue()}
              onValueChange={handleTransitionChange}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="flash_cut">
                  {TRANSITION_LABELS.flash_cut}
                </SelectItem>
                <SelectItem value="crossfade">
                  {TRANSITION_LABELS.crossfade}
                </SelectItem>
                <SelectItem value="whip_pan_left">Whip Pan Left</SelectItem>
                <SelectItem value="whip_pan_right">Whip Pan Right</SelectItem>
                <SelectItem value="dip_to_black">
                  {TRANSITION_LABELS.dip_to_black}
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Frame controls for transitions that support it */}
            {selectedItem.transitionOut &&
              "durF" in selectedItem.transitionOut && (
                <div>
                  <Label className="text-xs text-slate-400">Frames</Label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={selectedItem.transitionOut.durF}
                    onChange={(e) => handleFramesChange(Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>
              )}

            {/* Intensity control for flash cut */}
            {selectedItem.transitionOut?.type === "flash_cut" && (
              <div>
                <Label className="text-xs text-slate-400">Intensity</Label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={selectedItem.transitionOut.intensity || 1}
                  onChange={(e) => {
                    const updatedTransition = {
                      ...selectedItem.transitionOut!,
                      intensity: Number(e.target.value),
                    };
                    editor.updateTransitionOut(
                      selectedItem.id,
                      updatedTransition
                    );
                  }}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-500 text-center py-8">
          Select a timeline item to edit
        </div>
      )}

      <div className="space-y-3">{children}</div>
    </div>
  );
}
