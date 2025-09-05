import { useMediaStore } from "@/state/mediaStore";

// Cut Settings Panel Component
export function CutSettingsPanel() {
  const { prefs, updatePrefs } = useMediaStore();

  return (
    <div className="h-20 bg-slate-800/40 backdrop-blur-sm border-t border-slate-700/30 p-3">
      <div className="text-xs text-slate-400 mb-2 font-medium">
        🎬 Cut Settings
      </div>
      <div className="flex items-center gap-6 h-12">
        {/* Min/Max Clip Length */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">
              Min Length:
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={prefs.minClipLength}
              onChange={(e) =>
                updatePrefs({
                  minClipLength: Math.max(
                    0.1,
                    parseFloat(e.target.value) || 0.1
                  ),
                })
              }
              className="w-16 bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-slate-300 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50"
            />
            <span className="text-xs text-slate-500">s</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">
              Max Length:
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="30"
              value={prefs.maxClipLength}
              onChange={(e) =>
                updatePrefs({
                  maxClipLength: Math.max(1, parseFloat(e.target.value) || 8),
                })
              }
              className="w-16 bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-slate-300 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50"
            />
            <span className="text-xs text-slate-500">s</span>
          </div>
        </div>

        {/* Crossfade Duration */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 whitespace-nowrap">
            Crossfade:
          </label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={prefs.crossfadeDuration}
            onChange={(e) =>
              updatePrefs({
                crossfadeDuration: Math.max(0, parseFloat(e.target.value) || 0),
              })
            }
            className="w-16 bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-slate-300 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50"
          />
          <span className="text-xs text-slate-500">s</span>
        </div>

        {/* Energy Threshold */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 whitespace-nowrap">
            Energy:
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={prefs.energyThreshold}
            onChange={(e) =>
              updatePrefs({
                energyThreshold: parseFloat(e.target.value),
              })
            }
            className="w-20 accent-fuchsia-500"
          />
          <span className="text-xs text-fuchsia-400 w-8">
            {(prefs.energyThreshold * 100).toFixed(0)}%
          </span>
        </div>

        {/* Min Beats */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 whitespace-nowrap">
            Min Beats:
          </label>
          <input
            type="number"
            step="1"
            min="1"
            max="16"
            value={prefs.minBeats}
            onChange={(e) =>
              updatePrefs({
                minBeats: Math.max(1, parseInt(e.target.value) || 1),
              })
            }
            className="w-16 bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-slate-300 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50"
          />
        </div>

        {/* Boolean Settings */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.preferDownbeats}
              onChange={(e) =>
                updatePrefs({ preferDownbeats: e.target.checked })
              }
              className="accent-fuchsia-500"
            />
            <span className="text-xs text-slate-400">Prefer Downbeats</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.respectShotBoundaries}
              onChange={(e) =>
                updatePrefs({ respectShotBoundaries: e.target.checked })
              }
              className="accent-fuchsia-500"
            />
            <span className="text-xs text-slate-400">Respect Shots</span>
          </label>
        </div>
      </div>
    </div>
  );
}
