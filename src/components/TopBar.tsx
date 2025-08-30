import { Sparkles, Volume2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { useMediaStore } from "../state/mediaStore";
import { isTauriAvailable } from "../lib/worker";

export function TopBar() {
  const songPath = useMediaStore(state => state.songPath);
  const jobs = useMediaStore(state => state.jobs);
  const runningJobs = jobs.filter(job => job.status === 'running');
  
  const getStatusBadge = () => {
    if (runningJobs.length > 0) {
      return `Running (${runningJobs.length})`;
    }
    return "Idle";
  };

  const getSongName = () => {
    if (!songPath) return "No song selected";
    const name = songPath.split('/').pop() || songPath;
    return name.length > 30 ? `${name.substring(0, 30)}...` : name;
  };

  return (
    <header className="h-14 border-b border-slate-700 bg-slate-800/90 backdrop-blur-sm flex items-center justify-between px-6">
      {/* Left: App branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-blue-500" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            AutoEdit
          </h1>
        </div>
        <span className="text-sm text-slate-400 hidden md:block">
          Media-First Video Editor
        </span>
      </div>

      {/* Center: Audio track picker */}
      <div className="flex items-center gap-3 max-w-md">
        <Volume2 className="h-4 w-4 text-slate-400" />
        <div className="text-sm text-slate-300 truncate">
          {getSongName()}
        </div>
      </div>

      {/* Right: Status and mode */}
      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="px-3 py-1">
          {getStatusBadge()}
        </Badge>
        <span className="text-xs text-slate-400">
          {isTauriAvailable() ? "Desktop" : "Browser"}
        </span>
      </div>
    </header>
  );
}