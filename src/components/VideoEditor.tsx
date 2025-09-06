import React, { useState } from 'react';
import { PreviewVideo, Timeline, TransportControls } from './Timeline/index';
import { usePlayerStore } from '../state/playerStore';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

interface VideoEditorProps {
  currentClip?: string;
  className?: string;
}

export function VideoEditor({ currentClip, className }: VideoEditorProps) {
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);
  
  const {
    duration,
    currentTime,
    cuts,
    selectedCutId,
  } = usePlayerStore();

  if (!currentClip) {
    return (
      <div className={`flex items-center justify-center h-full bg-slate-900 ${className}`}>
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
    <div className={`flex flex-col h-full bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 ${className}`}>
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
            className={showEffectsPanel ? "bg-fuchsia-600 hover:bg-fuchsia-700 text-white" : "border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/10"}
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
          <div className="flex-1 bg-black/20 backdrop-blur-sm relative p-4 max-h-[60vh]">
            <div className="h-full rounded-xl border border-slate-700/50 overflow-hidden bg-black">
              <PreviewVideo
                src={currentClip}
                className="w-full h-full object-contain"
              />
            </div>
            
            {/* Video Overlay Info */}
            <div className="absolute top-8 left-8 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/30">
              <div className="text-sm text-white font-mono">
                {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}.{Math.floor((currentTime % 1) * 100).toString().padStart(2, '0')}
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
            <div className="text-xs text-slate-400 mb-2 font-medium">Beat Timeline</div>
            <div className="flex items-center justify-center h-10 border border-slate-600/30 rounded-lg bg-slate-900/50 relative overflow-hidden">
              {/* Mock beat visualization */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-1">
                  {/* Generate mock beats with different sizes */}
                  {Array.from({length: 20}, (_, i) => {
                    const isDownbeat = i % 4 === 0;
                    const isStrongBeat = i % 2 === 0;
                    const size = isDownbeat ? 'h-3 w-3' : isStrongBeat ? 'h-2 w-2' : 'h-1 w-1';
                    const color = isDownbeat ? 'bg-fuchsia-500' : isStrongBeat ? 'bg-fuchsia-400' : 'bg-fuchsia-300';
                    return (
                      <div 
                        key={i} 
                        className={`${size} ${color} rounded-full opacity-70 hover:opacity-100 transition-opacity cursor-pointer`}
                        title={`Beat ${i + 1}${isDownbeat ? ' (Downbeat)' : ''}`}
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
            <div className="text-xs text-slate-400 mb-2 font-medium">Clip Timeline (Experimental)</div>
            <div className="flex items-center justify-center h-8 border border-slate-600/30 rounded-lg bg-slate-900/50 relative overflow-hidden">
              {/* Mock clip thumbnails */}
              <div className="absolute inset-0 flex items-center justify-start px-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({length: 15}, (_, i) => (
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
                  <span className="text-slate-400">Min Beat Length:</span>
                  <span className="text-fuchsia-400 font-medium">250ms</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Speed:</span>
                  <span className="text-fuchsia-400 font-medium">1.0x</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Mode:</span>
                  <span className="text-fuchsia-400 font-medium">Professional</span>
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
  const { selectedCutId, cuts, addEffect } = usePlayerStore();
  const [selectedEffectType, setSelectedEffectType] = useState<'flash' | 'rgb_glitch' | 'zoom' | 'shake'>('flash');
  const [selectedIntensity, setSelectedIntensity] = useState<'low' | 'med' | 'high'>('med');

  const selectedCut = cuts.find(cut => cut.id === selectedCutId);

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
    <div className="p-4 bg-slate-800/30 backdrop-blur-sm">
      <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
        ✨ Effects Panel
      </h3>
      
      {!selectedCutId ? (
        <div className="text-sm text-slate-400 bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
          🎬 Select a cut to add effects
        </div>
      ) : (
        <div className="space-y-4">
          {/* Effect Type Selection */}
          <div>
            <label className="block text-xs text-slate-400 mb-2 font-medium">Effect Type</label>
            <select
              value={selectedEffectType}
              onChange={(e) => setSelectedEffectType(e.target.value as any)}
              className="w-full bg-slate-700/80 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50 transition-colors"
            >
              <option value="flash">⚡ Flash</option>
              <option value="rgb_glitch">🌈 RGB Glitch</option>
              <option value="zoom">🔍 Zoom</option>
              <option value="shake">📳 Shake</option>
            </select>
          </div>

          {/* Intensity Selection */}
          <div>
            <label className="block text-xs text-slate-400 mb-2 font-medium">Intensity</label>
            <div className="flex gap-2">
              {(['low', 'med', 'high'] as const).map(intensity => (
                <button
                  key={intensity}
                  onClick={() => setSelectedIntensity(intensity)}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                    selectedIntensity === intensity
                      ? 'bg-fuchsia-600 text-white shadow-lg'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600 border border-slate-600/50'
                  }`}
                >
                  {intensity.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Add Effect Button */}
          <Button
            onClick={handleAddEffect}
            className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-medium shadow-lg"
            size="sm"
          >
            ➕ Add Effect
          </Button>

          {/* Current Effects List */}
          {selectedCut?.effects && selectedCut.effects.length > 0 && (
            <div>
              <label className="block text-xs text-slate-400 mb-2 font-medium">
                Current Effects ({selectedCut.effects.length})
              </label>
              <div className="space-y-2">
                {selectedCut.effects.map(effect => (
                  <div
                    key={effect.id}
                    className="p-3 bg-slate-700/80 rounded-lg text-xs border border-slate-600/30"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 capitalize font-medium">
                        {effect.type.replace('_', ' ')} ({effect.intensity})
                      </span>
                      <button
                        onClick={() => {
                          // TODO: Implement delete effect
                        }}
                        className="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                      >
                        ❌
                      </button>
                    </div>
                    <div className="text-slate-500 mt-1">
                      ⏱️ @{effect.start.toFixed(2)}s for {effect.duration.toFixed(2)}s
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