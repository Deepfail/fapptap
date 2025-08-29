import { useEditor } from '../state/editorStore';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { isTauriAvailable } from '../lib/worker';
import { useState } from 'react';
import { Badge } from './ui/badge';

interface CutlistEvent {
  id: string;
  clipPath: string;
  start: number;      // seconds on timeline
  in: number;         // seconds into source clip  
  out: number;        // seconds into source clip
  duration: number;   // out - in
  effects?: {
    transform?: {
      x: number;
      y: number;
      scaleX: number;
      scaleY: number;
      rotation: number;
      opacity: number;
    };
  };
}

interface Cutlist {
  version: string;
  engine: string;
  duration: number;
  events: CutlistEvent[];
  metadata: {
    exportedAt: string;
    pixelsPerSecond: number;
    totalClips: number;
  };
}

export const CutlistExporter = () => {
  const { timeline, clips, pixelsPerSecond } = useEditor();
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const generateCutlist = (): Cutlist => {
    const events: CutlistEvent[] = timeline
      .sort((a, b) => a.start - b.start) // Sort by timeline position
      .map((item) => {
        const clip = clips.find(c => c.id === item.clipId);
        return {
          id: item.id,
          clipPath: clip?.path || item.clipId,
          start: item.start,
          in: item.in,
          out: item.out,
          duration: item.out - item.in,
          // Note: Effects would be populated from effects inspector in real implementation
          effects: {
            transform: {
              x: 0,
              y: 0,
              scaleX: 1,
              scaleY: 1,
              rotation: 0,
              opacity: 1
            }
          }
        };
      });

    // Calculate total duration
    const totalDuration = events.length > 0 
      ? Math.max(...events.map(e => e.start + e.duration))
      : 0;

    return {
      version: "1.0",
      engine: "fapptap-ui",
      duration: totalDuration,
      events,
      metadata: {
        exportedAt: new Date().toISOString(),
        pixelsPerSecond,
        totalClips: clips.length
      }
    };
  };

  const exportToFile = async () => {
    setIsExporting(true);
    
    try {
      const cutlist = generateCutlist();
      const json = JSON.stringify(cutlist, null, 2);
      
      if (isTauriAvailable()) {
        // Desktop: Save to render/cutlist.json
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        await writeTextFile('render/cutlist.json', json);
        setLastExport('render/cutlist.json');
      } else {
        // Browser: Download as file
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cutlist_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setLastExport('Downloaded to browser');
      }
    } catch (error) {
      console.error('Failed to export cutlist:', error);
      alert(`Failed to export cutlist: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToClipboard = async () => {
    try {
      const cutlist = generateCutlist();
      const json = JSON.stringify(cutlist, null, 2);
      await navigator.clipboard.writeText(json);
      setLastExport('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert(`Failed to copy to clipboard: ${error}`);
    }
  };

  const previewCutlist = () => {
    const cutlist = generateCutlist();
    console.log('Cutlist Preview:', cutlist);
    
    // Open in new window for easy viewing
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head><title>Cutlist Preview</title></head>
          <body style="font-family: monospace; padding: 20px; background: #1e293b; color: #e2e8f0;">
            <h1>Cutlist Preview</h1>
            <pre style="background: #334155; padding: 20px; border-radius: 8px; overflow: auto;">
${JSON.stringify(cutlist, null, 2)}
            </pre>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  const cutlist = generateCutlist();

  return (
    <Card className="border-0 shadow-lg bg-slate-800/60 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Cutlist Export</CardTitle>
        <div className="text-sm text-muted-foreground">
          Export timeline as cutlist.json for rendering
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold">{cutlist.events.length}</div>
            <div className="text-xs text-muted-foreground">Events</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{cutlist.duration.toFixed(1)}s</div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{clips.length}</div>
            <div className="text-xs text-muted-foreground">Clips</div>
          </div>
        </div>

        {/* Validation */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Validation</h3>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={cutlist.events.length > 0 ? "default" : "destructive"}>
                {cutlist.events.length > 0 ? "✓" : "✗"}
              </Badge>
              <span className="text-xs">
                {cutlist.events.length > 0 ? "Timeline has events" : "Timeline is empty"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={cutlist.duration > 0 ? "default" : "destructive"}>
                {cutlist.duration > 0 ? "✓" : "✗"}
              </Badge>
              <span className="text-xs">
                {cutlist.duration > 0 ? "Duration is valid" : "No duration"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={clips.length > 0 ? "default" : "destructive"}>
                {clips.length > 0 ? "✓" : "✗"}
              </Badge>
              <span className="text-xs">
                {clips.length > 0 ? "Clips available" : "No clips loaded"}
              </span>
            </div>
          </div>
        </div>

        {/* Export Actions */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={exportToFile}
              disabled={isExporting || cutlist.events.length === 0}
              className="w-full"
            >
              {isExporting ? "Exporting..." : "Export File"}
            </Button>
            <Button
              variant="outline"
              onClick={exportToClipboard}
              disabled={cutlist.events.length === 0}
              className="w-full"
            >
              Copy JSON
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={previewCutlist}
            disabled={cutlist.events.length === 0}
            className="w-full"
          >
            Preview
          </Button>
        </div>

        {/* Last Export Status */}
        {lastExport && (
          <div className="text-xs text-green-400 bg-green-900/20 p-2 rounded">
            ✓ Last export: {lastExport}
          </div>
        )}

        {/* Schema Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div><strong>Schema:</strong> v{cutlist.version}</div>
          <div><strong>Format:</strong> JSON with events array</div>
          <div><strong>Output:</strong> {isTauriAvailable() ? 'render/cutlist.json' : 'Browser download'}</div>
        </div>
      </CardContent>
    </Card>
  );
};