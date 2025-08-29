import { render, act } from "@testing-library/react";
import { test, expect } from "vitest";
import { useEffect } from "react";
import { EditorProvider, useEditor } from "./editorStore";

test("addClipToTimeline adds a timeline item and auto-selects it (DOM consumer)", async () => {
  let storeRef: any = { current: null };

  function Consumer() {
    const s = useEditor();
    // expose store to test via ref
    useEffect(() => {
      storeRef.current = s;
    }, [s]);
    return null;
  }

  await act(async () => {
    render(
      <EditorProvider
        initialClips={[
          { id: "c1", name: "Clip 1", path: "/mock/c1.mp4", duration: 10 },
        ]}
      >
        <Consumer />
      </EditorProvider>
    );
  });

  // ensure store available
  expect(storeRef.current).not.toBeNull();

  await act(async () => {
    storeRef.current.addClipToTimeline("c1", 5);
  });

  expect(storeRef.current.timeline.length).toBeGreaterThanOrEqual(1);
  const item = storeRef.current.timeline[storeRef.current.timeline.length - 1];
  expect(item.clipId).toBe("c1");
  expect(item.start).toBe(5);
  expect(storeRef.current.selectedTimelineItemId).toBe(item.id);

  await act(async () => {
    storeRef.current.selectTimelineItem(null);
  });

  expect(storeRef.current.selectedTimelineItemId).toBeNull();
});
