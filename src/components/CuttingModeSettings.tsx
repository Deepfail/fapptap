import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Slider } from "./ui/slider";
import { Info, Music, Zap, Timer, Shuffle, Brain } from "lucide-react";

type CuttingMode =
  | "slow"
  | "medium"
  | "fast"
  | "ultra_fast"
  | "random"
  | "auto";

interface CuttingModeConfig {
  name: string;
  description: string;
  icon: React.ElementType;
  minDuration: number;
  multiplier: number | string;
  color: string;
}

const CUTTING_MODES: Record<CuttingMode, CuttingModeConfig> = {
  slow: {
    name: "Slow",
    description:
      "Cinematic cuts, 4-8 beats per cut. Perfect for emotional or atmospheric content.",
    icon: Timer,
    minDuration: 0.6,
    multiplier: 2.0,
    color: "text-blue-400",
  },
  medium: {
    name: "Medium",
    description:
      "Balanced cutting, 2-4 beats per cut. Good general-purpose editing pace.",
    icon: Music,
    minDuration: 0.4,
    multiplier: 1.0,
    color: "text-green-400",
  },
  fast: {
    name: "Fast",
    description:
      "Quick cuts, 1-2 beats per cut. Great for energetic music and action.",
    icon: Zap,
    minDuration: 0.25,
    multiplier: 0.5,
    color: "text-yellow-400",
  },
  ultra_fast: {
    name: "Ultra Fast",
    description:
      "Rapid-fire cuts, every beat/sub-beat. Creates intense, hyperactive editing.",
    icon: Zap,
    minDuration: 0.15,
    multiplier: 0.25,
    color: "text-red-400",
  },
  random: {
    name: "Random",
    description:
      "Unpredictable mix of cut lengths. Weighted toward musical beats with variation.",
    icon: Shuffle,
    minDuration: 0.3,
    multiplier: "random",
    color: "text-purple-400",
  },
  auto: {
    name: "Auto/AI",
    description:
      "Intelligent cutting based on music energy, tempo changes, and audio analysis.",
    icon: Brain,
    minDuration: 0.4,
    multiplier: "ai",
    color: "text-cyan-400",
  },
};

export const CuttingModeSettings = () => {
  const [selectedMode, setSelectedMode] = useState<CuttingMode>("medium");
  const [customMinDuration, setCustomMinDuration] = useState<number>(
    CUTTING_MODES[selectedMode].minDuration
  );
  const [useCustomMinDuration, setUseCustomMinDuration] = useState(false);
  const [estimatedBPM, setEstimatedBPM] = useState(120);
  const [randomSeed, setRandomSeed] = useState<number | null>(null);
  const [autoEnergyThreshold, setAutoEnergyThreshold] = useState(0.7);

  const selectedConfig = CUTTING_MODES[selectedMode];

  // Calculate estimated cut duration based on BPM and mode
  const calculateCutDuration = (mode: CuttingMode, bpm: number) => {
    const beatInterval = 60 / bpm; // seconds per beat

    switch (mode) {
      case "slow":
        return { min: beatInterval * 4, max: beatInterval * 8 };
      case "medium":
        return { min: beatInterval * 2, max: beatInterval * 4 };
      case "fast":
        return { min: beatInterval * 1, max: beatInterval * 2 };
      case "ultra_fast":
        return { min: beatInterval * 0.25, max: beatInterval * 1 };
      case "random":
        return { min: beatInterval * 0.5, max: beatInterval * 8 };
      case "auto":
        return { min: beatInterval * 0.5, max: beatInterval * 6 };
      default:
        return { min: beatInterval, max: beatInterval * 2 };
    }
  };

  const estimatedDuration = calculateCutDuration(selectedMode, estimatedBPM);
  const effectiveMinDuration = useCustomMinDuration
    ? customMinDuration
    : selectedConfig.minDuration;

  return (
    <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Music className="h-5 w-5" />
          Cutting Mode Settings
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Configure how cuts are timed to the music
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Selection */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Cutting Mode</Label>

          <div className="grid grid-cols-1 gap-2">
            {Object.entries(CUTTING_MODES).map(([mode, config]) => {
              const IconComponent = config.icon;
              const isSelected = selectedMode === mode;

              return (
                <div
                  key={mode}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-slate-600 hover:border-slate-500"
                  }`}
                  onClick={() => {
                    setSelectedMode(mode as CuttingMode);
                    if (!useCustomMinDuration) {
                      setCustomMinDuration(config.minDuration);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className={`h-4 w-4 ${config.color}`} />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{config.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {config.description}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Timing Settings */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Timing Settings</Label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Estimated BPM</Label>
              <Input
                type="number"
                value={estimatedBPM}
                onChange={(e) =>
                  setEstimatedBPM(parseInt(e.target.value) || 120)
                }
                className="h-8"
                min="60"
                max="200"
                placeholder="120"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">
                Min Duration ({useCustomMinDuration ? "Custom" : "Auto"})
              </Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={customMinDuration}
                  onChange={(e) =>
                    setCustomMinDuration(parseFloat(e.target.value) || 0.15)
                  }
                  className="h-8 flex-1"
                  min="0.05"
                  max="2.0"
                  step="0.05"
                  disabled={!useCustomMinDuration}
                />
                <Button
                  size="sm"
                  variant={useCustomMinDuration ? "default" : "outline"}
                  onClick={() => setUseCustomMinDuration(!useCustomMinDuration)}
                  className="h-8 px-2"
                >
                  {useCustomMinDuration ? "🔒" : "🔓"}
                </Button>
              </div>
            </div>
          </div>

          {/* Cut Duration Preview */}
          <div className="p-3 bg-slate-900/50 rounded border">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Estimated Cut Duration
            </h4>
            <div className="text-xs space-y-1">
              <div>
                Range: {estimatedDuration.min.toFixed(2)}s -{" "}
                {estimatedDuration.max.toFixed(2)}s
              </div>
              <div>Effective minimum: {effectiveMinDuration.toFixed(2)}s</div>
              <div className="text-muted-foreground">
                @ {estimatedBPM} BPM with {selectedConfig.name} mode
              </div>
            </div>
          </div>
        </div>

        {/* Mode-Specific Settings */}
        {selectedMode === "random" && (
          <>
            <Separator />
            <div className="space-y-4">
              <Label className="text-sm font-semibold">
                Random Mode Settings
              </Label>

              <div className="space-y-2">
                <Label className="text-xs">
                  Random Seed (for reproducible results)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={randomSeed || ""}
                    onChange={(e) =>
                      setRandomSeed(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="h-8 flex-1"
                    placeholder="Leave empty for random"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setRandomSeed(Math.floor(Math.random() * 10000))
                    }
                    className="h-8"
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-slate-900/50 p-2 rounded">
                <strong>Random Mode:</strong> Uses weighted randomness favoring
                2-4 beat cuts, with pattern avoidance to prevent repetitive
                cutting.
              </div>
            </div>
          </>
        )}

        {selectedMode === "auto" && (
          <>
            <Separator />
            <div className="space-y-4">
              <Label className="text-sm font-semibold">
                Auto/AI Mode Settings
              </Label>

              <div className="space-y-2">
                <Label className="text-xs">
                  Energy Threshold: {autoEnergyThreshold.toFixed(1)}
                </Label>
                <Slider
                  value={[autoEnergyThreshold]}
                  onValueChange={([value]) => setAutoEnergyThreshold(value)}
                  min={0.3}
                  max={1.0}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="text-xs text-muted-foreground bg-slate-900/50 p-2 rounded space-y-1">
                <div>
                  <strong>Auto Mode Features:</strong>
                </div>
                <div>
                  • Analyzes RMS energy, spectral centroid, and zero-crossing
                  rate
                </div>
                <div>
                  • High energy + variation → Fast cuts (0.5x multiplier)
                </div>
                <div>• High energy → Medium-fast cuts (0.75x multiplier)</div>
                <div>• High variance → Energy-adaptive cutting</div>
                <div>• Low energy → Slower cuts (1.5x multiplier)</div>
                <div>• Balanced → Standard cuts (1.0x multiplier)</div>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Apply Settings */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Apply Settings</Label>

          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" className="text-xs">
              Preview on Timeline
            </Button>
            <Button size="sm" variant="default" className="text-xs">
              Apply to Cutlist
            </Button>
          </div>

          <Button size="sm" variant="outline" className="text-xs w-full">
            Save as Preset
          </Button>
        </div>

        {/* Info Footer */}
        <div className="text-xs text-muted-foreground pt-2 border-t border-slate-700">
          <div className="font-medium mb-1">How Cutting Modes Work:</div>
          <div>
            Each mode adjusts the multiplier applied to beat intervals. Minimum
            duration prevents overly short cuts that would be jarring.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
