import { useCallback, useRef } from 'react';
import { usePlayerStore } from '../../state/playerStore';
import { snapTime, constrainTime, preventZeroLengthCuts } from '../../utils/timelineUtils';

export interface TimelineMouseHandlers {
  onMouseDown: (event: React.MouseEvent) => void;
  onMouseMove: (event: React.MouseEvent) => void;
  onMouseUp: (event: React.MouseEvent) => void;
}

interface MouseState {
  isDragging: boolean;
  dragType: 'none' | 'create' | 'move' | 'resize-left' | 'resize-right' | 'playhead';
  dragStartX: number;
  dragStartTime: number;
  dragCutId?: string;
  tempCut?: { start: number; end: number };
}

export function useTimelineMouse(containerRef: React.RefObject<HTMLElement | null>): TimelineMouseHandlers {
  const mouseState = useRef<MouseState>({
    isDragging: false,
    dragType: 'none',
    dragStartX: 0,
    dragStartTime: 0,
  });

  const {
    duration,
    currentTime,
    cuts,
    selectedCutId,
    pixelsPerSecond,
    scrollLeft,
    snapToBeats,
    beats,
    setTime,
    addCut,
    updateCut,
    selectCut,
  } = usePlayerStore();

  const getTimeFromX = useCallback((x: number): number => {
    return constrainTime((x + scrollLeft) / pixelsPerSecond, duration);
  }, [scrollLeft, pixelsPerSecond, duration]);

  const getSnapTime = useCallback((time: number): number => {
    if (snapToBeats) {
      return snapTime(time, beats, pixelsPerSecond);
    }
    return time;
  }, [snapToBeats, beats, pixelsPerSecond]);

  const detectHitTarget = useCallback((x: number, y: number): { type: string; cutId?: string } => {
    const time = getTimeFromX(x);
    
    // Check if over cuts area (y between 40-80)
    if (y >= 40 && y <= 80) {
      for (const cut of cuts) {
        const startX = cut.start * pixelsPerSecond - scrollLeft;
        const endX = cut.end * pixelsPerSecond - scrollLeft;
        
        if (x >= startX && x <= endX) {
          // Check resize handles
          if (x <= startX + 8) {
            return { type: 'resize-left', cutId: cut.id };
          }
          if (x >= endX - 8) {
            return { type: 'resize-right', cutId: cut.id };
          }
          // Move handle
          return { type: 'move', cutId: cut.id };
        }
      }
      // Empty area in cuts lane - create new cut
      return { type: 'create' };
    }
    
    // Default to playhead seek
    return { type: 'playhead' };
  }, [cuts, pixelsPerSecond, scrollLeft, getTimeFromX]);

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const time = getTimeFromX(x);
    
    const hitTarget = detectHitTarget(x, y);
    
    mouseState.current = {
      isDragging: true,
      dragType: hitTarget.type as any,
      dragStartX: x,
      dragStartTime: time,
      dragCutId: hitTarget.cutId,
    };

    switch (hitTarget.type) {
      case 'playhead':
        setTime(getSnapTime(time));
        break;
      
      case 'move':
        if (hitTarget.cutId) {
          selectCut(hitTarget.cutId);
        }
        break;
      
      case 'create':
        // Start creating a temporary cut
        mouseState.current.tempCut = { start: time, end: time };
        break;
      
      case 'resize-left':
      case 'resize-right':
        if (hitTarget.cutId) {
          selectCut(hitTarget.cutId);
        }
        break;
    }
    
    event.preventDefault();
  }, [containerRef, getTimeFromX, getSnapTime, detectHitTarget, setTime, selectCut]);

  const onMouseMove = useCallback((event: React.MouseEvent) => {
    if (!mouseState.current.isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const time = getTimeFromX(x);
    const snappedTime = getSnapTime(time);
    
    switch (mouseState.current.dragType) {
      case 'playhead':
        setTime(snappedTime);
        break;
      
      case 'create':
        if (mouseState.current.tempCut) {
          const start = Math.min(mouseState.current.dragStartTime, time);
          const end = Math.max(mouseState.current.dragStartTime, time);
          mouseState.current.tempCut = { start, end };
          // TODO: Draw temporary cut preview
        }
        break;
      
      case 'move':
        if (mouseState.current.dragCutId) {
          const cut = cuts.find(c => c.id === mouseState.current.dragCutId);
          if (cut) {
            const deltaTime = snappedTime - mouseState.current.dragStartTime;
            const newStart = constrainTime(cut.start + deltaTime, duration);
            const newEnd = constrainTime(cut.end + deltaTime, duration);
            
            // Ensure cut doesn't go beyond duration
            const cutLength = cut.end - cut.start;
            const constrainedStart = Math.min(newStart, duration - cutLength);
            const constrainedEnd = constrainedStart + cutLength;
            
            updateCut(mouseState.current.dragCutId, {
              start: constrainedStart,
              end: constrainedEnd,
            });
          }
        }
        break;
      
      case 'resize-left':
        if (mouseState.current.dragCutId) {
          const cut = cuts.find(c => c.id === mouseState.current.dragCutId);
          if (cut) {
            const { start, end } = preventZeroLengthCuts(snappedTime, cut.end);
            updateCut(mouseState.current.dragCutId, { start: constrainTime(start, duration) });
          }
        }
        break;
      
      case 'resize-right':
        if (mouseState.current.dragCutId) {
          const cut = cuts.find(c => c.id === mouseState.current.dragCutId);
          if (cut) {
            const { start, end } = preventZeroLengthCuts(cut.start, snappedTime);
            updateCut(mouseState.current.dragCutId, { end: constrainTime(end, duration) });
          }
        }
        break;
    }
  }, [
    containerRef,
    getTimeFromX,
    getSnapTime,
    cuts,
    duration,
    setTime,
    updateCut,
  ]);

  const onMouseUp = useCallback((event: React.MouseEvent) => {
    if (!mouseState.current.isDragging) return;
    
    // Finalize temp cut creation
    if (mouseState.current.dragType === 'create' && mouseState.current.tempCut) {
      const { start, end } = preventZeroLengthCuts(
        mouseState.current.tempCut.start,
        mouseState.current.tempCut.end
      );
      
      if (Math.abs(end - start) > 0.1) { // Only create if meaningful duration
        addCut(start, end, ''); // TODO: Get source from current loaded video
      }
    }
    
    // Reset mouse state
    mouseState.current = {
      isDragging: false,
      dragType: 'none',
      dragStartX: 0,
      dragStartTime: 0,
      tempCut: undefined,
    };
  }, [addCut]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
}