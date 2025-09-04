import { useState, useEffect } from "react";
import { useMediaStore } from "@/state/mediaStore";
import { toMediaSrc } from "@/lib/mediaUrl";
import { onDesktopAvailable } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { Shuffle, GripVertical, X } from "lucide-react";

type SelectedVideo = {
  path: string;
  name: string;
  order: number;
};

export default function SelectedVideosTimeline() {
  const { selectedClipIds, toggleClipSelection, clearSelection } =
    useMediaStore();
  const [videos, setVideos] = useState<SelectedVideo[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Convert selected clip IDs to video objects with random order
  useEffect(() => {
    const videoList = Array.from(selectedClipIds).map((path, index) => ({
      path,
      name: path.split("/").pop()?.split("\\").pop() || "Unknown",
      order: index,
    }));

    // Randomize initial order
    const shuffled = videoList.sort(() => Math.random() - 0.5);
    setVideos(shuffled.map((v, i) => ({ ...v, order: i })));
  }, [selectedClipIds]);

  const randomizeOrder = () => {
    const shuffled = [...videos].sort(() => Math.random() - 0.5);
    setVideos(shuffled.map((v, i) => ({ ...v, order: i })));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (
      draggedIndex !== null &&
      dragOverIndex !== null &&
      draggedIndex !== dragOverIndex
    ) {
      const newVideos = [...videos];
      const draggedVideo = newVideos[draggedIndex];

      // Remove dragged item
      newVideos.splice(draggedIndex, 1);

      // Insert at new position
      newVideos.splice(dragOverIndex, 0, draggedVideo);

      // Update order numbers
      setVideos(newVideos.map((v, i) => ({ ...v, order: i })));
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const removeVideo = (path: string) => {
    toggleClipSelection(path);
  };

  if (videos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-400 text-sm">
        Select videos to see them in your timeline
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-slate-700 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-neutral-200">
            Selected Videos ({videos.length})
          </h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={randomizeOrder}
              className="text-xs flex items-center gap-1"
            >
              <Shuffle className="h-3 w-3" />
              Randomize
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearSelection}
              className="text-xs"
            >
              Clear All
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {videos.map((video, index) => (
          <VideoTimelineItem
            key={video.path}
            video={video}
            index={index}
            isDragged={draggedIndex === index}
            isDragOver={dragOverIndex === index}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onRemove={() => removeVideo(video.path)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-3 border-t border-slate-700 bg-slate-900/50">
        <div className="text-xs text-neutral-400">
          Drag to reorder • Videos will play in this sequence
        </div>
      </div>
    </div>
  );
}

function VideoTimelineItem({
  video,
  index,
  isDragged,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onRemove,
}: {
  video: SelectedVideo;
  index: number;
  isDragged: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRemove: () => void;
}) {
  const [src, setSrc] = useState<string>("");
  const [tauriReadyTick, setTauriReadyTick] = useState(0);

  useEffect(() => {
    const off = onDesktopAvailable(() => setTauriReadyTick((t) => t + 1));
    return off;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resolved = await toMediaSrc(video.path);
        if (!cancelled) setSrc(resolved);
      } catch {
        if (!cancelled) setSrc("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [video.path, tauriReadyTick]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
        isDragged
          ? "opacity-50 border-blue-500"
          : isDragOver
          ? "border-blue-400 bg-blue-500/10"
          : "border-neutral-800 hover:border-neutral-700 bg-neutral-900"
      }`}
    >
      {/* Order Number */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">
        {index + 1}
      </div>

      {/* Video Thumbnail */}
      <div className="flex-shrink-0 w-16 h-9 rounded overflow-hidden bg-black">
        {src ? (
          <video
            src={src}
            preload="metadata"
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-neutral-500 text-xs">
            •••
          </div>
        )}
      </div>

      {/* Video Name */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-neutral-200 truncate font-medium">
          {video.name}
        </div>
        <div className="text-xs text-neutral-400">
          {video.path.split("/").slice(-2, -1)[0] || "Unknown folder"}
        </div>
      </div>

      {/* Drag Handle */}
      <div className="flex-shrink-0 p-1 text-neutral-400 hover:text-neutral-200 cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 p-1 text-neutral-400 hover:text-red-400 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
