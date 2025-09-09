import React from "react";
import { Panel } from "@/ui/kit";

export default function PlayerPanel({
  videoRef,
  status,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  status?: string;
}) {
  return (
    <div className="h-full w-full flex flex-col gap-3">
      <Panel className="rounded-xl overflow-hidden aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          preload="metadata"
        />
      </Panel>
      <div className="text-xs muted">{status}</div>
    </div>
  );
}
