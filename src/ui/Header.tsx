import React from "react";

export function HeaderStatus({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="text-xs text-slate-400 px-2 py-1 rounded bg-slate-800/70 border border-slate-700">
      {text}
    </div>
  );
}

export function HeaderButtons({
  onGenerate,
  onExport,
  busy,
}: {
  onGenerate?: () => void;
  onExport?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        disabled={busy}
        onClick={onGenerate}
        className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
      >
        Generate
      </button>
      <button
        disabled={busy}
        onClick={onExport}
        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
      >
        Export
      </button>
    </div>
  );
}
