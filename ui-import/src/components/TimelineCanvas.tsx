import { useRef, useEffect, useCallback } from "react"

interface Beat {
  time: number
  confidence: number
  energy: number
}

interface TimelineCanvasProps {
  beats: Beat[]
  currentTime: number
  duration: number
  onSeek: (time: number) => void
}

export default function TimelineCanvas({ 
  beats, 
  currentTime, 
  duration, 
  onSeek 
}: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Draw timeline with beat markers
  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match container
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const width = rect.width
    const height = rect.height
    
    // Clear canvas
    ctx.fillStyle = 'oklch(0.12 0 0)' // timeline-bg
    ctx.fillRect(0, 0, width, height)

    // Draw timeline background track
    const trackHeight = 8
    const trackY = height / 2 - trackHeight / 2
    
    const gradient = ctx.createLinearGradient(0, trackY, width, trackY)
    gradient.addColorStop(0, 'oklch(0.7 0.3 330 / 0.2)') // primary with transparency
    gradient.addColorStop(1, 'oklch(0.8 0.25 340 / 0.2)') // accent with transparency
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, trackY, width, trackHeight)

    if (duration === 0) return

    // Draw beat markers
    beats.forEach(beat => {
      const x = (beat.time / duration) * width
      const beatSize = 4 + (beat.confidence * 6) // Size based on confidence
      const beatY = height / 2
      
      // Beat marker background (glow effect)
      ctx.shadowColor = beat.time <= currentTime 
        ? 'oklch(0.8 0.25 340)' // accent - active
        : 'oklch(0.4 0.1 340)' // beat-inactive
      ctx.shadowBlur = 8
      
      // Beat marker
      ctx.fillStyle = beat.time <= currentTime 
        ? 'oklch(0.8 0.25 340)' // accent - active  
        : 'oklch(0.4 0.1 340)' // beat-inactive
      
      ctx.beginPath()
      ctx.arc(x, beatY, beatSize, 0, Math.PI * 2)
      ctx.fill()
      
      // Add energy indicator (inner circle)
      if (beat.energy > 0.7) {
        ctx.shadowBlur = 0
        ctx.fillStyle = beat.time <= currentTime 
          ? 'oklch(0.95 0 0)' // white for high energy active beats
          : 'oklch(0.6 0.1 340)' // dimmer for inactive
        ctx.beginPath()
        ctx.arc(x, beatY, beatSize * 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
      
      ctx.shadowBlur = 0
    })

    // Draw progress fill
    const progress = currentTime / duration
    const progressX = progress * width
    
    // Overlay gradient for played portion of timeline
    const progressGradient = ctx.createLinearGradient(0, trackY, progressX, trackY)
    progressGradient.addColorStop(0, 'oklch(0.7 0.3 330)') // primary
    progressGradient.addColorStop(1, 'oklch(0.8 0.25 340)') // accent
    
    ctx.fillStyle = progressGradient
    ctx.fillRect(0, trackY, progressX, trackHeight)

    // Draw playhead
    ctx.strokeStyle = 'oklch(0.7 0.3 330)' // primary
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    
    // Playhead line
    ctx.beginPath()
    ctx.moveTo(progressX, 0)
    ctx.lineTo(progressX, height)
    ctx.stroke()
    
    // Playhead handle (top)
    ctx.fillStyle = 'oklch(0.7 0.3 330)' // primary
    ctx.beginPath()
    ctx.arc(progressX, 8, 6, 0, Math.PI * 2)
    ctx.fill()
    
    // Add glow to playhead
    ctx.shadowColor = 'oklch(0.7 0.3 330)'
    ctx.shadowBlur = 12
    ctx.stroke()
    ctx.fill()
    ctx.shadowBlur = 0

    // Draw time segments (every 10 seconds for long videos)
    if (duration > 30) {
      const segmentInterval = duration > 120 ? 30 : 10 // 30s for long videos, 10s for shorter
      ctx.strokeStyle = 'oklch(0.3 0 0)' // subtle markers
      ctx.lineWidth = 1
      
      for (let time = 0; time <= duration; time += segmentInterval) {
        const x = (time / duration) * width
        ctx.beginPath()
        ctx.moveTo(x, height - 12)
        ctx.lineTo(x, height - 4)
        ctx.stroke()
      }
    }
  }, [beats, currentTime, duration])

  // Handle click to seek
  const handleClick = useCallback((event: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas || duration === 0) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const progress = x / rect.width
    const newTime = progress * duration
    
    onSeek(Math.max(0, Math.min(duration, newTime)))
  }, [duration, onSeek])

  // Find nearest beat for snapping (optional enhancement)
  const findNearestBeat = useCallback((time: number): number => {
    if (beats.length === 0) return time
    
    let nearestBeat = beats[0]
    let minDistance = Math.abs(beats[0].time - time)
    
    beats.forEach(beat => {
      const distance = Math.abs(beat.time - time)
      if (distance < minDistance) {
        minDistance = distance
        nearestBeat = beat
      }
    })
    
    // Snap if within 0.5 seconds
    return minDistance < 0.5 ? nearestBeat.time : time
  }, [beats])

  // Enhanced click handler with beat snapping
  const handleClickWithSnap = useCallback((event: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas || duration === 0) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const progress = x / rect.width
    const rawTime = progress * duration
    
    // Snap to nearest beat if shift key is held
    const finalTime = event.shiftKey 
      ? findNearestBeat(rawTime)
      : rawTime
    
    onSeek(Math.max(0, Math.min(duration, finalTime)))
  }, [duration, onSeek, findNearestBeat])

  // Redraw when data changes
  useEffect(() => {
    drawTimeline()
  }, [drawTimeline])

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => drawTimeline()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawTimeline])

  return (
    <div 
      ref={containerRef}
      className="h-full w-full relative cursor-pointer group"
      onClick={handleClickWithSnap}
      title="Click to seek, Shift+Click to snap to nearest beat"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Beat count indicator */}
      {beats.length > 0 && (
        <div className="absolute top-1 right-1 text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded">
          {beats.length} beats detected
        </div>
      )}
      
      {/* Current time display on hover */}
      <div className="absolute bottom-1 left-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        Shift+Click to snap to beats
      </div>
    </div>
  )
}