import React from "react";
import { SectionLabel, Chip } from "@/ui/kit";

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
        <SectionLabel>Library</SectionLabel>
        <Chip>Browse</Chip>
        <div className="space-y-1">{children}</div>
      </div>

      <div>
        <SectionLabel>Session</SectionLabel>
        <div className="text-sm">
          Videos selected:{" "}
          <span className="font-semibold">{selectionCount}</span>
        </div>
        <div className="text-sm">
          Audio:{" "}
          <span
            className={audioSet ? "text-[var(--ok)]" : "text-[var(--warn)]"}
          >
            {audioSet ? "Set" : "Missing"}
          </span>
        </div>
      </div>
    </div>
  );
}
