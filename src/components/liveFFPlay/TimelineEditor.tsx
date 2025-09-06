/**
 * Timeline Editor for Live FFPlay Mode
 * Global tempo slider and basic timeline view
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Timeline } from '@/preview/types';
import { Zap, Clock } from 'lucide-react';

interface TimelineEditorProps {
  timeline: Timeline | null;
  onTempoChange: (tempo: number) => void;
  disabled?: boolean;
}

export function TimelineEditor({ timeline, onTempoChange, disabled = false }: TimelineEditorProps) {
  if (!timeline) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Create a timeline to edit effects and tempo
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleTempoChange = (values: number[]) => {
    if (values.length > 0 && !disabled) {
      onTempoChange(values[0]);
    }
  };

  const totalDuration = timeline.clips.reduce((sum, clip) => 
    sum + (clip.out - clip.in), 0
  );

  const effectCounts = timeline.clips.reduce((counts, clip) => {
    if (clip.effects) {
      clip.effects.forEach(effect => {
        counts[effect.kind] = (counts[effect.kind] || 0) + 1;
      });
    }
    return counts;
  }, {} as Record<string, number>);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          Timeline Editor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Tempo Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4" />
              Global Tempo
            </Label>
            <Badge variant="outline">
              {timeline.globalTempo.toFixed(1)}x
            </Badge>
          </div>
          
          <Slider
            value={[timeline.globalTempo]}
            onValueChange={handleTempoChange}
            min={0.5}
            max={2.0}
            step={0.1}
            disabled={disabled}
            className="w-full"
          />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.5x (Slow)</span>
            <span>1.0x (Normal)</span>
            <span>2.0x (Fast)</span>
          </div>
        </div>

        {/* Timeline Stats */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Timeline Stats</Label>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Duration</div>
              <div className="font-mono">{totalDuration.toFixed(1)}s</div>
            </div>
            
            <div>
              <div className="text-muted-foreground">Clips</div>
              <div className="font-mono">{timeline.clips.length}</div>
            </div>
            
            <div>
              <div className="text-muted-foreground">FPS</div>
              <div className="font-mono">{timeline.fps}</div>
            </div>
            
            <div>
              <div className="text-muted-foreground">No-Cut Zones</div>
              <div className="font-mono">{timeline.noCutZones.length}</div>
            </div>
          </div>
        </div>

        {/* Effects Summary */}
        {Object.keys(effectCounts).length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Effects Used</Label>
            
            <div className="flex flex-wrap gap-2">
              {Object.entries(effectCounts).map(([effect, count]) => (
                <Badge key={effect} variant="secondary" className="text-xs">
                  {effect}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Clip Preview */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Recent Clips</Label>
          
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {timeline.clips.slice(0, 5).map((clip, index) => (
              <div key={index} className="text-xs p-2 bg-muted rounded flex justify-between">
                <span className="truncate flex-1">
                  {clip.filePath.split('/').pop()?.split('\\').pop() || 'Unknown'}
                </span>
                <span className="text-muted-foreground ml-2">
                  {(clip.out - clip.in).toFixed(1)}s
                </span>
              </div>
            ))}
            
            {timeline.clips.length > 5 && (
              <div className="text-xs text-muted-foreground text-center py-1">
                ... and {timeline.clips.length - 5} more clips
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}