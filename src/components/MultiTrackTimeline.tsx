import { useState } from 'react';
import { useEditor } from '../state/editorStore';
import { TimelineItemComponent } from './TimelineItemComponent';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface TrackInfo {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'effects';
  height: number;
  visible: boolean;
  locked: boolean;
  muted?: boolean; // for audio tracks
}

export const MultiTrackTimeline = () => {
  const {
    timeline,
    clips,
    selectedTimelineItemId,
    selectTimelineItem,
    addClipToTimeline,
    pixelsPerSecond,
    playhead,
    setPlayhead,
    rippleMode,
    setRippleMode,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditor();

  const [tracks, setTracks] = useState<TrackInfo[]>([
    { id: 'v1', name: 'Video 1', type: 'video', height: 60, visible: true, locked: false },
    { id: 'v2', name: 'Video 2', type: 'video', height: 60, visible: true, locked: false },
    { id: 'a1', name: 'Audio 1', type: 'audio', height: 40, visible: true, locked: false, muted: false },
    { id: 'a2', name: 'Audio 2', type: 'audio', height: 40, visible: true, locked: false, muted: false },
    { id: 'fx1', name: 'Effects', type: 'effects', height: 30, visible: true, locked: false },
  ]);

  const [dragX, setDragX] = useState<number | null>(null);
  const [dragTrackId, setDragTrackId] = useState<string | null>(null);
  const [panOffset, setPanOffset] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanX, setLastPanX] = useState(0);
  const [showBeatGrid, setShowBeatGrid] = useState(true);
  const [zoom, setZoom] = useState(1);

  // Mock beat data for demonstration
  const mockBeats = Array.from({length: 50}, (_, i) => i * 2);
  
  const timelineWidth = 2000 * zoom;
  const viewportWidth = 800;
  const totalHeight = tracks.reduce((sum, track) => sum + track.height, 0);

  const addTrack = (type: 'video' | 'audio' | 'effects') => {
    const newTrack: TrackInfo = {
      id: `${type}${tracks.filter(t => t.type === type).length + 1}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${tracks.filter(t => t.type === type).length + 1}`,
      type,
      height: type === 'video' ? 60 : type === 'audio' ? 40 : 30,
      visible: true,
      locked: false,
      muted: type === 'audio' ? false : undefined,
    };
    setTracks([...tracks, newTrack]);
  };

  const toggleTrackVisibility = (trackId: string) => {
    setTracks(tracks.map(track => 
      track.id === trackId ? { ...track, visible: !track.visible } : track
    ));
  };

  const toggleTrackLock = (trackId: string) => {
    setTracks(tracks.map(track => 
      track.id === trackId ? { ...track, locked: !track.locked } : track
    ));
  };

  const toggleTrackMute = (trackId: string) => {
    setTracks(tracks.map(track => 
      track.id === trackId && track.type === 'audio' 
        ? { ...track, muted: !track.muted } 
        : track
    ));
  };

  const deleteTrack = (trackId: string) => {
    setTracks(tracks.filter(track => track.id !== trackId));
  };

  const getTrackIcon = (type: string) => {
    switch (type) {
      case 'video': return '🎬';
      case 'audio': return '🎵';
      case 'effects': return '✨';
      default: return '📄';
    }
  };

  const handleDragOver = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragX(Math.max(0, e.clientX - rect.left));
    setDragTrackId(trackId);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, trackId: string) => {
    e.preventDefault();
    let clipId = e.dataTransfer.getData("text/clip-id");
    if (!clipId) {
      try {
        const json = e.dataTransfer.getData("application/json");
        const parsed = JSON.parse(json || "{}");
        clipId = parsed.id;
      } catch (err) {
        // ignore
      }
    }
    if (!clipId) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const adjustedX = x + panOffset;
    const start = Math.max(0, Math.round(adjustedX / pixelsPerSecond));
    
    // TODO: Assign clip to specific track based on trackId
    // For now, just add to timeline
    
    // Snap to beat grid if enabled
    if (showBeatGrid) {
      const closestBeat = mockBeats.reduce((prev, curr) => 
        Math.abs(curr - start) < Math.abs(prev - start) ? curr : prev
      );
      if (Math.abs(closestBeat - start) < 0.5) {
        addClipToTimeline(clipId, closestBeat);
      } else {
        addClipToTimeline(clipId, start);
      }
    } else {
      addClipToTimeline(clipId, start);
    }
    setDragX(null);
    setDragTrackId(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setLastPanX(e.clientX);
      e.preventDefault();
    } else if (e.button === 0) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const adjustedX = x + panOffset;
      const time = adjustedX / pixelsPerSecond;
      setPlayhead(time);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanX;
      setPanOffset(Math.max(0, Math.min(timelineWidth - viewportWidth, panOffset - deltaX)));
      setLastPanX(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const newZoom = Math.max(0.1, Math.min(5, zoom + e.deltaY * -0.001));
      setZoom(newZoom);
    } else {
      const deltaX = e.deltaX || e.deltaY;
      setPanOffset(Math.max(0, Math.min(timelineWidth - viewportWidth, panOffset + deltaX)));
    }
  };

  const getPlayheadPosition = () => {
    return Math.max(0, Math.min(viewportWidth, playhead * pixelsPerSecond - panOffset));
  };

  const renderBeatGrid = () => {
    return mockBeats.map(beat => {
      const x = beat * pixelsPerSecond - panOffset;
      if (x < -10 || x > viewportWidth + 10) return null;
      
      return (
        <div
          key={beat}
          className="absolute top-0 w-px bg-slate-500/30"
          style={{ left: x, height: totalHeight }}
        />
      );
    });
  };

  return (
    <div className="bg-slate-800 rounded-md overflow-hidden">
      {/* Timeline Controls */}
      <div className="flex items-center justify-between p-2 border-b border-slate-700 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={undo} disabled={!canUndo} className="text-xs">
            ↶ Undo
          </Button>
          <Button size="sm" onClick={redo} disabled={!canRedo} className="text-xs">
            ↷ Redo
          </Button>
          
          <div className="w-px h-4 bg-slate-600 mx-2" />
          
          <Button
            size="sm"
            variant={rippleMode ? "default" : "outline"}
            onClick={() => setRippleMode(!rippleMode)}
            className="text-xs"
          >
            🌊 Ripple
          </Button>
          
          <Button
            size="sm"
            variant={showBeatGrid ? "default" : "outline"}
            onClick={() => setShowBeatGrid(!showBeatGrid)}
            className="text-xs"
          >
            📏 Grid
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs">Zoom:</label>
          <Input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-20 h-6"
          />
          <span className="text-xs text-muted-foreground">{zoom.toFixed(1)}x</span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => addTrack('video')} className="text-xs">
            + Video
          </Button>
          <Button size="sm" onClick={() => addTrack('audio')} className="text-xs">
            + Audio
          </Button>
          <Button size="sm" onClick={() => addTrack('effects')} className="text-xs">
            + FX
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Track Headers */}
        <div className="w-40 bg-slate-900/50 border-r border-slate-700">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between px-2 border-b border-slate-700/50"
              style={{ height: track.height }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm">{getTrackIcon(track.type)}</span>
                <span className="text-xs font-medium truncate">{track.name}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleTrackVisibility(track.id)}
                  className={`text-xs p-1 ${!track.visible ? 'opacity-50' : ''}`}
                >
                  👁
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleTrackLock(track.id)}
                  className={`text-xs p-1 ${track.locked ? 'text-red-400' : ''}`}
                >
                  🔒
                </Button>
                
                {track.type === 'audio' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleTrackMute(track.id)}
                    className={`text-xs p-1 ${track.muted ? 'text-red-400' : ''}`}
                  >
                    🔇
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteTrack(track.id)}
                  className="text-xs p-1 text-red-400 hover:bg-red-900/20"
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-hidden">
          <div
            className="relative bg-slate-800"
            style={{ 
              height: totalHeight, 
              width: viewportWidth,
              cursor: isPanning ? 'grabbing' : 'crosshair'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Beat grid */}
            {showBeatGrid && renderBeatGrid()}
            
            {/* Track Lanes */}
            {tracks.map((track, index) => {
              const trackY = tracks.slice(0, index).reduce((sum, t) => sum + t.height, 0);
              
              return (
                <div
                  key={track.id}
                  className={`absolute border-b border-slate-700/50 ${
                    track.type === 'video' ? 'bg-blue-900/10' :
                    track.type === 'audio' ? 'bg-green-900/10' : 'bg-purple-900/10'
                  }`}
                  style={{
                    top: trackY,
                    height: track.height,
                    width: viewportWidth,
                    opacity: track.visible ? 1 : 0.5
                  }}
                  onDrop={(e) => handleDrop(e, track.id)}
                  onDragOver={(e) => handleDragOver(e, track.id)}
                  onDragLeave={() => {
                    setDragX(null);
                    setDragTrackId(null);
                  }}
                >
                  {/* Drag preview line */}
                  {dragX !== null && dragTrackId === track.id && (
                    <div
                      style={{ left: dragX }}
                      className="absolute top-0 h-full w-px bg-white/60 z-10"
                    />
                  )}
                </div>
              );
            })}
            
            {/* Timeline items - filter by track if needed */}
            {timeline.map((item) => {
              const clip = clips.find((c) => c.id === item.clipId);
              return (
                <TimelineItemComponent
                  key={item.id}
                  item={item}
                  clip={clip}
                  pixelsPerSecond={pixelsPerSecond}
                  panOffset={panOffset}
                  isSelected={selectedTimelineItemId === item.id}
                  onSelect={selectTimelineItem}
                />
              );
            })}
            
            {/* Playhead */}
            <div
              className="absolute top-0 w-0.5 bg-red-500 z-20 pointer-events-none"
              style={{ 
                left: getPlayheadPosition(),
                height: totalHeight 
              }}
            >
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Time ruler */}
      <div className="ml-40 relative h-4 text-xs text-muted-foreground border-t border-slate-700">
        {Array.from({length: Math.ceil(timelineWidth / pixelsPerSecond / 5)}, (_, i) => {
          const time = i * 5;
          const x = time * pixelsPerSecond - panOffset;
          if (x < -20 || x > viewportWidth + 20) return null;
          
          return (
            <div
              key={time}
              className="absolute"
              style={{ left: x }}
            >
              {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
            </div>
          );
        })}
      </div>
    </div>
  );
};