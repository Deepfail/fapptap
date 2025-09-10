/**
 * Inspector - Trim controls and transition selector for selected item
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditor } from "@/state/editorStore";
import { defaultTransitions, getTransitionLabel } from "@/types/transitions";
import { Scissors, ArrowRight, Settings } from "lucide-react";
import { toast } from "sonner";
import { isTauriAvailable } from "@/lib/platform";

interface InspectorProps {
  selectedItemId: string | null;
}

export function Inspector({ selectedItemId }: InspectorProps) {
  const { 
    timeline, 
    trimTimelineItem, 
    updateTransitionOut 
  } = useEditor();

  const [trimIn, setTrimIn] = useState("0.00");
  const [trimOut, setTrimOut] = useState("0.00");
  const [selectedTransition, setSelectedTransition] = useState<string>("none");

  const selectedItem = selectedItemId ? timeline.find(item => item.id === selectedItemId) : null;

  // Update local state when selection changes
  useEffect(() => {
    if (selectedItem) {
      setTrimIn(selectedItem.in.toFixed(2));
      setTrimOut(selectedItem.out.toFixed(2));
      
      // Set transition selection
      if (selectedItem.transitionOut) {
        const key = Object.keys(defaultTransitions).find(k => {
          const t = defaultTransitions[k as keyof typeof defaultTransitions];
          return t.type === selectedItem.transitionOut?.type;
        });
        setSelectedTransition(key || "none");
      } else {
        setSelectedTransition("none");
      }
    }
  }, [selectedItem]);

  const handleTransitionChange = async (value: string) => {
    if (!selectedItem) return;
    
    setSelectedTransition(value);
    
    if (value === "none") {
      updateTransitionOut(selectedItem.id, undefined);
    } else {
      const transition = defaultTransitions[value as keyof typeof defaultTransitions];
      if (transition) {
        updateTransitionOut(selectedItem.id, transition);
      }
    }

    // Trigger debounced proxy update
    triggerProxyUpdate();
  };

  const handleTrimApply = () => {
    if (!selectedItem) return;
    
    const newIn = Math.max(0, parseFloat(trimIn) || 0);
    const newOut = Math.max(newIn + 0.1, parseFloat(trimOut) || newIn + 0.1);
    
    trimTimelineItem(selectedItem.id, newIn, newOut);
    
    // Trigger debounced proxy update
    triggerProxyUpdate();
  };

  // Debounced proxy update function
  const triggerProxyUpdate = async () => {
    if (!isTauriAvailable()) {
      return; // Skip updates in browser mode
    }

    const baseCutlist = {
      audio: "", // This should come from the current session
      fps: 60,
      width: 1920,
      height: 1080,
    };

    try {
      const { debouncedCutlistUpdate } = await import("@/services/cutlist");
      const { runRenderStage } = await import("@/services/stages");
      
      debouncedCutlistUpdate(timeline, baseCutlist, async () => {
        try {
          // Re-render proxy when cutlist updates
          await runRenderStage(true, "landscape");
          toast.success("Preview updated");
        } catch (error) {
          console.warn("Failed to update preview:", error);
        }
      });
    } catch (error) {
      console.warn("Failed to trigger proxy update:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getClipFileName = (clipId: string) => {
    return clipId.split(/[\\/]/).pop() || clipId;
  };

  if (!selectedItem) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-gray-500">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div>No clip selected</div>
          <div className="text-sm">Select a clip to edit</div>
        </div>
      </div>
    );
  }

  const duration = selectedItem.out - selectedItem.in;

  return (
    <div className="p-4 space-y-6 overflow-y-auto">
      {/* Selected Clip Info */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-200">Selected Clip</Label>
        <div className="bg-gray-700 rounded p-3">
          <div className="text-sm font-medium truncate" title={selectedItem.clipId}>
            {getClipFileName(selectedItem.clipId)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Duration: {formatTime(duration)}
          </div>
          <div className="text-xs text-gray-400">
            Timeline: {formatTime(selectedItem.start)}
          </div>
        </div>
      </div>

      {/* Trim Controls */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-200 flex items-center">
          <Scissors className="w-4 h-4 mr-2" />
          Trim In/Out
        </Label>
        
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-gray-400">In Point</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={trimIn}
              onChange={(e) => setTrimIn(e.target.value)}
              className="text-sm"
            />
          </div>
          
          <div>
            <Label className="text-xs text-gray-400">Out Point</Label>
            <Input
              type="number"
              step="0.01"
              min={trimIn}
              value={trimOut}
              onChange={(e) => setTrimOut(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        <Button
          onClick={handleTrimApply}
          size="sm"
          className="w-full"
        >
          Apply Trim
        </Button>
      </div>

      {/* Transition Out */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-200 flex items-center">
          <ArrowRight className="w-4 h-4 mr-2" />
          Transition Out
        </Label>
        
        <Select value={selectedTransition} onValueChange={handleTransitionChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="flash_cut">Flash Cut 2f</SelectItem>
            <SelectItem value="crossfade">Crossfade 8f</SelectItem>
            <SelectItem value="whip_pan_left">Whip L 8f</SelectItem>
            <SelectItem value="whip_pan_right">Whip R 8f</SelectItem>
            <SelectItem value="dip_to_black">Dip 6f</SelectItem>
          </SelectContent>
        </Select>

        {selectedItem.transitionOut && (
          <div className="text-xs text-gray-400 bg-gray-700 rounded p-2">
            Current: {getTransitionLabel(selectedItem.transitionOut)}
          </div>
        )}
      </div>

      {/* Beat Sync Tools */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-200">Beat Sync</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" disabled>
            Snap to Beat
          </Button>
          <Button size="sm" variant="outline" disabled>
            Beat Offset
          </Button>
        </div>
        <div className="text-xs text-gray-400">
          Beat sync tools coming soon
        </div>
      </div>
    </div>
  );
}