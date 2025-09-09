import React from "react";

export default function PlayerPanel({
  videoRef,
  status,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  status?: string;
}) {
  return (
    <div className="h-full w-full flex flex-col gap-3">
      <div className="rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video">
        <video ref={videoRef} className="w-full h-full" controls preload="metadata" />
      </div>
      <div className="text-xs text-slate-400">{status}</div>
    </div>
  );
}
