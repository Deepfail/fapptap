import React from "react";
import { useEditor } from "@/state/editorStore";

export default function TimelineBar() {
  const editor = useEditor();
  const items = editor.timeline;
  const selected = editor.selectedTimelineItemId;

  if (!items?.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
        Timeline (analyzing audio beats…)
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-xs text-slate-400 mb-1">Timeline ({items.length} cuts)</div>
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {items.map((it, i) => {
            const dur = Math.max(0, Number(it.out ?? 0) - Number(it.in ?? 0));
            const isSel = it.id === selected;
            const enabledEffects = (it.effects || []).filter((e) => e.enabled !== false);
            return (
              <button
                key={it.id}
                onClick={() => editor.selectTimelineItem(it.id)}
                className={[
                  "min-w-[140px] text-left rounded-lg border px-2 py-2 bg-slate-800/60",
                  isSel ? "border-purple-500 ring-2 ring-purple-500/30" : "border-slate-700",
                ].join(" ")}
                title={`#${i + 1}  ${it.clipId}\n${dur.toFixed(2)}s\n${enabledEffects.map((e) => e.id).join(", ")}`}
              >
                <div className="text-xs font-medium truncate">{(it.clipId || "").split(/[\\/]/).pop()}</div>
                <div className="text-[10px] text-slate-400">{dur.toFixed(2)}s</div>
                {!!enabledEffects.length && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {enabledEffects.slice(0, 3).map((e, idx) => (
                      <span key={idx} className="text-[10px] bg-purple-600/90 px-1 rounded">
                        {String(e.id).split(":")[0]}
                      </span>
                    ))}
                    {enabledEffects.length > 3 && (
                      <span className="text-[10px] text-slate-400">+{enabledEffects.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
