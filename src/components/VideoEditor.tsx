import { useState } from "react";
import { PreviewVideo, Timeline, TransportControls } from "./Timeline/index";
import { usePlayerStore } from "../state/playerStore";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { formatTime } from "@/utils/timelineUtils";

interface VideoEditorProps {
  currentClip?: string;
  className?: string;
}

export function VideoEditor({ currentClip, className }: VideoEditorProps) {
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);

  const { duration, currentTime, cuts, selectedCutId } = usePlayerStore();

  if (!currentClip) {
    return (
      <div
        className={`flex items-center justify-center h-full bg-slate-900 ${className}`}
      >
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 bg-slate-800 rounded-lg flex items-center justify-center">
            <div className="w-8 h-8 bg-slate-600 rounded" />
          </div>
          <p className="text-slate-400 mb-2">No video selected</p>
          <p className="text-sm text-slate-500">
            Select a video from the library to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 ${className}`}
    >
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-800/30 backdrop-blur-md border-b border-slate-700/50">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-medium text-slate-300">Video Editor</h2>
          <Separator orientation="vertical" className="h-4" />
          <div className="text-xs text-slate-400">
            {cuts.length} cuts • {duration.toFixed(1)}s duration
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showEffectsPanel ? "default" : "outline"}
            onClick={() => setShowEffectsPanel(!showEffectsPanel)}
            className={
              showEffectsPanel
                ? "bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                : "border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/10"
            }
          >
            ✨ Effects
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/10"
          >
            📤 Export
          </Button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Video Preview with Enhanced Layout */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Video Player - Centered and Constrained */}
          <div className="flex-1 bg-black/20 backdrop-blur-sm relative p-4">
            {/* Constrain preview to ~60vh and center it */}
            <div className="mx-auto w-full max-w-[1280px] h-[60vh]">
              <div className="relative w-full h-full rounded-xl border border-slate-700/50 overflow-hidden bg-black">
                <PreviewVideo
                  src={currentClip}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
            </div>
            {/* Video Overlay Info */}
            <div className="absolute top-8 left-8 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/30">
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

            {/* Cut Info Overlay */}
            {selectedCutId && (
              <div className="absolute top-8 right-8 bg-fuchsia-600/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-fuchsia-500/30">
                <div className="text-sm text-white font-medium">
                  🎬 Cut Selected
                </div>
              </div>
            )}
          </div>

          {/* Beat Timeline Area */}
          <div className="h-20 bg-slate-800/40 backdrop-blur-sm border-t border-slate-700/30 p-3">
            <div className="text-xs text-slate-400 mb-2 font-medium">
              Beat Timeline
            </div>
            <div className="flex items-center justify-center h-10 border border-slate-600/30 rounded-lg bg-slate-900/50 relative overflow-hidden">
              {/* Mock beat visualization */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-1">
                  {/* Generate mock beats with different sizes */}
                  {Array.from({ length: 20 }, (_, i) => {
                    const isDownbeat = i % 4 === 0;
                    const isStrongBeat = i % 2 === 0;
                    const size = isDownbeat
                      ? "h-3 w-3"
                      : isStrongBeat
                      ? "h-2 w-2"
                      : "h-1 w-1";
                    const color = isDownbeat
                      ? "bg-fuchsia-500"
                      : isStrongBeat
                      ? "bg-fuchsia-400"
                      : "bg-fuchsia-300";
                    return (
                      <div
                        key={i}
                        className={`${size} ${color} rounded-full opacity-70 hover:opacity-100 transition-opacity cursor-pointer`}
                        title={`Beat ${i + 1}${
                          isDownbeat ? " (Downbeat)" : ""
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
              <span className="text-xs text-slate-500 relative z-10 bg-slate-900/80 px-2 py-1 rounded">
                Beats visualization (hover dots for info)
              </span>
            </div>
          </div>

          {/* Experimental Clip Timeline */}
          <div className="h-16 bg-slate-800/40 backdrop-blur-sm border-t border-slate-700/30 p-3">
            <div className="text-xs text-slate-400 mb-2 font-medium">
              Clip Timeline (Experimental)
            </div>
            <div className="flex items-center justify-center h-8 border border-slate-600/30 rounded-lg bg-slate-900/50 relative overflow-hidden">
              {/* Mock clip thumbnails */}
              <div className="absolute inset-0 flex items-center justify-start px-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 15 }, (_, i) => (
                    <div
                      key={i}
                      className="h-5 w-2 bg-gradient-to-b from-slate-600 to-slate-700 border-r border-slate-500/30 hover:from-fuchsia-600 hover:to-fuchsia-700 transition-colors cursor-pointer"
                      title={`Clip ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
              <span className="text-xs text-slate-500 relative z-10 bg-slate-900/80 px-2 py-1 rounded">
                Clip thumbnails (zoomable - hover to preview)
              </span>
            </div>
          </div>

          {/* Enhanced Control Area */}
          <div className="h-24 bg-slate-800/40 backdrop-blur-sm border-t border-slate-700/30 p-3">
            <div className="flex items-center justify-between h-full">
              <div className="flex gap-3">
                <button className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm rounded-lg transition-colors font-medium shadow-lg">
                  🔀 Shuffle Videos
                </button>
                <button className="px-4 py-2 bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors border border-slate-600/50">
                  ✨ Effects
                </button>
                <button className="px-4 py-2 bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors border border-slate-600/50">
                  🎨 Transitions
                </button>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Timeline:</span>
                  <span className="text-fuchsia-400 font-medium">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Cuts:</span>
                  <span className="text-fuchsia-400 font-medium">
                    {cuts.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="h-40 border-t border-slate-700/50 bg-slate-800/30">
            <Timeline />
          </div>

          {/* Transport Controls */}
          <TransportControls />
        </div>

        {/* Right: Effects Panel (when open) */}
        {showEffectsPanel && (
          <div className="w-80 border-l border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
            <EffectsPanel />
          </div>
        )}
      </div>
    </div>
  );
}

// Effects Panel Component
function EffectsPanel() {
  return (
    <div className="h-full p-4">
      <div className="text-sm font-medium text-slate-300 mb-4">
        🎨 Effects & Filters
      </div>
      <div className="space-y-3">
        {/* Placeholder for effects */}
        <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/30">
          <div className="text-xs text-slate-400 mb-2">Visual Effects</div>
          <div className="flex gap-2">
            <button className="px-2 py-1 text-xs bg-slate-600/70 hover:bg-slate-600 text-slate-300 rounded border border-slate-500/50">
              Blur
            </button>
            <button className="px-2 py-1 text-xs bg-slate-600/70 hover:bg-slate-600 text-slate-300 rounded border border-slate-500/50">
              Sharpen
            </button>
            <button className="px-2 py-1 text-xs bg-slate-600/70 hover:bg-slate-600 text-slate-300 rounded border border-slate-500/50">
              Vintage
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/30">
          <div className="text-xs text-slate-400 mb-2">Color Grading</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 w-16">Contrast:</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                defaultValue="1"
                className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 w-16">Saturation:</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                defaultValue="1"
                className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/30">
          <div className="text-xs text-slate-400 mb-2">Transitions</div>
          <div className="grid grid-cols-2 gap-2">
            {["Fade", "Slide", "Zoom", "Dissolve"].map((transition) => (
              <button
                key={transition}
                className="px-2 py-1 text-xs bg-slate-600/70 hover:bg-slate-600 text-slate-300 rounded border border-slate-500/50"
              >
                {transition}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
