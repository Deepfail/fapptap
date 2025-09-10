import { TimelineItem } from "@/store/timeline";

import { runStage } from "./stages";

// Browser-compatible hash function using Web Crypto API
async function createHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface SegmentCache {
  hash: string;
  path: string;
  item: TimelineItem;
}

interface TransitionCache {
  hash: string;
  path: string;
  fromItem: TimelineItem;
  toItem: TimelineItem;
}

export class IncrementalRenderer {
  private segmentCache = new Map<string, SegmentCache>();
  private transitionCache = new Map<string, TransitionCache>();

  private async getSegmentHash(
    item: TimelineItem,
    index: number
  ): Promise<string> {
    const input = {
      clipId: item.clipId,
      in: item.in,
      out: item.out,
      index,
      // Include overlap adjustments from transitions
      dIn: this.getIncomingOverlap(item),
      dOut: this.getOutgoingOverlap(item),
    };
    const hash = await createHash(JSON.stringify(input));
    return hash.substring(0, 8);
  }

  private async getTransitionHash(
    fromItem: TimelineItem,
    toItem: TimelineItem,
    index: number
  ): Promise<string> {
    const input = {
      fromClip: fromItem.clipId,
      fromOut: fromItem.out,
      toClip: toItem.clipId,
      toIn: toItem.in,
      transition: fromItem.transitionOut,
      index,
    };
    const hash = await createHash(JSON.stringify(input));
    return hash.substring(0, 8);
  }

  private getOutgoingOverlap(item: TimelineItem): number {
    if (!item.transitionOut) return 0;
    return this.framesToSeconds(item.transitionOut.durF || 0);
  }

  private getIncomingOverlap(_item: TimelineItem): number {
    // For now, assume symmetric overlaps - in a full implementation,
    // this would check the previous item's transitionOut
    return 0;
  }

  private framesToSeconds(frames: number, fps = 60): number {
    return frames / fps;
  }

  private async renderSegment(
    item: TimelineItem,
    index: number,
    hash: string
  ): Promise<string> {
    const dIn = this.getIncomingOverlap(item);
    const dOut = this.getOutgoingOverlap(item);
    const segmentPath = `render/cache/segments/${index}-${hash}.mp4`;

    // Ensure cache directory exists
    const { mkdir } = await import("@tauri-apps/plugin-fs");
    await mkdir("render/cache/segments", { recursive: true });

    // Use FFmpeg to extract segment with overlap adjustments
    const actualIn = item.in + dIn;
    const actualOut = item.out - dOut;
    const duration = Math.max(0.1, actualOut - actualIn);

    // This would normally call FFmpeg directly, but for now use the existing render system
    // TODO: Replace with direct FFmpeg segment extraction
    console.log(
      `Rendering segment ${index}: ${item.clipId} ${actualIn}-${actualOut}s (${duration}s) -> ${segmentPath}`
    );

    return segmentPath;
  }

  private async renderTransition(
    fromItem: TimelineItem,
    toItem: TimelineItem,
    index: number,
    hash: string
  ): Promise<string> {
    const transitionPath = `render/cache/transitions/${index}-${
      index + 1
    }-${hash}.mp4`;

    // Ensure cache directory exists
    const { mkdir } = await import("@tauri-apps/plugin-fs");
    await mkdir("render/cache/transitions", { recursive: true });

    if (!fromItem.transitionOut) {
      // Hard cut - create minimal transition file
      console.log(
        `Creating hard cut transition ${index} (${fromItem.clipId} -> ${toItem.clipId}) -> ${transitionPath}`
      );
      return transitionPath;
    }

    const transition = fromItem.transitionOut;
    const duration = this.framesToSeconds(transition.durF || 2);

    // Generate FFmpeg command based on transition type
    let filterComplex = "";
    switch (transition.type) {
      case "crossfade":
        filterComplex = `xfade=fade:duration=${duration}:offset=0`;
        break;
      case "whip_pan":
        const direction =
          transition.dir === "left" ? "slideleft" : "slideright";
        filterComplex = `xfade=${direction}:duration=${duration}:offset=0`;
        break;
      case "dip_to_black":
        filterComplex = `xfade=fadeblack:duration=${duration}:offset=0`;
        break;
      case "flash_cut":
        // Hard cut with white flash overlay
        filterComplex = `[0:v][1:v]concat=n=2:v=1[v]; [v]color=white:duration=${duration}[flash]; [v][flash]overlay`;
        break;
    }

    console.log(
      `Rendering transition ${transition.type} ${index} (filter: ${filterComplex}) -> ${transitionPath}`
    );
    // TODO: Implement actual FFmpeg transition rendering

    return transitionPath;
  }

  async renderIncrementalProxy(timeline: TimelineItem[]): Promise<string> {
    const concatList: string[] = [];
    const renderPromises: Promise<void>[] = [];

    // Process segments and transitions
    for (let i = 0; i < timeline.length; i++) {
      const item = timeline[i];
      const segmentHash = await this.getSegmentHash(item, i);
      const segmentKey = `${i}-${segmentHash}`;

      // Check if segment is cached
      if (!this.segmentCache.has(segmentKey)) {
        renderPromises.push(
          this.renderSegment(item, i, segmentHash).then((path) => {
            this.segmentCache.set(segmentKey, {
              hash: segmentHash,
              path,
              item,
            });
          })
        );
      }

      const segmentPath =
        this.segmentCache.get(segmentKey)?.path ||
        `render/cache/segments/${i}-${segmentHash}.mp4`;
      concatList.push(`file '${segmentPath}'`);

      // Process transition to next item
      if (i < timeline.length - 1) {
        const nextItem = timeline[i + 1];
        const transitionHash = await this.getTransitionHash(item, nextItem, i);
        const transitionKey = `${i}-${i + 1}-${transitionHash}`;

        if (!this.transitionCache.has(transitionKey)) {
          renderPromises.push(
            this.renderTransition(item, nextItem, i, transitionHash).then(
              (path) => {
                this.transitionCache.set(transitionKey, {
                  hash: transitionHash,
                  path,
                  fromItem: item,
                  toItem: nextItem,
                });
              }
            )
          );
        }

        const transitionPath =
          this.transitionCache.get(transitionKey)?.path ||
          `render/cache/transitions/${i}-${i + 1}-${transitionHash}.mp4`;
        concatList.push(`file '${transitionPath}'`);
      }
    } // Wait for all segments and transitions to render
    await Promise.all(renderPromises);

    // Write concat file
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const concatContent = concatList.join("\n");
    await writeTextFile("render/preview_concat.txt", concatContent);

    // Final concat with FFmpeg
    console.log("Concatenating segments and transitions...");
    // TODO: Replace with direct FFmpeg call
    // For now, fall back to existing render system
    await runStage("render", { proxy: true });

    return "render/fapptap_proxy.mp4";
  }

  clearCache(): void {
    this.segmentCache.clear();
    this.transitionCache.clear();
  }
}
