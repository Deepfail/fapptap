import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { toMediaSrc } from "@/lib/mediaUrl";
import { onDesktopAvailable } from "@/lib/platform";
import { useMediaStore } from "@/state/mediaStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music } from "lucide-react";

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

  const {
    setClipsDir,
    setSongPath,
    songPath,
    selectedClipIds,
    toggleClipSelection,
  } = useMediaStore();

  const chooseDir = useCallback(async () => {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked === "string" && picked.length) {
      setDir(picked);
      onDirChange?.(picked);
      setClipsDir(picked);
    }
  }, [onDirChange, setClipsDir]);

  const loadAudioFile = useCallback(async () => {
    const picked = await open({
      multiple: false,
      filters: [
        {
          name: "Audio Files",
          extensions: ["mp3", "wav", "flac", "aac", "ogg", "m4a"],
        },
      ],
    });
    if (typeof picked === "string" && picked.length) {
      setSongPath(picked);
    }
  }, [setSongPath]);

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

        const allFiles = entries
          .filter((e) => !!e.name) // ignore weird entries
          .map((e) => {
            const name = e.name;
            const ext = (name.split(".").pop() || "").toLowerCase();
            // Construct full path from directory and entry name
            const path = `${dir}/${name}`;
            return { path, name, ext };
          });

        const videoFiles = allFiles
          .filter((f) => VIDEO_EXT.has(f.ext))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!cancelled) {
          setClips(videoFiles);
        }
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
      <div className="space-y-2 mb-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={chooseDir}>
            {dir ? "Change Folder" : "Choose Folder"}
          </Button>
          <div className="text-xs text-neutral-400 truncate flex-1">
            {dir || "No folder selected"}
          </div>
        </div>

        {/* Audio file selection */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadAudioFile}
            className="flex items-center gap-1"
          >
            <Music className="h-3 w-3" />
            Load Audio
          </Button>
          {songPath && (
            <Badge variant="secondary" className="text-xs">
              {songPath.split("/").pop()?.split("\\").pop() || "Audio loaded"}
            </Badge>
          )}
        </div>

        {/* Selection status */}
        {selectedClipIds.size > 0 && (
          <div className="text-xs text-green-400">
            {selectedClipIds.size} clips selected
          </div>
        )}
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
              isSelected={selectedClipIds.has(c.path)}
              onToggleSelect={() => toggleClipSelection(c.path)}
              onPreview={() => onSelectClip?.(c.path)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClipTile({
  clip,
  isSelected,
  onToggleSelect,
  onPreview,
}: {
  clip: Clip;
  isSelected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
}) {
  const [src, setSrc] = useState<string>("");
  const [tauriReadyTick, setTauriReadyTick] = useState(0);
  useEffect(() => {
    const off = onDesktopAvailable(() => setTauriReadyTick((t) => t + 1));
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
    <div
      className={`group relative rounded-md overflow-hidden bg-neutral-900 border transition-colors ${
        isSelected
          ? "border-blue-500 bg-blue-500/10"
          : "border-neutral-800 hover:border-neutral-700"
      }`}
      title={clip.name}
    >
      {/* Selection overlay */}
      <button
        onClick={onToggleSelect}
        className="absolute top-2 left-2 z-10 w-5 h-5 rounded bg-black/50 border border-white/20 flex items-center justify-center text-white text-xs hover:bg-black/70"
      >
        {isSelected ? "✓" : ""}
      </button>

      {/* Preview button */}
      <button
        onClick={onPreview}
        className="group/preview relative w-full focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        {/* Minimal preview: load metadata only; we're not playing here */}
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
    </div>
  );
}
