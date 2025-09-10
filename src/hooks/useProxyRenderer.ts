import { useCallback, useRef } from "react";
import { useEditorStore } from "@/store/timeline";
import { itemsToCutlist } from "@/adapters/cutlist";
import { runStage } from "@/services/stages";
import { IncrementalRenderer } from "@/services/incrementalRenderer";

export function useProxyRenderer() {
  const editor = useEditorStore();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const rendererRef = useRef<IncrementalRenderer>(new IncrementalRenderer());

  const writeCanonicalCutlist = async () => {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const cutlist = itemsToCutlist(editor.timeline, {
      fps: 60,
      width: 1920,
      height: 1080,
      audio: "", // TODO: get from session
    });

    await writeTextFile(
      "render/cutlist.json",
      JSON.stringify(cutlist, null, 2)
    );
  };

  const renderProxyAndReload = async (useIncremental = true) => {
    try {
      let proxyPath: string;

      if (useIncremental && editor.timeline.length > 0) {
        // Use incremental rendering for faster updates
        proxyPath = await rendererRef.current.renderIncrementalProxy(
          editor.timeline
        );
      } else {
        // Fall back to full render
        await runStage("render", { proxy: true });
        proxyPath = "render/fapptap_proxy.mp4";
      }

      // Reload player with cache buster
      const timestamp = Date.now();
      const proxyUrl = `${proxyPath}?t=${timestamp}`;

      // Dispatch custom event for player to reload
      window.dispatchEvent(
        new CustomEvent("proxy-updated", { detail: { url: proxyUrl } })
      );
    } catch (error) {
      console.error(
        "Incremental render failed, falling back to full render:",
        error
      );
      // Fallback to standard render
      await runStage("render", { proxy: true });
      const timestamp = Date.now();
      const proxyUrl = `render/fapptap_proxy.mp4?t=${timestamp}`;
      window.dispatchEvent(
        new CustomEvent("proxy-updated", { detail: { url: proxyUrl } })
      );
    }
  };

  const debouncedProxyRender = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        await writeCanonicalCutlist();
        await renderProxyAndReload(true); // Use incremental rendering
      } catch (error) {
        console.error("Proxy render failed:", error);
      }
    }, 650);
  }, [editor.timeline]);

  const clearRenderCache = useCallback(() => {
    rendererRef.current.clearCache();
  }, []);

  return { debouncedProxyRender, writeCanonicalCutlist, clearRenderCache };
}
