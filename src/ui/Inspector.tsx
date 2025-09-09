import React from "react";

export default function Inspector({
  children,
  title = "Inspector",
}: {
  children?: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs uppercase text-slate-400">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
