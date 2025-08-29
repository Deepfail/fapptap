import { useState } from 'react';
import { useEditor } from '../state/editorStore';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
}

interface Effect {
  id: string;
  type: 'transform' | 'filter';
  enabled: boolean;
  transform?: Transform;
}

export const EffectsInspector = () => {
  const { selectedTimelineItemId, timeline } = useEditor();
  const [effects, setEffects] = useState<Record<string, Effect[]>>({});
  
  const selectedItem = timeline.find(item => item.id === selectedTimelineItemId);
  const itemEffects = selectedItem ? effects[selectedItem.id] || [] : [];
  
  const getTransformEffect = (): Transform => {
    const transformEffect = itemEffects.find(e => e.type === 'transform');
    return transformEffect?.transform || {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1
    };
  };

  const updateTransform = (updates: Partial<Transform>) => {
    if (!selectedItem) return;
    
    setEffects(prev => {
      const itemEffects = prev[selectedItem.id] || [];
      const transformIndex = itemEffects.findIndex(e => e.type === 'transform');
      
      if (transformIndex >= 0) {
        // Update existing transform
        const updatedEffects = [...itemEffects];
        updatedEffects[transformIndex] = {
          ...updatedEffects[transformIndex],
          transform: {
            ...getTransformEffect(),
            ...updates
          }
        };
        
        return {
          ...prev,
          [selectedItem.id]: updatedEffects
        };
      } else {
        // Create new transform effect
        const newEffect: Effect = {
          id: `transform-${Date.now()}`,
          type: 'transform',
          enabled: true,
          transform: {
            ...getTransformEffect(),
            ...updates
          }
        };
        
        return {
          ...prev,
          [selectedItem.id]: [...itemEffects, newEffect]
        };
      }
    });
  };

  const resetTransform = () => {
    updateTransform({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1
    });
  };

  const removeEffect = (effectId: string) => {
    if (!selectedItem) return;
    
    setEffects(prev => ({
      ...prev,
      [selectedItem.id]: (prev[selectedItem.id] || []).filter(e => e.id !== effectId)
    }));
  };

  const currentTransform = getTransformEffect();

  if (!selectedItem) {
    return (
      <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Effects Inspector</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Select a timeline item to edit effects
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Effects Inspector</CardTitle>
        <div className="text-sm text-muted-foreground">
          {selectedItem.clipId} • {(selectedItem.out - selectedItem.in).toFixed(1)}s
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Transform Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Transform</h3>
            <Button size="sm" variant="outline" onClick={resetTransform}>
              Reset
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Position */}
            <div className="space-y-2">
              <Label htmlFor="pos-x" className="text-xs">Position X</Label>
              <Input
                id="pos-x"
                type="number"
                value={currentTransform.x}
                onChange={(e) => updateTransform({ x: parseFloat(e.target.value) || 0 })}
                className="h-8"
                step="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-y" className="text-xs">Position Y</Label>
              <Input
                id="pos-y"
                type="number"
                value={currentTransform.y}
                onChange={(e) => updateTransform({ y: parseFloat(e.target.value) || 0 })}
                className="h-8"
                step="1"
              />
            </div>
            
            {/* Scale */}
            <div className="space-y-2">
              <Label htmlFor="scale-x" className="text-xs">Scale X</Label>
              <Input
                id="scale-x"
                type="number"
                value={currentTransform.scaleX}
                onChange={(e) => updateTransform({ scaleX: parseFloat(e.target.value) || 1 })}
                className="h-8"
                step="0.1"
                min="0.1"
                max="5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scale-y" className="text-xs">Scale Y</Label>
              <Input
                id="scale-y"
                type="number"
                value={currentTransform.scaleY}
                onChange={(e) => updateTransform({ scaleY: parseFloat(e.target.value) || 1 })}
                className="h-8"
                step="0.1"
                min="0.1"
                max="5"
              />
            </div>
            
            {/* Rotation */}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="rotation" className="text-xs">Rotation (degrees)</Label>
              <Input
                id="rotation"
                type="number"
                value={currentTransform.rotation}
                onChange={(e) => updateTransform({ rotation: parseFloat(e.target.value) || 0 })}
                className="h-8"
                step="1"
                min="-360"
                max="360"
              />
            </div>
            
            {/* Opacity */}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="opacity" className="text-xs">Opacity</Label>
              <Input
                id="opacity"
                type="range"
                value={currentTransform.opacity}
                onChange={(e) => updateTransform({ opacity: parseFloat(e.target.value) })}
                className="h-8"
                min="0"
                max="1"
                step="0.01"
              />
              <div className="text-xs text-muted-foreground text-center">
                {(currentTransform.opacity * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* Effects List */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Applied Effects</h3>
          {itemEffects.length === 0 ? (
            <div className="text-xs text-muted-foreground">No effects applied</div>
          ) : (
            <div className="space-y-1">
              {itemEffects.map(effect => (
                <div key={effect.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={effect.enabled}
                      onChange={(e) => {
                        setEffects(prev => ({
                          ...prev,
                          [selectedItem.id]: (prev[selectedItem.id] || []).map(eff =>
                            eff.id === effect.id ? { ...eff, enabled: e.target.checked } : eff
                          )
                        }));
                      }}
                      className="w-3 h-3"
                    />
                    <span className="text-xs capitalize">{effect.type}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeEffect(effect.id)}
                    className="h-6 w-6 p-0"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Presets */}
        <Separator />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Quick Presets</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateTransform({ scaleX: 1.2, scaleY: 1.2 })}
            >
              Zoom In
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateTransform({ scaleX: 0.8, scaleY: 0.8 })}
            >
              Zoom Out
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateTransform({ rotation: -5 })}
            >
              Tilt Left
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateTransform({ rotation: 5 })}
            >
              Tilt Right
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};