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
  const { 
    timeline, 
    selectedTimelineItemId, 
    updateTimelineItems, 
    selectTimelineItem, 
    setPlayhead 
  } = useEditor();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [style, setStyle] = useState<string>("flashy");
  const [intensity, setIntensity] = useState<number>(75);
  const [aspect, setAspect] = useState<string>("landscape");
  const [cuttingMode, setCuttingMode] = useState<string>("medium");

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
      toast.info("Creating session...");
      
      // 1. Create session with isolated clips
      const { createSession } = await import("@/services/session");
      const session = await createSession(selectedVideos, selectedAudio);
      setProgress(10);

      // 2. Run beats detection
      toast.info("Analyzing beats...");
      const { runBeatsStage, createWorker } = await import("@/services/stages");
      const worker = createWorker();
      
      // Listen to worker progress
      worker.on("beats", (msg) => {
        if (msg.progress) {
          setProgress(10 + msg.progress * 20); // 10-30%
        }
      });

      await runBeatsStage(session.audio, "advanced");
      setProgress(30);

      // 3. Run cutlist generation (skip shots for now)
      toast.info("Generating cutlist...");
      worker.on("cutlist", (msg) => {
        if (msg.progress) {
          setProgress(30 + msg.progress * 30); // 30-60%
        }
      });

      const { runCutlistStage } = await import("@/services/stages");
      await runCutlistStage(session.audio, session.clipsDir, aspect as any, cuttingMode, false);
      setProgress(60);

      // 4. Hydrate editor from generated cutlist
      toast.info("Loading timeline...");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const { cutlistToItems } = await import("@/adapters/cutlist");
      
      try {
        const cutlistText = await readTextFile("cache/cutlist.json");
        const cutlistDoc = JSON.parse(cutlistText);
        let timelineItems = cutlistToItems(cutlistDoc);
        
        // Apply style preset transitions
        const { applyStylePreset } = await import("@/services/styles");
        timelineItems = applyStylePreset(timelineItems, style as any);
        
        // Update timeline and select first item
        updateTimelineItems(timelineItems);
        if (timelineItems.length > 0) {
          selectTimelineItem(timelineItems[0].id);
          setPlayhead(0);
        }
        
        setProgress(70);
        
        // 5. Write canonical cutlist and render proxy
        toast.info("Rendering proxy...");
        const { writeCanonicalCutlist } = await import("@/services/cutlist");
        await writeCanonicalCutlist(timelineItems, cutlistDoc);
        
        worker.on("render", (msg) => {
          if (msg.progress) {
            setProgress(70 + msg.progress * 30); // 70-100%
          }
        });

        const { runRenderStage } = await import("@/services/stages");
        await runRenderStage(true, "landscape"); // proxy=true
        
        setProgress(100);
        toast.success("Generation completed! Timeline ready for editing.");
        
      } catch (cutlistError) {
        console.error("Failed to load cutlist:", cutlistError);
        toast.error("Failed to load generated cutlist");
      }

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
      // 1. Write final canonical cutlist
      toast.info("Preparing export...");
      const { writeCanonicalCutlist } = await import("@/services/cutlist");
      
      // Create base cutlist config for final render
      const baseCutlist = {
        audio: selectedAudio,
        fps: 60,
        width: 1920,
        height: 1080,
      };
      
      await writeCanonicalCutlist(timeline, baseCutlist);
      setProgress(10);

      // 2. Run final render (proxy=false)
      toast.info("Rendering final video...");
      const { runRenderStage, createWorker } = await import("@/services/stages");
      const worker = createWorker();
      
      worker.on("render", (msg) => {
        if (msg.progress) {
          setProgress(10 + msg.progress * 80); // 10-90%
        }
      });

      await runRenderStage(false, "landscape"); // proxy=false for final
      setProgress(90);

      // 3. Show save dialog
      toast.info("Choose save location...");
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { copyFile } = await import("@tauri-apps/plugin-fs");
      
      const savePath = await save({
        title: "Save Exported Video",
        defaultPath: "beatleap-export.mp4",
        filters: [
          {
            name: "Video",
            extensions: ["mp4"],
          },
        ],
      });

      if (savePath) {
        await copyFile("render/fapptap_final.mp4", savePath);
        setProgress(100);
        toast.success(`Video exported successfully to ${savePath}`);
      } else {
        toast.info("Export cancelled");
      }

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
            style={style}
            onStyleChange={setStyle}
            intensity={intensity}
            onIntensityChange={setIntensity}
            aspect={aspect}
            onAspectChange={setAspect}
            cuttingMode={cuttingMode}
            onCuttingModeChange={setCuttingMode}
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