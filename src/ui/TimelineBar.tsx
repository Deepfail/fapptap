import { useEditorStore } from "@/store/timeline";
import { TRANSITION_LABELS } from "@/types/transitions";

export default function TimelineBar() {
  const editor = useEditorStore();
  const items = editor.timeline;
  const selected = editor.selectedId;

  if (!items?.length) {
    return (
      <div className="h-full w-full flex items-center justify-center muted text-sm">
        Timeline (analyzing audio beats…)
      </div>
    );
  }

  const handleReorder = (fromIdx: number, toIdx: number) => {
    editor.reorder(fromIdx, toIdx);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="text-xs muted mb-1">Timeline ({items.length} cuts)</div>
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {items.map((it, i) => {
            const dur = Math.max(0, Number(it.out ?? 0) - Number(it.in ?? 0));
            const isSel = it.id === selected;
            const transitionOut = it.transitionOut;

            return (
              <div
                key={it.id}
                className="relative"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({ fromIdx: i })
                  );
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const data = JSON.parse(
                    e.dataTransfer.getData("application/json")
                  );
                  handleReorder(data.fromIdx, i);
                }}
              >
                <button
                  onClick={() => editor.select(it.id)}
                  className={`min-w-[140px] text-left px-2 py-2 tl-item ${
                    isSel ? "is-selected" : ""
                  }`}
                  title={`#${i + 1}  ${it.clipId}\n${dur.toFixed(2)}s${
                    transitionOut
                      ? `\nTransition: ${
                          TRANSITION_LABELS[transitionOut.type] ||
                          transitionOut.type
                        }`
                      : ""
                  }`}
                >
                  <div className="text-xs font-medium truncate">
                    {(it.clipId || "").split(/[\\/]/).pop()}
                  </div>
                  <div className="text-[10px] muted">{dur.toFixed(2)}s</div>
                </button>

                {/* Transition badge on right edge */}
                {transitionOut && (
                  <div className="absolute -right-1 top-1 bg-brand-fuchsia text-white text-[10px] px-1 rounded text-center min-w-[20px]">
                    {transitionOut.type === "flash_cut" && "⚡"}
                    {transitionOut.type === "crossfade" && "✗"}
                    {transitionOut.type === "whip_pan" &&
                      (transitionOut.dir === "left" ? "←" : "→")}
                    {transitionOut.type === "dip_to_black" && "●"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
