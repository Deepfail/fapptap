import React from "react";

type Slot = React.ReactNode;
export default function AppShell({
  headerLeft,
  headerRight,
  sidebar,
  inspector,
  timeline,
  children,
}: {
  headerLeft?: Slot;
  headerRight?: Slot;
  sidebar?: Slot;
  inspector?: Slot;
  timeline?: Slot;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="h-14 border-b border-[var(--border)] bg-[var(--panel-2)]/80 backdrop-blur sticky top-0 z-40">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-dot" />
            <div className="font-semibold tracking-wide">FAPPTap</div>
            {headerLeft && <div className="chip">{headerLeft}</div>}
          </div>
          <div className="flex items-center gap-2">{headerRight}</div>
        </div>
      </header>

      {/* Body grid */}
      <div className="grid grid-cols-12 gap-0">
        {/* Sidebar */}
        <aside className="col-span-2 min-h-[calc(100vh-3.5rem)] p-3 sticky top-14 border-r border-[var(--border)]">
          {sidebar}
        </aside>

        {/* Main / Player */}
        <main className="col-span-7 min-h-[calc(100vh-3.5rem)] flex flex-col">
          <div className="flex-1 p-4">{children}</div>
        </main>

        {/* Inspector */}
        <aside className="col-span-3 min-h-[calc(100vh-3.5rem)] p-4 sticky top-14 border-l border-[var(--border)]">
          {inspector}
        </aside>
      </div>

      {/* Timeline */}
      <footer className="h-28 border-t border-[var(--border)] bg-[var(--panel-2)]/80 backdrop-blur">
        <div className="h-full px-4 py-2">{timeline}</div>
      </footer>
    </div>
  );
}
