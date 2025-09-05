import { useState } from "react";
import { PreviewVideo, Timeline, TransportControls } from "./Timeline/index";
import { usePlayerStore } from "@/state/playerStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface VideoEditorProps {
  currentClip?: string;
  className?: string;
}

export function VideoEditor({ currentClip, className }: VideoEditorProps) {
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);

  const { duration, currentTime, cuts, selectedCutId } = usePlayerStore();

  return (
    <div className={`flex flex-col h-full bg-slate-900 ${className}`}>
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-medium text-slate-300">Video Editor</h2>
          <Separator orientation="vertical" className="h-4" />
          <div className="text-xs text-slate-500">
            {cuts.length} cuts • {duration.toFixed(1)}s duration
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showEffectsPanel ? "default" : "outline"}
            onClick={() => setShowEffectsPanel(!showEffectsPanel)}
          >
            Effects
          </Button>
          <Button size="sm" variant="outline">
            Export
          </Button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex">
        {/* Left: Video Preview */}
        <div className="flex-1 flex flex-col">
          {/* Video Player */}
          <div className="flex-1 bg-black relative">
            {currentClip ? (
              <PreviewVideo
                src={currentClip}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-lg flex items-center justify-center">
                    <div className="w-8 h-8 bg-slate-600 rounded" />
                  </div>
                  <p className="text-lg mb-2">No video loaded</p>
                  <p className="text-sm text-slate-500">
                    Select a video from the library to preview
                  </p>
                </div>
              </div>
            )}

            {/* Video Overlay Info - always show */}
            {(currentClip || currentTime > 0 || duration > 0) && (
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded px-3 py-2">
                <div className="text-sm text-white font-mono">
                  {Math.floor(currentTime / 60)}:
                  {Math.floor(currentTime % 60)
                    .toString()
                    .padStart(2, "0")}
                  .
                  {Math.floor((currentTime % 1) * 100)
                    .toString()
                    .padStart(2, "0")}
                </div>
              </div>
            )}

            {/* Cut Info Overlay */}
            {selectedCutId && (
              <div className="absolute top-4 right-4 bg-blue-600/80 backdrop-blur-sm rounded px-3 py-2">
                <div className="text-sm text-white">Cut Selected</div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="h-40 border-t border-slate-700">
            <Timeline />
          </div>

          {/* Transport Controls */}
          <TransportControls />
        </div>

        {/* Right: Effects Panel (when open) */}
        {showEffectsPanel && (
          <div className="w-80 border-l border-slate-700 bg-slate-800/50">
            <EffectsPanel />
          </div>
        )}
      </div>
    </div>
  );
}

// Effects Panel Component
function EffectsPanel() {
  const { selectedCutId, cuts, addEffect } = usePlayerStore();
  const [selectedEffectType, setSelectedEffectType] = useState<
    "flash" | "rgb_glitch" | "zoom" | "shake"
  >("flash");
  const [selectedIntensity, setSelectedIntensity] = useState<
    "low" | "med" | "high"
  >("med");

  const selectedCut = cuts.find((cut) => cut.id === selectedCutId);

  const handleAddEffect = () => {
    if (!selectedCutId) return;

    addEffect(selectedCutId, {
      type: selectedEffectType,
      intensity: selectedIntensity,
      start: 0, // At start of cut
      duration: 0.2, // Default duration
      seed: Math.floor(Math.random() * 1000000),
    });
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-4">Effects</h3>

      {!selectedCutId ? (
        <div className="text-sm text-slate-500">
          Select a cut to add effects
        </div>
      ) : (
        <div className="space-y-4">
          {/* Effect Type Selection */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">
              Effect Type
            </label>
            <select
              value={selectedEffectType}
              onChange={(e) => setSelectedEffectType(e.target.value as any)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-300"
            >
              <option value="flash">Flash</option>
              <option value="rgb_glitch">RGB Glitch</option>
              <option value="zoom">Zoom</option>
              <option value="shake">Shake</option>
            </select>
          </div>

          {/* Intensity Selection */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">
              Intensity
            </label>
            <div className="flex gap-2">
              {(["low", "med", "high"] as const).map((intensity) => (
                <button
                  key={intensity}
                  onClick={() => setSelectedIntensity(intensity)}
                  className={`flex-1 px-3 py-2 text-xs rounded ${
                    selectedIntensity === intensity
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {intensity.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Add Effect Button */}
          <Button onClick={handleAddEffect} className="w-full" size="sm">
            Add Effect
          </Button>

          {/* Current Effects List */}
          {selectedCut?.effects && selectedCut.effects.length > 0 && (
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Current Effects ({selectedCut.effects.length})
              </label>
              <div className="space-y-2">
                {selectedCut.effects.map((effect) => (
                  <div
                    key={effect.id}
                    className="p-2 bg-slate-700 rounded text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 capitalize">
                        {effect.type.replace("_", " ")} ({effect.intensity})
                      </span>
                      <button
                        onClick={() => {
                          // TODO: Implement delete effect
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                    <div className="text-slate-500 mt-1">
                      @{effect.start.toFixed(2)}s for{" "}
                      {effect.duration.toFixed(2)}s
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
