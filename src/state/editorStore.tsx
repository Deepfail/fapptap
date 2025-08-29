import React, { createContext, useContext, useState, ReactNode } from "react";

export interface ClipInfo {
  id: string;
  name: string;
  path: string;
  duration: number;
  thumbnail?: string;
}

export interface TimelineItem {
  id: string;
  clipId: string;
  start: number; // seconds on timeline
  in: number; // seconds into clip
  out: number; // seconds into clip
}

export interface EditorState {
  clips: ClipInfo[];
  timeline: TimelineItem[];
  addClipToTimeline: (clipId: string, start: number) => void;
  selectedTimelineItemId?: string | null;
  selectTimelineItem: (id: string | null) => void;
  // Undo/redo API
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  pixelsPerSecond: number;
  setPixelsPerSecond: (n: number) => void;
  playhead: number; // seconds
  setPlayhead: (s: number) => void;
  // New trimming and ripple functionality
  trimTimelineItem: (id: string, newIn: number, newOut: number) => void;
  moveTimelineItem: (id: string, newStart: number) => void;
  deleteTimelineItem: (id: string) => void;
  rippleMode: boolean;
  setRippleMode: (enabled: boolean) => void;
}

const EditorContext = createContext<EditorState | null>(null);

export const EditorProvider = ({
  children,
  initialClips,
}: {
  children: ReactNode;
  initialClips?: ClipInfo[];
}) => {
  const [clips, setClips] = useState<ClipInfo[]>(initialClips || []);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [selectedTimelineItemId, setSelectedTimelineItemId] = useState<
    string | null
  >(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(50);
  const [playhead, setPlayhead] = useState<number>(0);
  const [rippleMode, setRippleMode] = useState<boolean>(false);
  // history as snapshots (simple implementation). Each snapshot captures timeline, selection, and playhead
  const [past, setPast] = useState<
    Array<{
      timeline: TimelineItem[];
      selectedTimelineItemId: string | null;
      playhead: number;
    }>
  >([]);
  const [future, setFuture] = useState<
    Array<{
      timeline: TimelineItem[];
      selectedTimelineItemId: string | null;
      playhead: number;
    }>
  >([]);
  const HISTORY_CAP = 100;

  const saveSnapshot = () => {
    const snapshot = {
      timeline: JSON.parse(JSON.stringify(timeline)),
      selectedTimelineItemId,
      playhead,
    };
    setPast((p) => {
      const next = [...p, snapshot].slice(-HISTORY_CAP);
      return next;
    });
    // clear future on new action
    setFuture([]);
  };

  const addClipToTimeline = (clipId: string, start: number) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    
    saveSnapshot();
    
    const item: TimelineItem = {
      id: `${clipId}-${Date.now()}`,
      clipId,
      start,
      in: 0,
      out: clip.duration,
    };

    setTimeline((t) => {
      const next = [...t, item];
      // auto-select the newly added item
      setSelectedTimelineItemId(item.id);
      // jump playhead to the new item's start
      setPlayhead(item.start);
      return next;
    });
  };

  const trimTimelineItem = (id: string, newIn: number, newOut: number) => {
    saveSnapshot();
    
    setTimeline((t) => 
      t.map(item => 
        item.id === id 
          ? { ...item, in: Math.max(0, newIn), out: Math.max(newIn + 0.1, newOut) }
          : item
      )
    );
  };

  const moveTimelineItem = (id: string, newStart: number) => {
    saveSnapshot();
    
    const item = timeline.find(t => t.id === id);
    if (!item) return;
    
    const adjustedStart = Math.max(0, newStart);
    
    if (rippleMode) {
      // In ripple mode, move all items that come after this one
      const originalStart = item.start;
      const delta = adjustedStart - originalStart;
      
      setTimeline((t) => 
        t.map(timelineItem => {
          if (timelineItem.id === id) {
            return { ...timelineItem, start: adjustedStart };
          } else if (timelineItem.start > originalStart) {
            return { ...timelineItem, start: Math.max(0, timelineItem.start + delta) };
          }
          return timelineItem;
        })
      );
    } else {
      setTimeline((t) => 
        t.map(timelineItem => 
          timelineItem.id === id 
            ? { ...timelineItem, start: adjustedStart }
            : timelineItem
        )
      );
    }
  };

  const deleteTimelineItem = (id: string) => {
    saveSnapshot();
    
    const item = timeline.find(t => t.id === id);
    if (!item) return;
    
    if (rippleMode) {
      // In ripple mode, move all items after this one to fill the gap
      const itemDuration = item.out - item.in;
      
      setTimeline((t) => 
        t.filter(timelineItem => timelineItem.id !== id)
         .map(timelineItem => 
           timelineItem.start > item.start 
             ? { ...timelineItem, start: Math.max(0, timelineItem.start - itemDuration) }
             : timelineItem
         )
      );
    } else {
      setTimeline((t) => t.filter(timelineItem => timelineItem.id !== id));
    }
    
    // Clear selection if deleted item was selected
    if (selectedTimelineItemId === id) {
      setSelectedTimelineItemId(null);
    }
  };

  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      const last = p[p.length - 1];
      const remaining = p.slice(0, p.length - 1);
      // push current state to future
      const current = {
        timeline: JSON.parse(JSON.stringify(timeline)),
        selectedTimelineItemId,
        playhead,
      };
      setFuture((f) => [current, ...f].slice(0, HISTORY_CAP));
      // restore
      setTimeline(last.timeline);
      setSelectedTimelineItemId(last.selectedTimelineItemId);
      setPlayhead(last.playhead);
      return remaining;
    });
  };

  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const nextSnapshot = f[0];
      const remaining = f.slice(1);
      // push current to past
      const current = {
        timeline: JSON.parse(JSON.stringify(timeline)),
        selectedTimelineItemId,
        playhead,
      };
      setPast((p) => [...p, current].slice(-HISTORY_CAP));
      // restore
      setTimeline(nextSnapshot.timeline);
      setSelectedTimelineItemId(nextSnapshot.selectedTimelineItemId);
      setPlayhead(nextSnapshot.playhead);
      return remaining;
    });
  };

  const selectTimelineItem = (id: string | null) => {
    setSelectedTimelineItemId(id);
  };

  const setPlayheadWrapper = (s: number) => {
    setPlayhead(s);
  };

  // Load mock clips in browser dev from public/mock/clips.json
  React.useEffect(() => {
    if (clips.length === 0) {
      (async () => {
        try {
          const res = await fetch("/mock/clips.json");
          if (res.ok) {
            const data: ClipInfo[] = await res.json();
            setClips(data);
          }
        } catch (e) {
          // ignore
        }
      })();
    }
  }, []);

  return (
    <EditorContext.Provider
      value={{
        clips,
        timeline,
        addClipToTimeline,
        undo,
        redo,
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        selectedTimelineItemId,
        selectTimelineItem,
        pixelsPerSecond,
        setPixelsPerSecond,
        playhead,
        setPlayhead: setPlayheadWrapper,
        trimTimelineItem,
        moveTimelineItem,
        deleteTimelineItem,
        rippleMode,
        setRippleMode,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const s = useContext(EditorContext);
  if (!s) throw new Error("useEditor must be used within EditorProvider");
  return s;
};
