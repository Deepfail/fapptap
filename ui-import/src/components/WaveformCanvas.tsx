import { useRef, useEffect, useCallback } from "react"

interface WaveformCanvasProps {
  waveformData: Float32Array | null
  currentTime: number
  duration: number
  onSeek: (time: number) => void
}

export default function WaveformCanvas({ 
  waveformData, 
  currentTime, 
  duration, 
  onSeek 
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Draw waveform visualization
  const drawWaveform = useCallback(() => {
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

    if (!waveformData || duration === 0) {
      // Draw placeholder waveform
      ctx.strokeStyle = 'oklch(0.4 0.1 340 / 0.3)' // beat-inactive with transparency
      ctx.lineWidth = 1
      ctx.beginPath()
      
      for (let x = 0; x < width; x += 2) {
        const y = height / 2 + Math.sin(x * 0.02) * Math.random() * (height * 0.2)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      return
    }

    // Draw actual waveform
    const samplesPerPixel = Math.max(1, Math.floor(waveformData.length / width))
    
    ctx.strokeStyle = 'oklch(0.8 0.25 340)' // accent color
    ctx.lineWidth = 1
    ctx.beginPath()

    for (let x = 0; x < width; x++) {
      const startSample = x * samplesPerPixel
      const endSample = Math.min(startSample + samplesPerPixel, waveformData.length)
      
      let maxAmplitude = 0
      for (let i = startSample; i < endSample; i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(waveformData[i]))
      }
      
      const y = height / 2
      const amplitude = maxAmplitude * height * 0.4
      
      if (x === 0) {
        ctx.moveTo(x, y - amplitude)
      } else {
        ctx.lineTo(x, y - amplitude)
      }
    }
    ctx.stroke()

    // Draw bottom half (mirrored)
    ctx.beginPath()
    for (let x = 0; x < width; x++) {
      const startSample = x * samplesPerPixel
      const endSample = Math.min(startSample + samplesPerPixel, waveformData.length)
      
      let maxAmplitude = 0
      for (let i = startSample; i < endSample; i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(waveformData[i]))
      }
      
      const y = height / 2
      const amplitude = maxAmplitude * height * 0.4
      
      if (x === 0) {
        ctx.moveTo(x, y + amplitude)
      } else {
        ctx.lineTo(x, y + amplitude)
      }
    }
    ctx.stroke()

    // Draw progress overlay
    const progress = duration > 0 ? currentTime / duration : 0
    const progressX = progress * width

    // Highlight played portion
    const gradient = ctx.createLinearGradient(0, 0, progressX, 0)
    gradient.addColorStop(0, 'oklch(0.7 0.3 330)') // primary
    gradient.addColorStop(1, 'oklch(0.8 0.25 340)') // accent

    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, progressX, height)
    
    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over'

    // Draw playhead
    ctx.strokeStyle = 'oklch(0.7 0.3 330)' // primary
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(progressX, 0)
    ctx.lineTo(progressX, height)
    ctx.stroke()

    // Add subtle glow to playhead
    ctx.shadowColor = 'oklch(0.7 0.3 330)'
    ctx.shadowBlur = 8
    ctx.stroke()
    ctx.shadowBlur = 0
  }, [waveformData, currentTime, duration])

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

  // Redraw when data changes
  useEffect(() => {
    drawWaveform()
  }, [drawWaveform])

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => drawWaveform()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawWaveform])

  return (
    <div 
      ref={containerRef}
      className="h-full w-full relative cursor-pointer"
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Time markers */}
      <div className="absolute inset-x-0 bottom-0 h-3 flex items-end text-xs text-muted-foreground pointer-events-none">
        {duration > 0 && Array.from({ length: 5 }, (_, i) => {
          const time = (duration / 4) * i
          const minutes = Math.floor(time / 60)
          const seconds = Math.floor(time % 60)
          return (
            <div 
              key={i} 
              className="absolute transform -translate-x-1/2"
              style={{ left: `${(i / 4) * 100}%` }}
            >
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
          )
        })}
      </div>
    </div>
  )
}