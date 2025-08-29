import { render, act } from "@testing-library/react";
import { test, expect } from "vitest";
import { useEffect } from "react";
import { EditorProvider, useEditor } from "./editorStore";

test("undo/redo should revert and reapply addClipToTimeline", async () => {
  let storeRef: any = { current: null };

  function Consumer() {
    const s = useEditor();
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

  // Add a clip
  await act(async () => {
    storeRef.current.addClipToTimeline("c1", 2);
  });

  expect(storeRef.current.timeline.length).toBe(1);

  // Undo should remove the added item
  await act(async () => {
    storeRef.current.undo();
  });

  expect(storeRef.current.timeline.length).toBe(0);

  // Redo should reapply
  await act(async () => {
    storeRef.current.redo();
  });

  expect(storeRef.current.timeline.length).toBe(1);
});
