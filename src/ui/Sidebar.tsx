import React from "react";

export default function Sidebar({
  children,
  selectionCount = 0,
  audioSet = false,
}: {
  children?: React.ReactNode;
  selectionCount?: number;
  audioSet?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs uppercase text-slate-400 mb-2">Library</div>
        <div className="space-y-1">{children}</div>
      </div>

      <div>
        <div className="text-xs uppercase text-slate-400 mb-2">Session</div>
        <div className="text-sm text-slate-300">
          Videos selected: <span className="font-semibold">{selectionCount}</span>
        </div>
        <div className="text-sm text-slate-300">
          Audio: <span className={audioSet ? "text-emerald-400" : "text-amber-400"}>{audioSet ? "Set" : "Missing"}</span>
        </div>
      </div>
    </div>
  );
}
