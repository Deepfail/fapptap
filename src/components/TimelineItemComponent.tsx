import { useState, useRef, useCallback } from 'react';
import { useEditor, TimelineItem, ClipInfo } from '../state/editorStore';
import { Thumbnail } from './Thumbnail';

interface TimelineItemComponentProps {
  item: TimelineItem;
  clip: ClipInfo | undefined;
  pixelsPerSecond: number;
  panOffset: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const TimelineItemComponent = ({
  item,
  clip,
  pixelsPerSecond,
  panOffset,
  isSelected,
  onSelect
}: TimelineItemComponentProps) => {
  const { trimTimelineItem, moveTimelineItem, deleteTimelineItem } = useEditor();
  const [isDragging, setIsDragging] = useState(false);
  const [, setIsResizing] = useState<'left' | 'right' | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const x = item.start * pixelsPerSecond - panOffset;
  const width = (item.out - item.in) * pixelsPerSecond;
  
  // Virtualization - don't render items outside viewport
  if (x + width < -100 || x > 800 + 100) return null;

  const handleMouseDown = useCallback((e: React.MouseEvent, type: 'move' | 'left' | 'right') => {
    e.stopPropagation();
    onSelect(item.id);
    
    const dragStart = {
      x: e.clientX,
      itemStart: item.start,
      itemIn: item.in,
      itemOut: item.out
    };

    if (type === 'move') {
      setIsDragging(true);
    } else {
      setIsResizing(type);
    }

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStart.x;
      const deltaTime = deltaX / pixelsPerSecond;

      if (type === 'move') {
        const newStart = Math.max(0, dragStart.itemStart + deltaTime);
        moveTimelineItem(item.id, newStart);
      } else if (type === 'left') {
        const newIn = Math.max(0, Math.min(dragStart.itemIn + deltaTime, dragStart.itemOut - 0.1));
        trimTimelineItem(item.id, newIn, item.out);
      } else if (type === 'right') {
        const newOut = Math.max(dragStart.itemIn + 0.1, dragStart.itemOut + deltaTime);
        trimTimelineItem(item.id, item.in, newOut);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [item, pixelsPerSecond, moveTimelineItem, trimTimelineItem, onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isSelected) return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        deleteTimelineItem(item.id);
        break;
      case ',':
        e.preventDefault();
        // Nudge left by 1 frame (assume 24fps = ~0.042s)
        moveTimelineItem(item.id, Math.max(0, item.start - 0.042));
        break;
      case '.':
        e.preventDefault();
        // Nudge right by 1 frame
        moveTimelineItem(item.id, item.start + 0.042);
        break;
    }
  }, [isSelected, item, moveTimelineItem, deleteTimelineItem]);

  return (
    <div
      ref={itemRef}
      role="button"
      tabIndex={0}
      className={`absolute top-2 rounded overflow-hidden cursor-pointer transition-all duration-200 group ${
        isSelected
          ? "ring-2 ring-indigo-400 shadow-lg z-10"
          : "hover:shadow-md"
      } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ 
        left: Math.max(-90, x),
        width: Math.max(60, width),
        height: '40px'
      }}
      onClick={() => onSelect(item.id)}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      {/* Background with thumbnail or color */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700">
        {clip?.thumbnail && (
          <Thumbnail
            src={clip.thumbnail}
            alt={clip.name}
            className="w-full h-full object-cover opacity-60"
            clipId={clip.id}
            videoPath={clip.path}
            timestamp={item.in + (item.out - item.in) * 0.3}
          />
        )}
      </div>

      {/* Content overlay */}
      <div className="relative z-10 p-1 h-full flex flex-col justify-between text-white text-xs">
        <div className="truncate font-medium">
          {clip ? clip.name : item.clipId}
        </div>
        <div className="opacity-75">
          {(item.out - item.in).toFixed(1)}s
        </div>
      </div>

      {/* Left trim handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-2 bg-indigo-400 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity ${
          isSelected ? 'opacity-100' : ''
        }`}
        onMouseDown={(e) => handleMouseDown(e, 'left')}
        style={{ cursor: 'ew-resize' }}
      />

      {/* Right trim handle */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-2 bg-indigo-400 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity ${
          isSelected ? 'opacity-100' : ''
        }`}
        onMouseDown={(e) => handleMouseDown(e, 'right')}
        style={{ cursor: 'ew-resize' }}
      />

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute inset-0 border-2 border-indigo-400 pointer-events-none" />
      )}
    </div>
  );
};