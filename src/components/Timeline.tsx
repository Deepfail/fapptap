// React import not required in recent JSX runtimes
import { useEditor } from "../state/editorStore";

import { useState } from "react";

export const Timeline = () => {
  const {
    timeline,
    clips,
    selectedTimelineItemId,
    selectTimelineItem,
    addClipToTimeline,
    pixelsPerSecond,
  } = useEditor();
  const [dragX, setDragX] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragX(Math.max(0, e.clientX - rect.left));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    let clipId = e.dataTransfer.getData("text/clip-id");
    if (!clipId) {
      try {
        const json = e.dataTransfer.getData("application/json");
        const parsed = JSON.parse(json || "{}");
        clipId = parsed.id;
      } catch (err) {
        // ignore
      }
    }
    if (!clipId) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left; // px from left
    // Visual scale from store
    const start = Math.max(0, Math.round(x / pixelsPerSecond));
    addClipToTimeline(clipId, start);
    setDragX(null);
  };

  return (
    <div className="bg-slate-900 rounded-md p-2">
      <div className="text-xs text-muted-foreground mb-2">Timeline</div>
      <div
        className="h-28 bg-slate-800 rounded-md p-2 overflow-auto"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragX(null)}
      >
        <div className="relative h-full min-w-[1200px]">
          {dragX !== null && (
            <div
              style={{ left: dragX }}
              className="absolute top-0 h-full w-px bg-white/60"
            />
          )}
          {timeline.map((item) => {
            const selected = selectedTimelineItemId === item.id;
            const clip = clips.find((c) => c.id === item.clipId);
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => selectTimelineItem(item.id)}
                onKeyDown={(e) =>
                  e.key === "Enter" && selectTimelineItem(item.id)
                }
                className={`absolute top-2 px-2 py-1 rounded mr-2 cursor-pointer ${
                  selected
                    ? "bg-indigo-500 text-white"
                    : "bg-blue-600 text-white"
                }`}
                style={{ left: `${item.start * pixelsPerSecond}px` }}
              >
                {clip ? clip.name : item.clipId}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
