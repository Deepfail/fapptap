// src/App.tsx
import { useEffect, useState } from "react";

// UI & panes
import { Toaster } from "@/components/ui/sonner";
import { LibraryPane } from "@/components/library";
import { PreviewPlayer } from "@/components/preview";
import { ActionsPane } from "./components/ActionsPane";
import { TopBar } from "./components/TopBar";
// state (prefs loader)
import { useMediaStore, MediaStore } from "./state/mediaStore";
import { Button } from "./components/ui/button";

import { VideoEditor } from "./components/VideoEditor";
import { EditorProvider } from "./state/editorStore";

import "./App.css";

export default function App() {
  const loadPrefs = useMediaStore((state: MediaStore) => state.loadPrefs);

  // local wiring: selected clip for preview + last dir (can persist later via Tauri Store)
  const [currentClip, setCurrentClip] = useState<string | undefined>();
  const [lastDir, setLastDir] = useState<string | undefined>();
  const [editorMode, setEditorMode] = useState(false);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  const renderContent = () => {
    if (editorMode) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-slate-100 flex flex-col">
          {/* Top Bar with Editor Mode Toggle */}
          <div className="flex items-center justify-between p-3 border-b border-slate-700/50 bg-slate-800/30 backdrop-blur-md">
            <TopBar />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditorMode(false)}
              className="text-xs border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/10"
            >
              Back to Library
            </Button>
          </div>

          {/* Full Editor Layout - Fixed Height to Prevent Stretching */}
          <div className="flex-1 flex overflow-hidden min-h-0 max-h-screen">
            {/* Narrow Library Sidebar */}
            <aside className="w-1/5 min-w-[250px] max-w-[300px] border-r border-slate-700/50 bg-slate-800/30 backdrop-blur-sm overflow-hidden">
              <LibraryPane
                initialDir={lastDir}
                onDirChange={setLastDir}
                onSelectClip={setCurrentClip}
              />
            </aside>

            {/* Main Editor */}
            <main className="flex-1 overflow-hidden">
              <VideoEditor currentClip={currentClip} />
            </main>
          </div>

          <Toaster position="top-right" theme="dark" />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-slate-100 flex flex-col">
        {/* Top Bar with Editor Mode Toggle */}
        <div className="flex items-center justify-between p-3 border-b border-slate-700/50 bg-slate-800/30 backdrop-blur-md">
          <TopBar />
          <Button
            size="sm"
            variant="default"
            onClick={() => setEditorMode(true)}
            className="text-xs bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
          >
            Open Editor
          </Button>
        </div>

        {/* Main Three-Pane Layout - Fixed Height to Prevent Stretching */}
        <div className="flex-1 flex overflow-hidden min-h-0 max-h-screen">
          {/* Left Pane: Library (~25% width) */}
          <aside className="w-1/4 min-w-[300px] max-w-[400px] border-r border-slate-700/50 bg-slate-800/30 backdrop-blur-sm overflow-hidden">
            <LibraryPane
              initialDir={lastDir}
              onDirChange={setLastDir}
              onSelectClip={setCurrentClip}
            />
          </aside>

          {/* Center Pane: Preview (50% width, centered focus) */}
          <main className="flex-1 bg-slate-900/95 backdrop-blur-sm p-4 overflow-hidden flex flex-col">
            {/* Video Player - Top Centered */}
            <div className="flex-1 max-h-[60vh] rounded-xl border border-slate-700/50 overflow-hidden bg-black/20 backdrop-blur-sm">
              <PreviewPlayer
                srcPath={currentClip}
                muted
                autoHideMs={5000}
                // later: publish t to a transport/timeline store
                onTime={() => {}}
              />
            </div>
            
            {/* Beat Timeline Area */}
            <div className="h-16 mt-3 rounded-lg bg-slate-800/40 backdrop-blur-sm border border-slate-700/30 p-2">
              <div className="text-xs text-slate-400 mb-1">Beat Timeline</div>
              <div className="flex items-center justify-center h-8 border border-slate-600/30 rounded bg-slate-900/50 relative overflow-hidden">
                {/* Mock beat visualization with fuchsia dots */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-1">
                    {Array.from({length: 20}, (_, i) => {
                      const isDownbeat = i % 4 === 0;
                      const isStrongBeat = i % 2 === 0;
                      const size = isDownbeat ? 'h-3 w-3' : isStrongBeat ? 'h-2 w-2' : 'h-1 w-1';
                      const color = isDownbeat ? 'bg-fuchsia-500 shadow-fuchsia-500/50' : isStrongBeat ? 'bg-fuchsia-400' : 'bg-fuchsia-300';
                      return (
                        <div 
                          key={i} 
                          className={`${size} ${color} rounded-full opacity-80 hover:opacity-100 transition-all cursor-pointer hover:scale-125 ${isDownbeat ? 'shadow-lg' : ''}`}
                          title={`Beat ${i + 1}${isDownbeat ? ' (Downbeat)' : ''}`}
                        />
                      );
                    })}
                  </div>
                </div>
                <span className="text-xs text-slate-500 relative z-10 bg-slate-900/90 px-2 py-1 rounded border border-slate-700/50">
                  Interactive beats visualization
                </span>
              </div>
            </div>
            
            {/* Experimental Clip Timeline */}
            <div className="h-12 mt-2 rounded-lg bg-slate-800/40 backdrop-blur-sm border border-slate-700/30 p-2">
              <div className="text-xs text-slate-400 mb-1">Clip Timeline (Experimental)</div>
              <div className="flex items-center justify-center h-6 border border-slate-600/30 rounded bg-slate-900/50 relative overflow-hidden">
                {/* Mock clip thumbnails with hover effects */}
                <div className="absolute inset-0 flex items-center justify-start px-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({length: 15}, (_, i) => (
                      <div 
                        key={i} 
                        className="h-4 w-2 bg-gradient-to-b from-slate-600 to-slate-700 border-r border-slate-500/30 hover:from-fuchsia-600 hover:to-fuchsia-700 transition-all cursor-pointer hover:h-5 hover:w-3"
                        title={`Clip ${i + 1} - Click to select`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-slate-500 relative z-10 bg-slate-900/90 px-2 py-1 rounded border border-slate-700/50">
                  Zoomable clip timeline
                </span>
              </div>
            </div>
            
            {/* Control Area */}
            <div className="h-20 mt-3 rounded-lg bg-slate-800/40 backdrop-blur-sm border border-slate-700/30 p-3">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs rounded-md transition-colors font-medium shadow-lg">
                    🔀 Shuffle Videos
                  </button>
                  <button className="px-3 py-1 bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs rounded-md transition-colors border border-fuchsia-500/20 hover:border-fuchsia-500/40">
                    ✨ Effects
                  </button>
                </div>
                <div className="flex gap-4 text-xs text-slate-400">
                  <div>Min Beat Length: <span className="text-fuchsia-400 font-medium">250ms</span></div>
                  <div>Speed: <span className="text-fuchsia-400 font-medium">1.0x</span></div>
                </div>
              </div>
            </div>
          </main>

          {/* Right Pane: Actions (~25% width) */}
          <aside className="w-1/4 min-w-[300px] max-w-[400px] border-l border-slate-700/50 bg-slate-800/30 backdrop-blur-sm overflow-auto">
            <ActionsPane />
          </aside>
        </div>

        <Toaster position="top-right" theme="dark" />
      </div>
    );
  };

  return <EditorProvider>{renderContent()}</EditorProvider>;
}
