import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Export, Gear, Palette, Download } from "@phosphor-icons/react"

export default function SettingsPanel() {
  return (
    <div className="h-full flex flex-col bg-card border-l border-panel-border">
      <div className="p-4 border-b border-panel-border">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Gear size={20} />
          Settings & Export
        </h2>
      </div>

      <Tabs defaultValue="effects" className="flex-1 flex flex-col">
        <TabsList className="m-4 mb-0 bg-muted">
          <TabsTrigger value="effects" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Effects
          </TabsTrigger>
          <TabsTrigger value="export" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Export
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="effects" className="m-4 mt-4 space-y-6">
            <Card className="p-4 bg-muted/30 border-border/50">
              <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                <Palette size={16} />
                Effect Settings
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-foreground">Flash Intensity</label>
                    <span className="text-xs text-accent">75%</span>
                  </div>
                  <Slider defaultValue={[75]} max={100} step={1} className="w-full" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-foreground">Zoom Factor</label>
                    <span className="text-xs text-accent">1.5x</span>
                  </div>
                  <Slider defaultValue={[150]} min={100} max={300} step={10} className="w-full" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-foreground">Shake Strength</label>
                    <span className="text-xs text-accent">60%</span>
                  </div>
                  <Slider defaultValue={[60]} max={100} step={1} className="w-full" />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Auto Beat Detection</label>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Sync to BPM</label>
                  <Switch defaultChecked />
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-muted/30 border-border/50">
              <h3 className="text-sm font-medium text-foreground mb-4">Quick Presets</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="text-xs">Aggressive</Button>
                <Button variant="outline" size="sm" className="text-xs">Smooth</Button>
                <Button variant="outline" size="sm" className="text-xs">Glitchy</Button>
                <Button variant="outline" size="sm" className="text-xs">Cinematic</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="export" className="m-4 mt-4 space-y-6">
            <Card className="p-4 bg-muted/30 border-border/50">
              <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                <Export size={16} />
                Export Settings
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-2">Quality</label>
                  <div className="grid grid-cols-3 gap-1">
                    <Button variant="outline" size="sm" className="text-xs">720p</Button>
                    <Button size="sm" className="text-xs bg-primary hover:bg-primary/90">1080p</Button>
                    <Button variant="outline" size="sm" className="text-xs">4K</Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-2">Format</label>
                  <div className="grid grid-cols-2 gap-1">
                    <Button size="sm" className="text-xs bg-primary hover:bg-primary/90">MP4</Button>
                    <Button variant="outline" size="sm" className="text-xs">MOV</Button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-foreground">Bitrate</label>
                    <span className="text-xs text-accent">8 Mbps</span>
                  </div>
                  <Slider defaultValue={[8]} min={1} max={20} step={1} className="w-full" />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Include Audio</label>
                  <Switch defaultChecked />
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 glow-primary">
                <Download size={16} />
                Export Video
              </Button>
              
              {/* Export Progress (hidden by default) */}
              <Card className="p-3 bg-muted/30 border-border/50 hidden">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-foreground">Exporting...</span>
                  <span className="text-accent">45%</span>
                </div>
                <Progress value={45} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">Estimated time: 2m 34s</p>
              </Card>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}