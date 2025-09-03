import { useState } from 'react';
import { useEditor } from '../state/editorStore';
import type { SpeedRamp, SpeedKeyframe } from '../state/editorStore';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';

export const SpeedRampEditor = () => {
  const { 
    selectedTimelineItemId, 
    timeline, 
    updateTimelineItemEffects, 
    getTimelineItemEffects 
  } = useEditor();
  
  const [selectedKeyframe, setSelectedKeyframe] = useState<number | null>(null);
  
  // Mock beat data - in real app this would come from beat analysis
  const mockBeats = Array.from({length: 50}, (_, i) => i * 2);
  
  const selectedItem = timeline.find(item => item.id === selectedTimelineItemId);
  const itemEffects = selectedItem ? getTimelineItemEffects(selectedItem.id) : [];
  const speedEffect = itemEffects.find(e => e.type === 'speed') as any;
  const speedRamp: SpeedRamp = speedEffect?.speedRamp || {
    id: 'default',
    keyframes: [
      { time: 0, speed: 1 },
      { time: 1, speed: 1 }
    ],
    enabled: true
  };

  const updateSpeedRamp = (newRamp: SpeedRamp) => {
    if (!selectedItem) return;
    
    const currentEffects = getTimelineItemEffects(selectedItem.id);
    const speedIndex = currentEffects.findIndex(e => e.type === 'speed');
    
    let updatedEffects;
    if (speedIndex >= 0) {
      updatedEffects = [...currentEffects];
      updatedEffects[speedIndex] = {
        ...updatedEffects[speedIndex],
        speedRamp: newRamp
      };
    } else {
      const newEffect = {
        id: `speed-${Date.now()}`,
        type: 'speed' as const,
        enabled: true,
        speedRamp: newRamp
      };
      updatedEffects = [...currentEffects, newEffect];
    }
    
    updateTimelineItemEffects(selectedItem.id, updatedEffects);
  };

  const addKeyframe = (time: number, speed: number = 1) => {
    const newKeyframes = [...speedRamp.keyframes, { time, speed }]
      .sort((a, b) => a.time - b.time);
    
    updateSpeedRamp({
      ...speedRamp,
      keyframes: newKeyframes
    });
  };

  const updateKeyframe = (index: number, updates: Partial<SpeedKeyframe>) => {
    const newKeyframes = speedRamp.keyframes.map((kf, i) => 
      i === index ? { ...kf, ...updates } : kf
    );
    
    updateSpeedRamp({
      ...speedRamp,
      keyframes: newKeyframes
    });
  };

  const removeKeyframe = (index: number) => {
    if (speedRamp.keyframes.length <= 2) return; // Keep at least 2 keyframes
    
    const newKeyframes = speedRamp.keyframes.filter((_, i) => i !== index);
    updateSpeedRamp({
      ...speedRamp,
      keyframes: newKeyframes
    });
  };

  const snapToNearestBeat = (clipTime: number) => {
    if (!selectedItem) return clipTime;
    
    const absoluteTime = selectedItem.start + (clipTime * (selectedItem.out - selectedItem.in));
    const closestBeat = mockBeats.reduce((prev, curr) => 
      Math.abs(curr - absoluteTime) < Math.abs(prev - absoluteTime) ? curr : prev
    );
    
    // Convert back to relative time
    const relativeTime = (closestBeat - selectedItem.start) / (selectedItem.out - selectedItem.in);
    return Math.max(0, Math.min(1, relativeTime));
  };

  const anchorToBeat = (index: number) => {
    const keyframe = speedRamp.keyframes[index];
    if (!selectedItem) return;
    
    const snappedTime = snapToNearestBeat(keyframe.time);
    const absoluteTime = selectedItem.start + (snappedTime * (selectedItem.out - selectedItem.in));
    const closestBeat = mockBeats.reduce((prev, curr) => 
      Math.abs(curr - absoluteTime) < Math.abs(prev - absoluteTime) ? curr : prev
    );
    
    updateKeyframe(index, { 
      time: snappedTime,
      beatAnchor: closestBeat 
    });
  };

  const applyPreset = (preset: 'slowmo' | 'speedup' | 'freeze' | 'ramp') => {
    let newKeyframes: SpeedKeyframe[];
    
    switch (preset) {
      case 'slowmo':
        newKeyframes = [
          { time: 0, speed: 1 },
          { time: 0.2, speed: 0.3 },
          { time: 0.8, speed: 0.3 },
          { time: 1, speed: 1 }
        ];
        break;
      case 'speedup':
        newKeyframes = [
          { time: 0, speed: 1 },
          { time: 0.2, speed: 2 },
          { time: 0.8, speed: 2 },
          { time: 1, speed: 1 }
        ];
        break;
      case 'freeze':
        newKeyframes = [
          { time: 0, speed: 1 },
          { time: 0.4, speed: 1 },
          { time: 0.5, speed: 0 },
          { time: 0.6, speed: 0 },
          { time: 1, speed: 1 }
        ];
        break;
      case 'ramp':
        newKeyframes = [
          { time: 0, speed: 0.5 },
          { time: 0.5, speed: 1.5 },
          { time: 1, speed: 0.5 }
        ];
        break;
      default:
        return;
    }
    
    updateSpeedRamp({
      ...speedRamp,
      keyframes: newKeyframes
    });
  };

  const getClipDuration = () => {
    return selectedItem ? selectedItem.out - selectedItem.in : 0;
  };

  if (!selectedItem) {
    return (
      <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Speed Ramp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Select a timeline item to edit speed
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Speed Ramp</CardTitle>
        <div className="text-sm text-muted-foreground">
          {selectedItem.clipId} • {getClipDuration().toFixed(1)}s
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Speed Ramp Enabled</Label>
          <input
            type="checkbox"
            checked={speedRamp.enabled}
            onChange={(e) => updateSpeedRamp({ ...speedRamp, enabled: e.target.checked })}
            className="w-4 h-4"
          />
        </div>

        {speedRamp.enabled && (
          <>
            {/* Visual Speed Curve */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Speed Curve</Label>
              <div className="h-24 bg-slate-900 rounded border relative overflow-hidden">
                <svg className="w-full h-full">
                  {/* Grid lines */}
                  <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  
                  {/* Speed curve */}
                  <polyline
                    points={speedRamp.keyframes.map((kf) => {
                      const x = kf.time * 100;
                      const y = 100 - ((kf.speed / 3) * 100); // Scale to 3x max speed
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />
                  
                  {/* Keyframe points */}
                  {speedRamp.keyframes.map((kf, i) => {
                    const x = kf.time * 100;
                    const y = 100 - ((kf.speed / 3) * 100);
                    return (
                      <circle
                        key={i}
                        cx={`${x}%`}
                        cy={`${y}%`}
                        r="4"
                        fill={selectedKeyframe === i ? "#f59e0b" : "#3b82f6"}
                        stroke="white"
                        strokeWidth="1"
                        className="cursor-pointer hover:fill-amber-400"
                        onClick={() => setSelectedKeyframe(selectedKeyframe === i ? null : i)}
                      />
                    );
                  })}
                  
                  {/* Beat markers */}
                  {mockBeats.map(beat => {
                    if (!selectedItem) return null;
                    const relativeTime = (beat - selectedItem.start) / (selectedItem.out - selectedItem.in);
                    if (relativeTime < 0 || relativeTime > 1) return null;
                    
                    return (
                      <line
                        key={beat}
                        x1={`${relativeTime * 100}%`}
                        y1="0"
                        x2={`${relativeTime * 100}%`}
                        y2="100%"
                        stroke="#ef4444"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                        opacity="0.5"
                      />
                    );
                  })}
                </svg>
              </div>
              <div className="text-xs text-muted-foreground">
                Red lines show beat positions • Click points to select • Blue line shows speed curve
              </div>
            </div>

            {/* Keyframe Editor */}
            {selectedKeyframe !== null && selectedKeyframe < speedRamp.keyframes.length && (
              <div className="space-y-3 p-3 bg-slate-900/50 rounded border">
                <h4 className="text-sm font-semibold">
                  Keyframe {selectedKeyframe + 1}
                  {speedRamp.keyframes[selectedKeyframe].beatAnchor && 
                    ` (Beat ${speedRamp.keyframes[selectedKeyframe].beatAnchor}s)`}
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Time (0-1)</Label>
                    <Input
                      type="number"
                      value={speedRamp.keyframes[selectedKeyframe].time}
                      onChange={(e) => updateKeyframe(selectedKeyframe, { 
                        time: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0))
                      })}
                      className="h-8"
                      min="0"
                      max="1"
                      step="0.01"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs">Speed</Label>
                    <Input
                      type="number"
                      value={speedRamp.keyframes[selectedKeyframe].speed}
                      onChange={(e) => updateKeyframe(selectedKeyframe, { 
                        speed: Math.max(0, Math.min(3, parseFloat(e.target.value) || 1))
                      })}
                      className="h-8"
                      min="0"
                      max="3"
                      step="0.1"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => anchorToBeat(selectedKeyframe)}
                    className="text-xs"
                  >
                    Snap to Beat
                  </Button>
                  
                  {speedRamp.keyframes.length > 2 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        removeKeyframe(selectedKeyframe);
                        setSelectedKeyframe(null);
                      }}
                      className="text-xs"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Add Keyframe */}
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => addKeyframe(0.5, 1)}
                className="text-xs w-full"
              >
                Add Keyframe at 50%
              </Button>
            </div>

            <Separator />

            {/* Presets */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Quick Presets</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset('slowmo')}
                  className="text-xs"
                >
                  Slow Motion
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset('speedup')}
                  className="text-xs"
                >
                  Speed Up
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset('freeze')}
                  className="text-xs"
                >
                  Freeze Frame
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset('ramp')}
                  className="text-xs"
                >
                  Speed Ramp
                </Button>
              </div>
            </div>

            <Separator />

            {/* Beat Sync Tools */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Beat Sync</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Quantize all keyframes to nearest beats
                    const quantizedKeyframes = speedRamp.keyframes.map(kf => ({
                      ...kf,
                      time: snapToNearestBeat(kf.time)
                    }));
                    updateSpeedRamp({ ...speedRamp, keyframes: quantizedKeyframes });
                  }}
                  className="text-xs"
                >
                  Quantize to Beats
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Reset to simple 1x speed
                    updateSpeedRamp({
                      ...speedRamp,
                      keyframes: [
                        { time: 0, speed: 1 },
                        { time: 1, speed: 1 }
                      ]
                    });
                  }}
                  className="text-xs"
                >
                  Reset Speed
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};