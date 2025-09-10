/**
 * Beatleap PC - Main application layout
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEditor } from "@/state/editorStore";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { isTauriAvailable } from "@/lib/platform";
import { 
  Wand2, 
  Download
} from "lucide-react";

// Component imports
import { LibraryPanel } from "./beatleap/LibraryPanel";
import { PreviewPlayer } from "./beatleap/PreviewPlayer";
import { BeatStrip } from "./beatleap/BeatStrip";
import { Timeline } from "./beatleap/Timeline";
import { Inspector } from "./beatleap/Inspector";

export function BeatleapApp() {
  const { timeline, selectedTimelineItemId } = useEditor();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (!selectedAudio || selectedVideos.length === 0) {
      toast.error("Please select audio and video files first");
      return;
    }

    if (!isTauriAvailable()) {
      toast.error("Generate is only available in desktop mode");
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      toast.info("Starting generation process...");
      // TODO: Implement generate flow
      // 1. Create session
      // 2. Run beats
      // 3. Run cutlist 
      // 4. Hydrate editor
      // 5. Render proxy
      toast.success("Generation completed!");
    } catch (error) {
      console.error("Generate failed:", error);
      toast.error(`Generate failed: ${error}`);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleExport = async () => {
    if (timeline.length === 0) {
      toast.error("No timeline to export");
      return;
    }

    if (!isTauriAvailable()) {
      toast.error("Export is only available in desktop mode");
      return;
    }

    setIsExporting(true);
    setProgress(0);

    try {
      toast.info("Starting export...");
      // TODO: Implement export flow
      // 1. Write canonical cutlist
      // 2. Run final render
      // 3. Show save dialog
      toast.success("Export completed!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(`Export failed: ${error}`);
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-blue-400">Beatleap PC</h1>
          <div className="flex items-center space-x-2">
            {isGenerating && (
              <div className="flex items-center space-x-2">
                <Progress value={progress} className="w-32" />
                <span className="text-sm text-gray-400">Generating...</span>
              </div>
            )}
            {isExporting && (
              <div className="flex items-center space-x-2">
                <Progress value={progress} className="w-32" />
                <span className="text-sm text-gray-400">Exporting...</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || isExporting || !selectedAudio || selectedVideos.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Generate
          </Button>
          <Button
            onClick={handleExport}
            disabled={isGenerating || isExporting || timeline.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Library */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          <LibraryPanel
            selectedAudio={selectedAudio}
            onAudioSelect={setSelectedAudio}
            selectedVideos={selectedVideos}
            onVideosSelect={setSelectedVideos}
          />
        </div>

        {/* Center - Player + Beat Strip */}
        <div className="flex-1 flex flex-col">
          {/* Player */}
          <div className="flex-1 bg-black">
            <PreviewPlayer />
          </div>
          
          {/* Beat Strip */}
          <div className="h-16 bg-gray-800 border-b border-gray-700">
            <BeatStrip />
          </div>
        </div>

        {/* Right Sidebar - Inspector */}
        <div className="w-80 bg-gray-800 border-l border-gray-700">
          <Inspector selectedItemId={selectedTimelineItemId || null} />
        </div>
      </div>

      {/* Bottom Timeline */}
      <div className="h-32 bg-gray-850 border-t border-gray-700">
        <Timeline />
      </div>

      <Toaster theme="dark" />
    </div>
  );
}