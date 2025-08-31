import { useEffect } from "react";
import { Toaster } from "./components/ui/sonner";
import { LibraryPane } from "./components/LibraryPane";
import { PreviewPane } from "./components/PreviewPane";
import { ActionsPane } from "./components/ActionsPane";
import { TopBar } from "./components/TopBar";
import { DragGhost } from "./components/DragGhost";
import { useMediaStore } from "./state/mediaStore";
import { EditorProvider } from "./state/editorStore";
import { dev } from "./lib/platform";
import "./App.css";

function App() {
  const loadPrefs = useMediaStore(state => state.loadPrefs);
  
  useEffect(() => {
    // Load preferences on app startup
    loadPrefs();
    
    // Log platform info in development
    dev.logPlatformInfo();
  }, [loadPrefs]);

  return (
    <EditorProvider>
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        {/* Top Bar */}
        <TopBar />
        
        {/* Main Three-Pane Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Library (320-420px) */}
          <div className="w-80 lg:w-96 border-r border-slate-700 bg-slate-800/50">
            <LibraryPane />
          </div>
          
          {/* Center Pane: Preview (flexible) */}
          <div className="flex-1 bg-slate-900">
            <PreviewPane />
          </div>
          
          {/* Right Pane: Actions (320px) */}
          <div className="w-80 border-l border-slate-700 bg-slate-800/50">
            <ActionsPane />
          </div>
        </div>

        <Toaster position="top-right" theme="dark" />
        <DragGhost />
      </div>
    </EditorProvider>
  );
}

export default App;
