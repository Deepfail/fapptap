import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { 
  Lightning, 
  MagnifyingGlassPlus, 
  Scissors, 
  Palette, 
  WaveTriangle, 
  Vibrate,
  Sparkle,
  Timer,
  Wand
} from "@phosphor-icons/react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useKV } from '@github/spark/hooks'

interface VisualEffect {
  id: string
  type: 'flash' | 'zoom' | 'shake' | 'rgb_split' | 'glitch'
  intensity: number
  beatSynced: boolean
}

interface Effect {
  id: string
  name: string
  type: 'flash' | 'zoom' | 'shake' | 'rgb_split' | 'glitch' | 'sparkle' | 'slowmo' | 'cut'
  icon: React.ReactNode
  description: string
  isActive?: boolean
}

const effects: Effect[] = [
  {
    id: "flash",
    name: "Flash",
    type: "flash",
    icon: <Lightning size={20} />,
    description: "Add bright flash effects on beats"
  },
  {
    id: "zoom", 
    name: "Zoom",
    type: "zoom",
    icon: <MagnifyingGlassPlus size={20} />,
    description: "Zoom in/out with rhythm"
  },
  {
    id: "cut",
    name: "Fast Cut", 
    type: "cut",
    icon: <Scissors size={20} />,
    description: "Quick cuts synchronized to beats"
  },
  {
    id: "rgb",
    name: "RGB Split",
    type: "rgb_split",
    icon: <Palette size={20} />,
    description: "Chromatic aberration effect"
  },
  {
    id: "glitch",
    name: "Glitch",
    type: "glitch",
    icon: <WaveTriangle size={20} />,
    description: "Digital distortion effects"
  },
  {
    id: "shake",
    name: "Shake", 
    type: "shake",
    icon: <Vibrate size={20} />,
    description: "Camera shake on impact"
  },
  {
    id: "sparkle",
    name: "Sparkle",
    type: "sparkle",
    icon: <Sparkle size={20} />,
    description: "Particle effects and shine"
  },
  {
    id: "slowmo",
    name: "Slow Mo",
    type: "slowmo",
    icon: <Timer size={20} />,
    description: "Slow motion emphasis"
  }
]

export default function EffectsToolbar() {
  const [activeEffects, setActiveEffects] = useKV<VisualEffect[]>("active-effects", [])
  const [effectIntensity, setEffectIntensity] = useKV<number>("effect-intensity", 1.0)
  const [beatSyncEnabled, setBeatSyncEnabled] = useKV<boolean>("beat-sync-enabled", true)
  
  const isEffectActive = (effectType: string) => {
    return activeEffects.some(effect => effect.type === effectType)
  }
  
  const toggleEffect = (effect: Effect) => {
    setActiveEffects(currentEffects => {
      const existing = currentEffects.find(e => e.type === effect.type)
      
      if (existing) {
        // Remove effect
        return currentEffects.filter(e => e.type !== effect.type)
      } else {
        // Add effect
        const newEffect: VisualEffect = {
          id: Date.now().toString(),
          type: effect.type as VisualEffect['type'],
          intensity: effectIntensity,
          beatSynced: beatSyncEnabled
        }
        return [...currentEffects, newEffect]
      }
    })
  }
  
  const clearAllEffects = () => {
    setActiveEffects([])
  }
  
  const randomizeEffects = () => {
    // Randomly activate 2-4 effects
    const shuffled = [...effects].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, Math.floor(Math.random() * 3) + 2)
    
    const randomEffects: VisualEffect[] = selected.map(effect => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type: effect.type as VisualEffect['type'],
      intensity: 0.5 + Math.random() * 0.5,
      beatSynced: Math.random() > 0.3 // 70% chance of beat sync
    }))
    
    setActiveEffects(randomEffects)
  }
  return (
    <Card className="bg-card border-t border-panel-border">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Effects Palette</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Beat Sync</span>
              <Switch 
                checked={beatSyncEnabled}
                onCheckedChange={setBeatSyncEnabled}
                size="sm"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {activeEffects.length} active
            </div>
          </div>
        </div>
        
        {/* Intensity Control */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Effect Intensity</span>
            <span className="text-xs text-accent">{Math.round(effectIntensity * 100)}%</span>
          </div>
          <Slider
            value={[effectIntensity]}
            onValueChange={(value) => setEffectIntensity(value[0])}
            max={2}
            min={0.1}
            step={0.1}
            className="w-full"
          />
        </div>
        
        <TooltipProvider>
          <div className="flex items-center gap-2 flex-wrap">
            {effects.map((effect) => {
              const isActive = isEffectActive(effect.type)
              return (
                <Tooltip key={effect.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className={`gap-2 transition-all ${
                        isActive 
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground glow-primary" 
                          : "hover:bg-accent/20 hover:border-accent/50"
                      }`}
                      onClick={() => toggleEffect(effect)}
                    >
                      {effect.icon}
                      <span className="text-xs">{effect.name}</span>
                      {isActive && beatSyncEnabled && (
                        <div className="w-1 h-1 bg-accent rounded-full animate-pulse" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p className="font-medium">{effect.description}</p>
                      {isActive && (
                        <p className="text-muted-foreground mt-1">
                          {beatSyncEnabled ? "Synced to beats" : "Continuous effect"}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
            
            {/* Quick actions */}
            <div className="ml-auto flex items-center gap-2 pl-4 border-l border-panel-border">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs"
                onClick={clearAllEffects}
                disabled={activeEffects.length === 0}
              >
                Clear All
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs gap-1"
                onClick={randomizeEffects}
              >
                <Wand size={12} />
                Randomize
              </Button>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </Card>
  )
}