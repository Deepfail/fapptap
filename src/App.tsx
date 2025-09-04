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
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
          {/* Top Bar with Editor Mode Toggle */}
          <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/50">
            <TopBar />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditorMode(false)}
              className="text-xs"
            >
              Back to Library
            </Button>
          </div>

          {/* Full Editor Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Narrow Library Sidebar */}
            <aside className="w-64 border-r border-slate-700 bg-slate-800/50 overflow-hidden">
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
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        {/* Top Bar with Editor Mode Toggle */}
        <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/50">
          <TopBar />
          <Button
            size="sm"
            variant="default"
            onClick={() => setEditorMode(true)}
            className="text-xs"
          >
            Open Editor
          </Button>
        </div>

        {/* Main Three-Pane Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Library (320–420px) */}
          <aside className="w-80 lg:w-96 border-r border-slate-700 bg-slate-800/50 overflow-hidden">
            <LibraryPane
              initialDir={lastDir}
              onDirChange={setLastDir}
              onSelectClip={setCurrentClip}
            />
          </aside>

          {/* Center Pane: Preview (flexible) */}
          <main className="flex-1 bg-slate-900 p-3 overflow-hidden">
            <div className="h-full rounded-xl border border-slate-700 overflow-hidden">
              <PreviewPlayer
                srcPath={currentClip}
                muted
                autoHideMs={5000}
                // later: publish t to a transport/timeline store
                onTime={() => {}}
              />
              {/* TODO: mount Beats strip under the player */}
            </div>
          </main>

          {/* Right Pane: Actions (320px) */}
          <aside className="w-80 border-l border-slate-700 bg-slate-800/50 overflow-auto">
            <ActionsPane />
          </aside>
        </div>

        <Toaster position="top-right" theme="dark" />
      </div>
    );
  };

  return <EditorProvider>{renderContent()}</EditorProvider>;
}
