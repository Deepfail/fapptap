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

import "./App.css";

export default function App() {
  const loadPrefs = useMediaStore((state: MediaStore) => state.loadPrefs);

  // local wiring: selected clip for preview + last dir (can persist later via Tauri Store)
  const [currentClip, setCurrentClip] = useState<string | undefined>();
  const [lastDir, setLastDir] = useState<string | undefined>();

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <TopBar />

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
}
