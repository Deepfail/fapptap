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
  // history as snapshots (simple implementation). Each snapshot captures timeline, selection, and playhead
  const [past, setPast] = useState<Array<{ timeline: TimelineItem[]; selectedTimelineItemId: string | null; playhead: number }>>([]);
  const [future, setFuture] = useState<Array<{ timeline: TimelineItem[]; selectedTimelineItemId: string | null; playhead: number }>>([]);
  const HISTORY_CAP = 100;

  const addClipToTimeline = (clipId: string, start: number) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    const item: TimelineItem = {
      id: `${clipId}-${Date.now()}`,
      clipId,
      start,
      in: 0,
      out: clip.duration,
    };
    // push current snapshot to history before applying change
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

    setTimeline((t) => {
      const next = [...t, item];
      // auto-select the newly added item
      setSelectedTimelineItemId(item.id);
      // jump playhead to the new item's start
      setPlayhead(item.start);
      return next;
    });
  };

  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      const last = p[p.length - 1];
      const remaining = p.slice(0, p.length - 1);
      // push current state to future
      const current = { timeline: JSON.parse(JSON.stringify(timeline)), selectedTimelineItemId, playhead };
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
      const current = { timeline: JSON.parse(JSON.stringify(timeline)), selectedTimelineItemId, playhead };
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
