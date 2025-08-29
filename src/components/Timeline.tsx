// React import not required in recent JSX runtimes
import { useEditor } from "../state/editorStore";
import { useState } from "react";
import { TimelineItemComponent } from "./TimelineItemComponent";

export const Timeline = () => {
  const {
    timeline,
    clips,
    selectedTimelineItemId,
    selectTimelineItem,
    addClipToTimeline,
    pixelsPerSecond,
    playhead,
    setPlayhead,
    rippleMode,
    setRippleMode,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditor();
  const [dragX, setDragX] = useState<number | null>(null);
  const [panOffset, setPanOffset] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanX, setLastPanX] = useState(0);
  const [showBeatGrid, setShowBeatGrid] = useState(true);

  // Mock beat data for demonstration - in real app this would come from beat analysis
  const mockBeats = Array.from({length: 20}, (_, i) => i * 2); // Beat every 2 seconds
  
  const timelineWidth = 2000; // Virtual timeline width
  const viewportWidth = 800; // Visible area width

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
    // Account for pan offset
    const adjustedX = x + panOffset;
    // Visual scale from store
    const start = Math.max(0, Math.round(adjustedX / pixelsPerSecond));
    
    // Snap to beat grid if enabled
    if (showBeatGrid) {
      const closestBeat = mockBeats.reduce((prev, curr) => 
        Math.abs(curr - start) < Math.abs(prev - start) ? curr : prev
      );
      if (Math.abs(closestBeat - start) < 0.5) { // 0.5 second snap tolerance
        addClipToTimeline(clipId, closestBeat);
      } else {
        addClipToTimeline(clipId, start);
      }
    } else {
      addClipToTimeline(clipId, start);
    }
    setDragX(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { // Middle button or Shift+Left for pan
      setIsPanning(true);
      setLastPanX(e.clientX);
      e.preventDefault();
    } else if (e.button === 0) { // Left click to set playhead
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const adjustedX = x + panOffset;
      const time = adjustedX / pixelsPerSecond;
      setPlayhead(time);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanX;
      setPanOffset(Math.max(0, Math.min(timelineWidth - viewportWidth, panOffset - deltaX)));
      setLastPanX(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      // Zoom with Ctrl+Wheel (handled by ZoomControls)
      e.preventDefault();
    } else {
      // Pan with wheel
      e.preventDefault();
      const deltaX = e.deltaX || e.deltaY;
      setPanOffset(Math.max(0, Math.min(timelineWidth - viewportWidth, panOffset + deltaX)));
    }
  };

  // Keyboard shortcuts for timeline
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        break;
      case 'r':
        e.preventDefault();
        setRippleMode(!rippleMode);
        break;
      case 'g':
        e.preventDefault();
        setShowBeatGrid(!showBeatGrid);
        break;
    }
  };

  const getPlayheadPosition = () => {
    return playhead * pixelsPerSecond - panOffset;
  };

  const renderBeatGrid = () => {
    if (!showBeatGrid) return null;
    
    return mockBeats.map(beat => {
      const x = beat * pixelsPerSecond - panOffset;
      if (x < -50 || x > viewportWidth + 50) return null; // Virtualization
      
      return (
        <div
          key={beat}
          className="absolute top-0 bottom-0 w-px bg-blue-400/30"
          style={{ left: x }}
        />
      );
    });
  };

  return (
    <div className="bg-slate-900 rounded-md p-2" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-muted-foreground">Timeline</div>
        <div className="flex items-center gap-2">
          <button
            className={`text-xs px-2 py-1 rounded ${
              rippleMode ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
            onClick={() => setRippleMode(!rippleMode)}
          >
            Ripple (R)
          </button>
          <button
            className={`text-xs px-2 py-1 rounded ${
              showBeatGrid ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
            onClick={() => setShowBeatGrid(!showBeatGrid)}
          >
            Grid (G)
          </button>
          <button
            className={`text-xs px-2 py-1 rounded ${
              canUndo ? 'bg-slate-600 text-white hover:bg-slate-500' : 'bg-slate-800 text-slate-500'
            }`}
            onClick={undo}
            disabled={!canUndo}
          >
            Undo
          </button>
          <button
            className={`text-xs px-2 py-1 rounded ${
              canRedo ? 'bg-slate-600 text-white hover:bg-slate-500' : 'bg-slate-800 text-slate-500'
            }`}
            onClick={redo}
            disabled={!canRedo}
          >
            Redo
          </button>
          <div className="text-xs text-muted-foreground">
            Pan: Shift+Drag | Del: Delete | ,/.: Nudge
          </div>
        </div>
      </div>
      <div
        className="h-28 bg-slate-800 rounded-md p-2 overflow-hidden cursor-crosshair"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragX(null)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
      >
        <div className="relative h-full" style={{ width: viewportWidth }}>
          {/* Beat grid */}
          {renderBeatGrid()}
          
          {/* Drag preview line */}
          {dragX !== null && (
            <div
              style={{ left: dragX }}
              className="absolute top-0 h-full w-px bg-white/60 z-10"
            />
          )}
          
          {/* Playhead */}
          <div
            style={{ left: getPlayheadPosition() }}
            className="absolute top-0 h-full w-0.5 bg-red-500 z-20 pointer-events-none"
          >
            <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full" />
          </div>
          
          {/* Timeline items */}
          {timeline.map((item) => {
            const clip = clips.find((c) => c.id === item.clipId);
            return (
              <TimelineItemComponent
                key={item.id}
                item={item}
                clip={clip}
                pixelsPerSecond={pixelsPerSecond}
                panOffset={panOffset}
                isSelected={selectedTimelineItemId === item.id}
                onSelect={selectTimelineItem}
              />
            );
          })}
        </div>
      </div>
      
      {/* Time ruler */}
      <div className="mt-1 relative h-4 text-xs text-muted-foreground">
        {Array.from({length: Math.ceil(timelineWidth / pixelsPerSecond / 5)}, (_, i) => {
          const time = i * 5;
          const x = time * pixelsPerSecond - panOffset;
          if (x < -20 || x > viewportWidth + 20) return null;
          
          return (
            <div
              key={time}
              className="absolute"
              style={{ left: x }}
            >
              {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
            </div>
          );
        })}
      </div>
    </div>
  );
};
