import VideoLibrary from "@/components/VideoLibrary"
import VideoPlayer from "@/components/VideoPlayer"  
import SettingsPanel from "@/components/SettingsPanel"
import EffectsToolbar from "@/components/EffectsToolbar"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"

function App() {
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-panel-border bg-card px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            BeatLeap PC
          </h1>
          <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded">
            v1.0.0
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
          Ready to edit
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Panel - Video Library */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <VideoLibrary />
          </ResizablePanel>
          
          <ResizableHandle className="w-px bg-panel-border hover:bg-accent/50 transition-colors" />
          
          {/* Center Panel - Video Player & Timeline */}
          <ResizablePanel defaultSize={55} minSize={40}>
            <div className="h-full p-4">
              <VideoPlayer />
            </div>
          </ResizablePanel>
          
          <ResizableHandle className="w-px bg-panel-border hover:bg-accent/50 transition-colors" />
          
          {/* Right Panel - Settings */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <SettingsPanel />
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Bottom Toolbar - Effects */}
        <div className="h-auto">
          <EffectsToolbar />
        </div>
      </div>
    </div>
  )
}

export default App