/**
 * Library Panel - Audio picker + Video picker + Style/Settings
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauriAvailable } from "@/lib/platform";
import { 
  Music, 
  Video,
  Plus,
  X
} from "lucide-react";

interface LibraryPanelProps {
  selectedAudio: string;
  onAudioSelect: (path: string) => void;
  selectedVideos: string[];
  onVideosSelect: (paths: string[]) => void;
}

export function LibraryPanel({
  selectedAudio,
  onAudioSelect,
  selectedVideos,
  onVideosSelect,
}: LibraryPanelProps) {
  const [style, setStyle] = useState<string>("flashy");
  const [intensity, setIntensity] = useState([75]);
  const [aspect, setAspect] = useState<string>("landscape");
  const [cuttingMode, setCuttingMode] = useState<string>("medium");

  const handleSelectAudio = async () => {
    if (!isTauriAvailable()) {
      // Browser fallback - show message
      alert("Audio selection is only available in desktop mode");
      return;
    }

    try {
      const selected = await open({
        title: "Select Audio File",
        filters: [
          {
            name: "Audio",
            extensions: ["mp3", "wav", "flac", "m4a", "aac"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        onAudioSelect(selected);
      }
    } catch (error) {
      console.error("Failed to select audio:", error);
    }
  };

  const handleSelectVideos = async () => {
    if (!isTauriAvailable()) {
      // Browser fallback - show message
      alert("Video selection is only available in desktop mode");
      return;
    }

    try {
      const selected = await open({
        title: "Select Video Files",
        multiple: true,
        filters: [
          {
            name: "Video",
            extensions: ["mp4", "mov", "avi", "mkv", "webm"],
          },
        ],
      });

      if (selected && Array.isArray(selected)) {
        onVideosSelect(selected);
      } else if (selected && typeof selected === "string") {
        onVideosSelect([selected]);
      }
    } catch (error) {
      console.error("Failed to select videos:", error);
    }
  };

  const removeVideo = (index: number) => {
    const newVideos = selectedVideos.filter((_, i) => i !== index);
    onVideosSelect(newVideos);
  };

  const getFileName = (path: string) => {
    return path.split(/[\\/]/).pop() || path;
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto">
      {/* Audio Section */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-200 flex items-center">
          <Music className="w-4 h-4 mr-2" />
          Audio
        </Label>
        <Button
          onClick={handleSelectAudio}
          variant="outline"
          className="w-full justify-start text-left"
        >
          <Plus className="w-4 h-4 mr-2" />
          {selectedAudio ? getFileName(selectedAudio) : "Select audio file..."}
        </Button>
        {selectedAudio && (
          <div className="text-xs text-gray-400 truncate" title={selectedAudio}>
            {selectedAudio}
          </div>
        )}
      </div>

      {/* Videos Section */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-200 flex items-center">
          <Video className="w-4 h-4 mr-2" />
          Videos ({selectedVideos.length})
        </Label>
        <Button
          onClick={handleSelectVideos}
          variant="outline"
          className="w-full justify-start"
        >
          <Plus className="w-4 h-4 mr-2" />
          Select video files...
        </Button>
        
        {/* Video List */}
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {selectedVideos.map((video, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-700 rounded px-3 py-2"
            >
              <span className="text-sm truncate flex-1" title={video}>
                {getFileName(video)}
              </span>
              <Button
                onClick={() => removeVideo(index)}
                size="sm"
                variant="ghost"
                className="h-auto p-1 text-gray-400 hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Style Preset */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-200">Style Preset</Label>
        <Select value={style} onValueChange={setStyle}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flashy">Flashy</SelectItem>
            <SelectItem value="smooth">Smooth</SelectItem>
            <SelectItem value="punchy">Punchy</SelectItem>
            <SelectItem value="whip">Whip</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-gray-400">
          {style === "flashy" && "Flash cuts on beats with whip pans"}
          {style === "smooth" && "Crossfades everywhere"}
          {style === "punchy" && "Hard cuts with flash on downbeats"}
          {style === "whip" && "Whip pans on all boundaries"}
        </div>
      </div>

      {/* Intensity */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-200">
          Intensity: {intensity[0]}%
        </Label>
        <Slider
          value={intensity}
          onValueChange={setIntensity}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-200">Aspect</Label>
        <Select value={aspect} onValueChange={setAspect}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="landscape">Landscape (16:9)</SelectItem>
            <SelectItem value="portrait">Portrait (9:16)</SelectItem>
            <SelectItem value="square">Square (1:1)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cutting Mode */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-200">Cutting Mode</Label>
        <Select value={cuttingMode} onValueChange={setCuttingMode}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="slow">Slow</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="fast">Fast</SelectItem>
            <SelectItem value="ultra_fast">Ultra Fast</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}