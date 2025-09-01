import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { toMediaSrc } from "@/lib/mediaUrl";
import { onDesktopAvailable } from "@/lib/platform";

const VIDEO_EXT = new Set(["mp4", "mov", "mkv", "webm", "avi", "m4v"]);

type Clip = {
  path: string; // absolute path
  name: string; // file name
  ext: string; // lowercased extension
};

type LibraryPaneProps = {
  onSelectClip?: (absPath: string) => void;
  initialDir?: string;
  onDirChange?: (dir: string) => void;
};

export default function LibraryPane({
  onSelectClip,
  initialDir,
  onDirChange,
}: LibraryPaneProps) {
  const [dir, setDir] = useState<string | undefined>(initialDir);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const chooseDir = useCallback(async () => {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked === "string" && picked.length) {
      setDir(picked);
      onDirChange?.(picked);
    }
  }, [onDirChange]);

  useEffect(() => {
    if (!dir) {
      setClips([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const entries = await readDir(dir);

        const files: Clip[] = entries
          .filter((e) => !!e.name) // ignore weird entries
          .map((e) => {
            const name = e.name;
            const ext = (name.split(".").pop() || "").toLowerCase();
            // Construct full path from directory and entry name
            const path = `${dir}/${name}`;
            return { path, name, ext };
          })
          .filter((f) => VIDEO_EXT.has(f.ext))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!cancelled) setClips(files);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dir]);

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="flex items-center gap-2 mb-2">
        <button
          className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-sm"
          onClick={chooseDir}
        >
          {dir ? "Change Folder" : "Choose Folder"}
        </button>
        <div className="text-xs text-neutral-400 truncate">
          {dir || "No folder selected"}
        </div>
      </div>

      {/* content */}
      <div className="flex-1 min-h-0 rounded-lg border border-neutral-800 overflow-auto p-2 bg-neutral-950">
        {loading && (
          <div className="p-4 text-neutral-400 text-sm">Scanning…</div>
        )}
        {err && <div className="p-4 text-rose-300 text-sm">Error: {err}</div>}
        {!loading && !err && clips.length === 0 && (
          <div className="p-4 text-neutral-400 text-sm">
            No videos in this folder.
          </div>
        )}

        {/* simple grid (upgrade to virtualization later) */}
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          }}
        >
          {clips.map((c) => (
            <ClipTile
              key={c.path}
              clip={c}
              onClick={() => onSelectClip?.(c.path)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClipTile({ clip, onClick }: { clip: Clip; onClick?: () => void }) {
  const [src, setSrc] = useState<string>("");
  const [tauriReadyTick, setTauriReadyTick] = useState(0);
  useEffect(() => {
    const off = onDesktopAvailable(() => setTauriReadyTick(t => t + 1));
    return off;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resolved = await toMediaSrc(clip.path);
        if (!cancelled) setSrc(resolved);
      } catch {
        if (!cancelled) setSrc("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clip.path, tauriReadyTick]);

  return (
    <button
      onClick={onClick}
      className="group relative rounded-md overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
      title={clip.name}
    >
      {/* Minimal preview: load metadata only; we’re not playing here */}
      {src ? (
        <video
          src={src}
          preload="metadata"
          muted
          playsInline
          className="w-full aspect-video object-cover bg-black"
        />
      ) : (
        <div className="w-full aspect-video grid place-items-center text-neutral-500 text-xs">
          no preview
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 text-left text-xs px-2 py-1 bg-neutral-950/80">
        <span className="text-neutral-200 truncate block">{clip.name}</span>
      </div>
    </button>
  );
}
