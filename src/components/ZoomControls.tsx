import { useEditor } from "../state/editorStore";
import { Button } from "./ui/button";

export const ZoomControls = () => {
  const { pixelsPerSecond, setPixelsPerSecond } = useEditor();
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => setPixelsPerSecond(Math.max(10, pixelsPerSecond - 10))}>-</Button>
      <div className="text-xs text-muted-foreground">{pixelsPerSecond}px/s</div>
      <Button size="sm" onClick={() => setPixelsPerSecond(pixelsPerSecond + 10)}>+</Button>
      <Button size="sm" onClick={() => setPixelsPerSecond(50)}>Reset</Button>
    </div>
  );
};
