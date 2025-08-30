import { useEffect, useRef, useState } from "react";
import { useMediaStore } from "../state/mediaStore";

interface BeatsData {
  beats: number[];
  tempo_global: number;
  strength?: number[];
}

export function TimelineStrip() {
  const {
    songPath,
    playhead,
    pixelsPerSecond,
    setPlayhead
  } = useMediaStore();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [beatsData, setBeatsData] = useState<BeatsData | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  
  // Load beats data when song changes
  useEffect(() => {
    if (!songPath) {
      setBeatsData(null);
      return;
    }
    
    // Try to load beats data from cache
    const loadBeatsData = async () => {
      try {
        // In a real implementation, this would read from cache/beats.json
        // For now, generate mock data
        const mockBeats = Array.from({ length: 40 }, (_, i) => i * 0.5); // Beat every 0.5 seconds
        setBeatsData({
          beats: mockBeats,
          tempo_global: 120,
          strength: mockBeats.map(() => Math.random())
        });
      } catch (error) {
        console.warn('Failed to load beats data:', error);
      }
    };
    
    loadBeatsData();
  }, [songPath]);
  
  // Generate mock waveform data
  useEffect(() => {
    if (!songPath) {
      setWaveformData([]);
      setDuration(0);
      return;
    }
    
    // Generate mock waveform data
    const mockDuration = 180; // 3 minutes
    const samples = Math.floor(mockDuration * 10); // 10 samples per second
    const mockWaveform = Array.from({ length: samples }, (_, i) => {
      const t = i / samples;
      // Generate some interesting waveform shape
      return (
        Math.sin(t * Math.PI * 2 * 4) * 0.5 +
        Math.sin(t * Math.PI * 2 * 8) * 0.3 +
        Math.sin(t * Math.PI * 2 * 16) * 0.2
      ) * (1 - Math.abs(t - 0.5) * 2) + Math.random() * 0.1 - 0.05;
    });
    
    setWaveformData(mockWaveform);
    setDuration(mockDuration);
  }, [songPath]);
  
  // Draw timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    const timelineWidth = duration * pixelsPerSecond;
    
    // Clear canvas
    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.fillRect(0, 0, width, height);
    
    if (waveformData.length === 0) return;
    
    // Draw waveform
    ctx.strokeStyle = '#475569'; // slate-600
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const centerY = height * 0.6; // Leave space for beat markers at top
    const waveHeight = height * 0.4;
    
    for (let i = 0; i < waveformData.length; i++) {
      const x = (i / waveformData.length) * timelineWidth;
      const y = centerY + (waveformData[i] * waveHeight * 0.5);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Draw beats
    if (beatsData) {
      beatsData.beats.forEach((beat, index) => {
        const x = beat * pixelsPerSecond;
        const strength = beatsData.strength?.[index] || 0.5;
        const isDownbeat = index % 4 === 0; // Every 4th beat is a downbeat
        
        ctx.strokeStyle = isDownbeat ? '#3b82f6' : '#60a5fa'; // blue-600 : blue-400
        ctx.lineWidth = isDownbeat ? 2 : 1;
        ctx.setLineDash(isDownbeat ? [] : [2, 2]);
        
        const markerHeight = height * 0.3 * (0.5 + strength * 0.5);
        
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, markerHeight);
        ctx.stroke();
        
        ctx.setLineDash([]);
      });
    }
    
    // Draw playhead
    const playheadX = playhead * pixelsPerSecond;
    ctx.strokeStyle = '#f59e0b'; // amber-500
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
    
    // Draw playhead time
    ctx.fillStyle = '#f59e0b';
    ctx.font = '12px sans-serif';
    const timeText = formatTime(playhead);
    const textWidth = ctx.measureText(timeText).width;
    const textX = Math.max(2, Math.min(width - textWidth - 2, playheadX - textWidth / 2));
    ctx.fillText(timeText, textX, 16);
    
  }, [waveformData, beatsData, playhead, pixelsPerSecond, duration]);
  
  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 80; // Fixed height
    };
    
    resizeCanvas();
    
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  
  // Handle click to seek
  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || duration === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / canvas.width) * duration;
    
    setPlayhead(Math.max(0, Math.min(duration, time)));
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="h-20 bg-slate-800 border-b border-slate-700">
      <div ref={containerRef} className="w-full h-full relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-pointer"
          onClick={handleClick}
        />
        
        {!songPath && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-slate-500">Select a song to see timeline</p>
          </div>
        )}
        
        {songPath && waveformData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-slate-500">Loading waveform...</p>
          </div>
        )}
      </div>
    </div>
  );
}