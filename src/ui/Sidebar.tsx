import React from "react";
import { SectionLabel, Chip } from "@/ui/kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { StylePreset } from "@/services/styles";

export default function Sidebar({
  children,
  selectionCount = 0,
  audioSet = false,
  stylePreset = "flashy",
  onStyleChange,
  intensity = 50,
  onIntensityChange,
  aspectRatio = "landscape",
  onAspectChange,
  cuttingMode = "medium",
  onCuttingModeChange,
}: {
  children?: React.ReactNode;
  selectionCount?: number;
  audioSet?: boolean;
  stylePreset?: StylePreset;
  onStyleChange?: (style: StylePreset) => void;
  intensity?: number;
  onIntensityChange?: (intensity: number) => void;
  aspectRatio?: "landscape" | "portrait" | "square";
  onAspectChange?: (aspect: "landscape" | "portrait" | "square") => void;
  cuttingMode?: "slow" | "medium" | "fast" | "ultra_fast";
  onCuttingModeChange?: (
    mode: "slow" | "medium" | "fast" | "ultra_fast"
  ) => void;
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

      <div>
        <SectionLabel>Style</SectionLabel>
        <div className="space-y-3">
          {/* Style Preset */}
          <div>
            <Label className="text-xs text-slate-300">Preset</Label>
            <Select value={stylePreset} onValueChange={onStyleChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flashy">⚡ Flashy</SelectItem>
                <SelectItem value="smooth">✨ Smooth</SelectItem>
                <SelectItem value="punchy">💥 Punchy</SelectItem>
                <SelectItem value="whip">🌪️ Whip</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Intensity Slider */}
          <div>
            <Label className="text-xs text-slate-300">Intensity</Label>
            <div className="px-2">
              <Slider
                value={[intensity]}
                onValueChange={(values) => onIntensityChange?.(values[0])}
                max={100}
                min={0}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Subtle</span>
                <span>{intensity}%</span>
                <span>Intense</span>
              </div>
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <Label className="text-xs text-slate-300">Aspect</Label>
            <Select value={aspectRatio} onValueChange={onAspectChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landscape">🖥️ Landscape (16:9)</SelectItem>
                <SelectItem value="portrait">📱 Portrait (9:16)</SelectItem>
                <SelectItem value="square">⬜ Square (1:1)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cutting Mode */}
          <div>
            <Label className="text-xs text-slate-300">Cutting Mode</Label>
            <Select value={cuttingMode} onValueChange={onCuttingModeChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slow">🐌 Slow</SelectItem>
                <SelectItem value="medium">⚖️ Medium</SelectItem>
                <SelectItem value="fast">🚀 Fast</SelectItem>
                <SelectItem value="ultra_fast">⚡ Ultra</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
