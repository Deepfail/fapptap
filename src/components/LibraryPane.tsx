import { useState } from "react";
import { VirtualizedGrid } from "./VirtualizedGrid";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { FolderOpen, Music, Search, Grid, List } from "lucide-react";
import { useMediaStore } from "../state/mediaStore";
import { PythonWorker } from "../lib/worker";
import { MediaFileCard } from "./MediaFileCard";
import { Input } from "./ui/input";

export function LibraryPane() {
  const {
    mediaFiles,
    clipsDir,
    selectedClipIds,
    setClipsDir,
    setSongPath,
    addMediaFiles,
    clearMediaFiles,
    jobs,
  } = useMediaStore();

  const [worker] = useState(() => new PythonWorker());
  const [isScanning, setIsScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy] = useState<"name" | "duration" | "size" | "date">("name");

  const handleSelectSong = async () => {
    const path = await worker.selectSong();
    if (path) {
      setSongPath(path);
    }
  };

  const handleSelectClipsDirectory = async () => {
    const path = await worker.selectClipsDirectory();
    if (path) {
      setClipsDir(path);
      await scanDirectory(path);
    }
  };

  const scanDirectory = async (_dirPath: string) => {
    setIsScanning(true);
    clearMediaFiles();

    try {
      // This would need to be implemented in the worker
      // For now, we'll use mock data in browser mode
      if (typeof window !== "undefined" && !(window as any).__TAURI__) {
        // Browser fallback - load mock data
        const response = await fetch("/mock/clips.json");
        const mockClips = await response.json();

        const mediaFiles = mockClips.map((clip: any) => ({
          id: clip.id,
          name: clip.name,
          path: clip.path,
          duration: clip.duration,
          width: 1920,
          height: 1080,
          fps: 30,
          size: Math.floor(Math.random() * 1000000000), // Random size
          mtime: Date.now() - Math.floor(Math.random() * 86400000), // Random recent time
          thumbnail: clip.thumbnail,
          metadata: {
            codec: "h264",
            bitrate: 5000,
            format: "mp4",
          },
        }));

        addMediaFiles(mediaFiles);
      } else {
        // TODO: Implement actual directory scanning via Tauri
        // This would enumerate video files and queue probe/thumbnail jobs
        console.log("Directory scanning not yet implemented for Tauri");
      }
    } catch (error) {
      console.error("Failed to scan directory:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const filteredFiles = mediaFiles.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "duration":
        return b.duration - a.duration;
      case "size":
        return b.size - a.size;
      case "date":
        return b.mtime - a.mtime;
      default:
        return 0;
    }
  });

  const pendingJobs = jobs.filter(
    (job) => job.type === "probe" || job.type === "thumbnail"
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Media Library</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "default" : "ghost"}
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Import Controls */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Button size="sm" onClick={handleSelectSong} variant="outline">
            <Music className="h-4 w-4 mr-2" />
            Song
          </Button>
          <Button
            size="sm"
            onClick={handleSelectClipsDirectory}
            variant="outline"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Clips
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search media..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{filteredFiles.length} files</span>
          <span>{selectedClipIds.size} selected</span>
        </div>
      </div>

      {/* Scanning Progress */}
      {(isScanning || pendingJobs.length > 0) && (
        <div className="p-4 border-b border-slate-700">
          <div className="text-sm text-slate-300 mb-2">
            {isScanning
              ? "Scanning directory..."
              : `Processing ${pendingJobs.length} files...`}
          </div>
          <Progress value={isScanning ? undefined : 75} className="h-2" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {clipsDir && (
          <div className="p-3 bg-slate-800/50 border-b border-slate-700 text-xs text-slate-400">
            📁 {clipsDir}
          </div>
        )}

        {sortedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm mb-2">No media files</p>
            <p className="text-xs opacity-75">
              Select a clips directory to get started
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <VirtualizedGrid
            items={sortedFiles}
            itemWidth={200}
            itemHeight={150}
            gap={12}
            renderItem={(file) => (
              <MediaFileCard key={file.id} file={file} viewMode={viewMode} />
            )}
          />
        ) : (
          <div className="p-3 space-y-2">
            {sortedFiles.map((file) => (
              <MediaFileCard key={file.id} file={file} viewMode={viewMode} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {selectedClipIds.size > 0 && (
        <div className="p-3 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">
              {selectedClipIds.size} selected
            </span>
            <Button size="sm">Include in Project</Button>
          </div>
        </div>
      )}
    </div>
  );
}
