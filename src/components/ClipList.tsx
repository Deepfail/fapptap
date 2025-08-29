import { useEffect, useState } from "react";
import { ClipItem } from "./ClipItem";
import { useEditor, ClipInfo } from "../state/editorStore";

export const ClipList = () => {
  const { clips, addClipToTimeline } = useEditor();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load mock clips from public for browser dev if editor has no clips
    const load = async () => {
      if (clips.length === 0) {
        setLoading(true);
        try {
          const res = await fetch("/mock/clips.json");
          if (res.ok) {
            const data: ClipInfo[] = await res.json();
            // setClips is not exported from store in this minimal version; we rely on window mock
            (window as any).__MOCK_CLIPS = data;
          }
        } catch (e) {
          console.warn("Failed to load mock clips", e);
        }
        setLoading(false);
      }
    };
    load();
  }, []);

  const items = clips.length > 0 ? clips : (window as any).__MOCK_CLIPS || [];

  return (
    <div className="space-y-2 p-2">
      <h4 className="text-sm font-semibold">Clip Library</h4>
      {loading && (
        <div className="text-xs text-muted-foreground">Loading...</div>
      )}
      <div className="space-y-1">
        {items.map((c: ClipInfo) => (
          <ClipItem
            key={c.id}
            clip={c}
            onAdd={(id) => addClipToTimeline(id, 0)}
          />
        ))}
      </div>
    </div>
  );
};
