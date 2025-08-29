import { useEffect, useState } from "react";

type DragPayload = {
  id: string;
  name?: string;
  thumbnail?: string;
};

export const DragGhost = () => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [payload, setPayload] = useState<DragPayload | null>(null);

  useEffect(() => {
    const onStart = (e: Event) => {
      const detail = (e as CustomEvent).detail as DragPayload;
      setPayload(detail);
      setVisible(true);
    };
    const onMove = (e: Event) => {
      const d = (e as CustomEvent).detail as { x: number; y: number };
      setPos({ x: d.x, y: d.y });
    };
    const onEnd = () => {
      setVisible(false);
      setPayload(null);
    };

    window.addEventListener("fapptap-drag-start", onStart as EventListener);
    window.addEventListener("fapptap-drag-move", onMove as EventListener);
    window.addEventListener("fapptap-drag-end", onEnd as EventListener);

    return () => {
      window.removeEventListener(
        "fapptap-drag-start",
        onStart as EventListener
      );
      window.removeEventListener("fapptap-drag-move", onMove as EventListener);
      window.removeEventListener("fapptap-drag-end", onEnd as EventListener);
    };
  }, []);

  if (!visible || !payload) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x + 12,
        top: pos.y + 12,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      <div className="flex items-center gap-2 bg-slate-800/90 text-white px-3 py-2 rounded shadow-lg">
        {payload.thumbnail ? (
          <img
            src={payload.thumbnail}
            className="w-12 h-8 object-cover rounded"
            alt={payload.name}
          />
        ) : null}
        <div className="text-sm">{payload.name || payload.id}</div>
      </div>
    </div>
  );
};
