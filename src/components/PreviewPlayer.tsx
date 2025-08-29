import { useRef, useEffect, useState } from "react";
import { useEditor } from "../state/editorStore";
import { Button } from "./ui/button";

export const PreviewPlayer = ({ src }: { src?: string }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { selectedTimelineItemId, timeline, clips, playhead } = useEditor();
  const [playing, setPlaying] = useState(false);

  const selectedItem = timeline.find((t) => t.id === selectedTimelineItemId);
  const clip = selectedItem
    ? clips.find((c) => c.id === selectedItem.clipId)
    : null;
  const playSrc = clip ? clip.path : src;

  useEffect(() => {
    if (!videoRef.current) return;

    if (selectedItem && videoRef.current) {
      // seek to in point
      videoRef.current.currentTime = selectedItem.in || 0;
      // autoplay on selection
      videoRef.current.play().catch(() => {});
      setPlaying(true);
      return;
    }

    // If playhead was set externally (e.g., drop), jump to that time
    if (typeof playhead === "number" && videoRef.current) {
      try {
        videoRef.current.currentTime = playhead;
      } catch (e) {
        // ignore invalid seeks
      }
      // start playing when playhead jumps
      videoRef.current.play().catch(() => {});
      setPlaying(true);
      return;
    }

    if (playing) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [playing, playSrc, selectedItem, playhead]);

  return (
    <div className="bg-black rounded-md h-64 flex flex-col">
      <div className="flex-1 flex items-center justify-center text-white w-full">
        {playSrc ? (
          <video
            ref={videoRef}
            src={playSrc}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-sm text-muted-foreground">No clip selected</div>
        )}
      </div>
      <div className="p-2 flex items-center justify-between">
        <div className="text-sm text-white">
          {clip ? clip.name : src ? "Preview" : "No clip"}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = 0;
              }
            }}
          >
            Restart
          </Button>
        </div>
      </div>
    </div>
  );
};
