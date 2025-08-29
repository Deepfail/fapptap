// React import not required in recent JSX runtimes
import { ClipInfo } from "../state/editorStore";
import { Button } from "./ui/button";

export const ClipItem = ({
  clip,
  onAdd,
}: {
  clip: ClipInfo;
  onAdd: (id: string) => void;
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    try {
      e.dataTransfer.setData("text/clip-id", clip.id);
      // include path and duration as JSON in a fallback mime type
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          id: clip.id,
          path: clip.path,
          duration: clip.duration,
        })
      );
      e.dataTransfer.effectAllowed = "copy";
    } catch (err) {
      // ignore
    }
    // emit global drag start for custom ghost
    window.dispatchEvent(
      new CustomEvent("fapptap-drag-start", {
        detail: { id: clip.id, name: clip.name, thumbnail: clip.thumbnail },
      })
    );
  };

  const handleDrag = (e: React.DragEvent) => {
    window.dispatchEvent(
      new CustomEvent("fapptap-drag-move", {
        detail: { x: e.clientX, y: e.clientY },
      })
    );
  };

  const handleDragEnd = () => {
    window.dispatchEvent(new CustomEvent("fapptap-drag-end"));
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      className="flex items-center gap-3 p-2 hover:bg-slate-700/40 rounded"
    >
      <img
        src={clip.thumbnail}
        alt={clip.name}
        className="w-16 h-10 object-cover rounded"
      />
      <div className="flex-1">
        <div className="text-sm font-medium">{clip.name}</div>
        <div className="text-xs text-muted-foreground">{clip.duration}s</div>
      </div>
      <Button size="sm" onClick={() => onAdd(clip.id)}>
        +
      </Button>
    </div>
  );
};
