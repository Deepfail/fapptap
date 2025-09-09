/**
 * Unified FAPPTap App - Single interface for all functionality
 * 1. Select videos and audio
 * 2. Generate timeline with beat analysis
 * 3. Customize with effects and settings
 * 4. Preview with FFplay
 * 5. Export final MP4
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { SelectableLibraryPane } from '@/components/SelectableLibraryPane';
import PreviewPlayer from '@/components/preview/PreviewPlayer';
import { updateTimelineWithTempo } from '@/preview/timelineGenerator';
import { stopFfplayPreview } from '@/preview/ffplayPreview';
import { runWorkerPipeline, runFfplayPreview } from '@/lib/workerPipeline';
import { Timeline, CreateRequest, NoCutZone, EffectKind, Intensity } from '@/preview/types';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Square, Save, Shuffle, Volume2, Zap, FolderOpen } from 'lucide-react';
import { isTauriAvailable } from '@/lib/platform';

interface UnifiedAppState {
  // File selections
  selectedClips: string[];
  audioFile: string | null;
  lastDir: string | undefined;
  
  // Generation settings
  audioPreset: CreateRequest['audioPreset'];
  videoLength: CreateRequest['videoLength'];
  clipOrder: CreateRequest['clipOrder'];
  
  // Timeline and preview
  timeline: Timeline | null;
  isGenerating: boolean;
  isPreviewPlaying: boolean;
  previewVideoPath: string | null;
  
  // Customization
  globalTempo: number;
  noCutZones: NoCutZone[];
  selectedClipIndex: number | null;
  
  // Export
  isExporting: boolean;
  exportProgress: number;
}

const DURATION_OPTIONS = [
  { value: '30s', label: '30 seconds' },
  { value: '1m', label: '1 minute' },
  { value: '2m', label: '2 minutes' },
  { value: '3m', label: '3 minutes' },
  { value: 'full', label: 'Full track' },
] as const;

const EFFECT_OPTIONS: { value: EffectKind; label: string }[] = [
  { value: 'flash', label: 'Flash' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'shake', label: 'Shake' },
  { value: 'prism', label: 'Prism' },
  { value: 'rgb', label: 'RGB Shift' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'jump_cut', label: 'Jump Cut' },
  { value: 'fast_cut', label: 'Fast Cut' },
];

const INTENSITY_OPTIONS: { value: Intensity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'med', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export function UnifiedApp() {
  const [state, setState] = useState<UnifiedAppState>({
    selectedClips: [],
    audioFile: null,
    lastDir: undefined,
    audioPreset: '1m',
    videoLength: '1m',
    clipOrder: 'random',
    timeline: null,
    isGenerating: false,
    isPreviewPlaying: false,
    previewVideoPath: null,
    globalTempo: 1.0,
    noCutZones: [],
    selectedClipIndex: null,
    isExporting: false,
    exportProgress: 0,
  });

  // Generate timeline and start preview
  const handleGenerate = useCallback(async () => {
    if (!state.audioFile || state.selectedClips.length === 0) {
      toast.error('Please select audio file and video clips');
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true }));

    try {
      console.log('Running worker pipeline...');
      console.log('Audio:', state.audioFile);
      console.log('Clips:', state.selectedClips);

      // Run the full Python worker pipeline
      const result = await runWorkerPipeline({
        audioPath: state.audioFile,
        clipPaths: state.selectedClips,
        preset: state.audioPreset || "landscape",
        cuttingMode: "medium",
        enableShotDetection: false
      });

      if (result.success) {
        setState(prev => ({ 
          ...prev, 
          isGenerating: false,
          selectedClipIndex: null,
          previewVideoPath: result.renderPath || null
        }));
        
        toast.success(`Pipeline completed! Generated video ready for preview.`);
        
        // Automatically start FFplay preview
        setTimeout(async () => {
          try {
            const previewResult = await runFfplayPreview();
            if (previewResult.success) {
              setState(prev => ({ ...prev, isPreviewPlaying: true }));
              toast.success('FFplay preview started! Look for the external video window.');
            } else {
              toast.error(`Preview failed: ${previewResult.message}`);
            }
          } catch (error) {
            console.error('Preview error:', error);
            toast.error('Failed to start preview');
          }
        }, 1000);
        
      } else {
        setState(prev => ({ ...prev, isGenerating: false }));
        toast.error(result.message);
      }
    } catch (error) {
      setState(prev => ({ ...prev, isGenerating: false }));
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Generation failed:', errorMessage);
      toast.error(`Generation failed: ${errorMessage}`);
    }
  }, [state.audioFile, state.selectedClips, state.audioPreset]);

  // Start FFplay preview
  const handlePreview = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isPreviewPlaying: true }));
      
      const result = await runFfplayPreview();
      if (result.success) {
        toast.success('FFplay preview started! Look for the external video window.');
      } else {
        setState(prev => ({ ...prev, isPreviewPlaying: false }));
        toast.error(result.message);
      }
    } catch (error) {
      setState(prev => ({ ...prev, isPreviewPlaying: false }));
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Preview failed:', errorMessage);
      toast.error(`Preview failed: ${errorMessage}`);
    }
  }, []);

  // Stop FFplay preview
  const handleStopPreview = useCallback(async () => {
    try {
      await stopFfplayPreview();
      setState(prev => ({ ...prev, isPreviewPlaying: false }));
      toast.success('Preview stopped');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Stop failed:', errorMessage);
      toast.error(`Stop failed: ${errorMessage}`);
    }
  }, []);

  // Update tempo and regenerate
  const handleTempoChange = useCallback(async (newTempo: number) => {
    if (!state.timeline) return;

    setState(prev => ({ ...prev, globalTempo: newTempo }));
    
    const updatedTimeline = updateTimelineWithTempo(state.timeline, newTempo);
    setState(prev => ({ ...prev, timeline: updatedTimeline }));
    
    // Restart preview with new tempo
    if (state.isPreviewPlaying) {
      await handleStopPreview();
      setTimeout(() => handlePreview(), 300);
    }
  }, [state.timeline, state.isPreviewPlaying, handleStopPreview, handlePreview]);

  // Randomize clip order and regenerate
  const handleRandomize = useCallback(async () => {
    if (!state.audioFile || state.selectedClips.length === 0) return;

    // Generate new timeline with random order
    setState(prev => ({ ...prev, clipOrder: 'random', isGenerating: true }));
    await handleGenerate();
  }, [state.audioFile, state.selectedClips, handleGenerate]);

  // Export final MP4
  const handleExport = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isExporting: true, exportProgress: 0 }));

      // Check if render output exists
      const { exists } = await import("@tauri-apps/plugin-fs");
      if (!await exists("render/fapptap_final.mp4")) {
        toast.error('No rendered video found. Please generate timeline first.');
        setState(prev => ({ ...prev, isExporting: false }));
        return;
      }

      // Export is basically copying the already rendered file
      const { save } = await import("@tauri-apps/plugin-dialog");
      const savePath = await save({
        filters: [{ 
          name: 'Video Files', 
          extensions: ['mp4'] 
        }],
        defaultPath: "fapptap_export.mp4"
      });

      if (savePath) {
        const { copyFile } = await import("@tauri-apps/plugin-fs");
        await copyFile("render/fapptap_final.mp4", savePath);
        
        setState(prev => ({ 
          ...prev, 
          isExporting: false, 
          exportProgress: 100 
        }));
        
        toast.success(`Video exported to: ${savePath}`);
      } else {
        setState(prev => ({ ...prev, isExporting: false }));
      }
    } catch (error) {
      setState(prev => ({ ...prev, isExporting: false }));
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Export failed:', errorMessage);
      toast.error(`Export failed: ${errorMessage}`);
    }
  }, []);

  // Add effect to selected clip
  const handleAddEffect = useCallback((effectKind: EffectKind, intensity: Intensity) => {
    if (state.selectedClipIndex === null || !state.timeline) return;

    const updatedClips = [...state.timeline.clips];
    const clip = updatedClips[state.selectedClipIndex];
    
    const newEffect = { kind: effectKind, intensity };
    const existingEffects = clip.effects || [];
    
    // Remove existing effect of same kind, then add new one
    const filteredEffects = existingEffects.filter(e => e.kind !== effectKind);
    clip.effects = [...filteredEffects, newEffect];

    const updatedTimeline = { ...state.timeline, clips: updatedClips };
    setState(prev => ({ ...prev, timeline: updatedTimeline }));

    toast.success(`Added ${effectKind} (${intensity}) to clip ${state.selectedClipIndex + 1}`);
  }, [state.selectedClipIndex, state.timeline]);

  // Select audio file
  const handleSelectAudio = useCallback(async () => {
    if (!isTauriAvailable()) {
      toast.error('Audio selection only available in desktop mode');
      return;
    }

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const file = await open({
        title: 'Select Audio File',
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'] }],
      });
      if (file) {
        setState(prev => ({ ...prev, audioFile: file }));
        toast.success('Audio file selected');
      }
    } catch (error) {
      console.error('Failed to select audio file:', error);
      toast.error('Failed to select audio file');
    }
  }, []);

  // Handle clip selection from library
  const handleClipSelect = useCallback((clipPath: string) => {
    setState(prev => ({
      ...prev,
      selectedClips: prev.selectedClips.includes(clipPath)
        ? prev.selectedClips.filter(c => c !== clipPath)
        : [...prev.selectedClips, clipPath]
    }));
  }, []);

  // Clear clip selection
  const handleClearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedClips: [] }));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/50">
        <h1 className="text-xl font-bold text-white">FAPPTap - Unified Editor</h1>
        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={state.isGenerating || !state.audioFile || state.selectedClips.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {state.isGenerating ? 'Generating...' : 'Generate Video'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar - Library */}
        <div className="w-80 border-r border-slate-700 bg-slate-800/50 flex flex-col h-full">
          <div className="flex-1 overflow-hidden">
            <SelectableLibraryPane
              selectedClips={state.selectedClips}
              onSelectClip={handleClipSelect}
              initialDir={state.lastDir}
              onDirChange={(dir: string) => setState(prev => ({ ...prev, lastDir: dir }))}
            />
          </div>
          
          {/* Selection Summary */}
          <div className="p-3 border-t border-slate-700 bg-slate-900/50">
            <div className="text-sm text-slate-400 mb-2">
              Selected: {state.selectedClips.length} clips
            </div>
            {state.selectedClips.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                className="w-full"
              >
                Clear Selection
              </Button>
            )}
          </div>
        </div>

        {/* Center - Video Player */}
        <div className="flex-1 flex flex-col bg-slate-900">
          
          {/* Video Player Area */}
          <div className="flex-1 p-4">
            <div className="h-full rounded-xl border border-slate-700 overflow-hidden bg-black">
              {state.previewVideoPath ? (
                <PreviewPlayer
                  srcPath={state.previewVideoPath}
                  muted={false}
                  autoHideMs={5000}
                  onTime={() => {}}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <Volume2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No preview available</p>
                    <p className="text-sm">Select audio and clips, then generate</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Simple Timeline Strip */}
          <div className="h-24 border-t border-slate-700 bg-slate-800/30 p-2">
            {state.timeline ? (
              <div className="h-full">
                <div className="text-xs text-slate-400 mb-1">
                  Timeline: {state.timeline.clips.length} clips • {state.timeline.fps} FPS • Tempo: {state.globalTempo}x
                </div>
                <div className="flex gap-1 h-16 overflow-x-auto">
                  {state.timeline.clips.map((clip, index) => (
                    <div
                      key={index}
                      onClick={() => setState(prev => ({ ...prev, selectedClipIndex: index }))}
                      className={`
                        flex-shrink-0 h-full min-w-[60px] border border-slate-600 rounded cursor-pointer
                        ${state.selectedClipIndex === index ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}
                      `}
                    >
                      <div className="p-1 text-xs text-white">
                        <div className="truncate">Clip {index + 1}</div>
                        <div className="text-slate-300">
                          {clip.effects?.length || 0} fx
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                <p className="text-sm">Timeline will appear here after generation</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Controls */}
        <div className="w-80 border-l border-slate-700 bg-slate-800/50 flex flex-col h-full overflow-y-auto">
          
          {/* Audio Selection */}
          <Card className="m-3 bg-slate-800 border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">Audio Track</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSelectAudio}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                {state.audioFile ? 'Change Audio' : 'Select Audio File'}
              </Button>
              
              {state.audioFile && (
                <div className="text-xs text-green-400 truncate">
                  {state.audioFile.split('/').pop()?.split('\\').pop()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Audio Length</label>
                  <Select value={state.audioPreset} onValueChange={(value: any) => setState(prev => ({ ...prev, audioPreset: value }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-xs text-slate-400">Video Length</label>
                  <Select value={state.videoLength} onValueChange={(value: any) => setState(prev => ({ ...prev, videoLength: value }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview Controls */}
          <Card className="m-3 bg-slate-800 border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">Preview Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handlePreview()}
                  disabled={!state.timeline}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStopPreview}
                  disabled={!state.isPreviewPlaying}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </div>
              
              {state.isPreviewPlaying && (
                <div className="text-xs text-green-400 text-center">
                  <Zap className="h-3 w-3 inline mr-1" />
                  FFplay window is open
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tempo Control */}
          <Card className="m-3 bg-slate-800 border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">Global Tempo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>0.5x</span>
                  <span className="text-white">{state.globalTempo.toFixed(1)}x</span>
                  <span>2.0x</span>
                </div>
                <Slider
                  value={[state.globalTempo]}
                  onValueChange={([value]) => handleTempoChange(value)}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
              </div>
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleRandomize}
                disabled={state.isGenerating}
                className="w-full"
              >
                <Shuffle className="h-4 w-4 mr-1" />
                Randomize Order
              </Button>
            </CardContent>
          </Card>

          {/* Effects Panel */}
          {state.selectedClipIndex !== null && state.timeline && (
            <Card className="m-3 bg-slate-800 border-slate-600">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-white">
                  Effects - Clip {state.selectedClipIndex + 1}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {EFFECT_OPTIONS.map(effect => (
                    <div key={effect.value} className="space-y-1">
                      <label className="text-xs text-slate-400">{effect.label}</label>
                      <Select onValueChange={(intensity: Intensity) => handleAddEffect(effect.value, intensity)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Add" />
                        </SelectTrigger>
                        <SelectContent>
                          {INTENSITY_OPTIONS.map(int => (
                            <SelectItem key={int.value} value={int.value}>{int.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                
                {/* Current Effects */}
                <div className="mt-3">
                  <div className="text-xs text-slate-400 mb-1">Current Effects:</div>
                  <div className="flex flex-wrap gap-1">
                    {state.timeline.clips[state.selectedClipIndex].effects?.map((effect, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {effect.kind} ({effect.intensity})
                      </Badge>
                    )) || <span className="text-xs text-slate-500">No effects</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export */}
          <Card className="m-3 bg-slate-800 border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleExport}
                disabled={!state.timeline || state.isExporting}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Save className="h-4 w-4 mr-1" />
                {state.isExporting ? `Exporting... ${state.exportProgress}%` : 'Save Final MP4'}
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>

      <Toaster position="top-right" theme="dark" />
    </div>
  );
}