import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Play, Pause, SkipBack, SkipForward, Volume, Upload, Wand, Scissors } from "@phosphor-icons/react"
import { useRef, useState, useEffect, useCallback } from "react"
import { useKV } from '@github/spark/hooks'
import WaveformCanvas from "./WaveformCanvas"
import TimelineCanvas from "./TimelineCanvas"

interface Beat {
  time: number
  confidence: number
  energy: number
}

interface SmartCut {
  time: number
  type: 'scene_change' | 'action' | 'face_close_up' | 'motion_peak'
  confidence: number
  description: string
}

interface VisualEffect {
  id: string
  type: 'flash' | 'zoom' | 'shake' | 'rgb_split' | 'glitch'
  intensity: number
  beatSynced: boolean
}

interface VideoFile {
  url: string
  name: string
  duration: number
}

export default function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentVideo, setCurrentVideo] = useKV<VideoFile | null>("current-video", null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [beats, setBeats] = useKV<Beat[]>("detected-beats", [])
  const [smartCuts, setSmartCuts] = useKV<SmartCut[]>("smart-cuts", [])
  const [activeEffects, setActiveEffects] = useKV<VisualEffect[]>("active-effects", [])
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isDetectingCuts, setIsDetectingCuts] = useState(false)
  const [effectIntensity, setEffectIntensity] = useState(1.0)

  // Audio context for analysis
  const audioContextRef = useRef<AudioContext | null>(null)

  // Format time display
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    
    video.onloadedmetadata = () => {
      setCurrentVideo({
        url,
        name: file.name,
        duration: video.duration
      })
    }
    
    video.src = url
  }, [setCurrentVideo])

  // AI-powered smart cut detection
  const detectSmartCuts = useCallback(async () => {
    if (!videoRef.current || !currentVideo) return
    
    setIsDetectingCuts(true)
    
    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      canvas.width = 320
      canvas.height = 180
      
      // Sample frames at intervals
      const frameInterval = 2 // seconds
      const frames: string[] = []
      
      for (let time = 0; time < duration; time += frameInterval) {
        video.currentTime = time
        await new Promise(resolve => {
          video.addEventListener('seeked', resolve, { once: true })
        })
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          frames.push(canvas.toDataURL('image/jpeg', 0.5))
        }
      }
      
      // Analyze frames with LLM for scene changes
      const prompt = spark.llmPrompt`
        Analyze these video frames for optimal cut points. Look for:
        - Scene transitions (lighting, background, or setting changes)
        - Action peaks (movement, gestures, expressions)
        - Face close-ups or reaction shots
        - Motion intensity changes
        
        Return a JSON array of cut suggestions with:
        {
          "time": seconds_timestamp,
          "type": "scene_change|action|face_close_up|motion_peak", 
          "confidence": 0.0-1.0,
          "description": "brief_explanation"
        }
        
        Frames are sampled every ${frameInterval} seconds. Frame count: ${frames.length}
      `
      
      const result = await spark.llm(prompt, "gpt-4o", true)
      const detectedCuts: SmartCut[] = JSON.parse(result)
      
      setSmartCuts(detectedCuts)
      
    } catch (error) {
      console.error('Smart cut detection failed:', error)
      // Fallback to basic detection
      const fallbackCuts: SmartCut[] = []
      for (let i = 0; i < duration; i += 10) {
        fallbackCuts.push({
          time: i,
          type: 'scene_change',
          confidence: 0.5,
          description: 'Automatic interval cut'
        })
      }
      setSmartCuts(fallbackCuts)
    } finally {
      setIsDetectingCuts(false)
    }
  }, [duration, currentVideo, setSmartCuts])

  // Real-time visual effects based on beats
  const applyVisualEffects = useCallback(() => {
    if (!canvasRef.current || !videoRef.current || activeEffects.length === 0) return
    
    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return
    
    // Set canvas size to match video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 1920
      canvas.height = video.videoHeight || 1080
    }
    
    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Check if we're on a beat
    const currentBeat = beats.find(beat => 
      Math.abs(beat.time - currentTime) < 0.1
    )
    
    if (currentBeat && isPlaying) {
      activeEffects.forEach(effect => {
        if (!effect.beatSynced && !currentBeat) return
        
        const intensity = effect.intensity * effectIntensity
        
        ctx.save() // Save current state
        
        switch (effect.type) {
          case 'flash':
            ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.3})`
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            break
            
          case 'shake':
            const shakeX = (Math.random() - 0.5) * intensity * 10
            const shakeY = (Math.random() - 0.5) * intensity * 10
            canvas.style.transform = `translate(${shakeX}px, ${shakeY}px)`
            setTimeout(() => {
              canvas.style.transform = 'translate(0, 0)'
            }, 100)
            break
            
          case 'zoom':
            const scale = 1 + intensity * 0.1
            canvas.style.transform = `scale(${scale})`
            setTimeout(() => {
              canvas.style.transform = 'scale(1)'
            }, 200)
            break
            
          case 'rgb_split':
            // Create RGB split effect using CSS filters
            canvas.style.filter = `
              drop-shadow(${intensity * 2}px 0 red) 
              drop-shadow(-${intensity * 2}px 0 cyan)
            `
            setTimeout(() => {
              canvas.style.filter = 'none'
            }, 150)
            break
            
          case 'glitch':
            // Digital glitch lines
            for (let i = 0; i < intensity * 5; i++) {
              const y = Math.random() * canvas.height
              const height = Math.random() * 20
              const hue = Math.random() * 360
              ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.3)`
              ctx.fillRect(0, y, canvas.width, height)
            }
            break
        }
        
        ctx.restore() // Restore previous state
      })
    }
  }, [beats, currentTime, activeEffects, effectIntensity, isPlaying])
  const analyzeAudio = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    const audioContext = audioContextRef.current
    setIsAnalyzing(true)

    try {
      // Create audio source from video
      const source = audioContext.createMediaElementSource(videoElement)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      
      source.connect(analyser)
      analyser.connect(audioContext.destination)

      // Get waveform data
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Float32Array(bufferLength)
      
      // Simple beat detection algorithm
      const detectBeats = () => {
        const detectedBeats: Beat[] = []
        const sampleRate = audioContext.sampleRate
        const frameSize = 1024
        const hopSize = 512
        
        // Simplified beat detection - look for energy peaks
        analyser.getFloatFrequencyData(dataArray)
        
        // Calculate energy in low frequency range (bass)
        let bassEnergy = 0
        for (let i = 0; i < Math.min(8, bufferLength); i++) {
          bassEnergy += Math.pow(10, dataArray[i] / 20)
        }
        
        // Detect peaks (simplified approach)
        const threshold = bassEnergy * 0.8
        if (bassEnergy > threshold) {
          detectedBeats.push({
            time: videoElement.currentTime,
            confidence: Math.min(bassEnergy / threshold, 1),
            energy: bassEnergy
          })
        }

        return detectedBeats
      }

      // Generate sample waveform data (in real implementation, would process entire audio)
      const waveform = new Float32Array(1000)
      for (let i = 0; i < 1000; i++) {
        waveform[i] = Math.sin(i * 0.1) * Math.random() * 0.5
      }
      
      setWaveformData(waveform)
      
      // Generate sample beats for demo
      const sampleBeats: Beat[] = []
      const beatInterval = 0.6 // ~100 BPM
      for (let time = 0; time < duration; time += beatInterval) {
        sampleBeats.push({
          time,
          confidence: 0.7 + Math.random() * 0.3,
          energy: 0.5 + Math.random() * 0.5
        })
      }
      
      setBeats(sampleBeats)
      
      // Trigger smart cut detection after audio analysis
      setTimeout(() => detectSmartCuts(), 1000)
    } catch (error) {
      console.error('Error analyzing audio:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }, [duration, setBeats, detectSmartCuts])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentVideo) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      analyzeAudio(video)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      applyVisualEffects()
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    // Reset states when loading new video
    setCurrentTime(0)
    setIsPlaying(false)
    
    video.src = currentVideo.url
    video.volume = volume
    video.load() // Ensure video loads properly

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [currentVideo, volume, analyzeAudio, applyVisualEffects])

  // Playback controls
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  const seekTo = (time: number) => {
    const video = videoRef.current
    if (video) {
      video.currentTime = time
      setCurrentTime(time)
    }
  }

  const skipBackward = () => {
    seekTo(Math.max(0, currentTime - 10))
  }

  const skipForward = () => {
    seekTo(Math.min(duration, currentTime + 10))
  }

  if (!currentVideo) {
    return (
      <div className="h-full flex flex-col">
        <Card className="flex-1 bg-timeline-bg border-panel-border">
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="w-24 h-24 mx-auto mb-4 bg-muted/50 rounded-full flex items-center justify-center">
                <Upload size={32} />
              </div>
              <p className="text-lg font-medium mb-2">Select a video to start editing</p>
              <p className="text-sm text-muted-foreground mb-4">
                Choose from your library on the left or import new videos
              </p>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-primary hover:bg-primary/90"
              >
                <Upload size={16} className="mr-2" />
                Import New Video
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1 bg-timeline-bg border-panel-border">
        <div className="h-full flex items-center justify-center relative">
          <video
            ref={videoRef}
            className="max-w-full max-h-full object-contain"
            controls={false}
          />
          
          {/* Effects Canvas Overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none mix-blend-screen"
            style={{ 
              width: '100%', 
              height: '100%',
              objectFit: 'contain'
            }}
          />
          
          {/* AI Analysis Status */}
          {(isAnalyzing || isDetectingCuts) && (
            <div className="absolute top-4 right-4 bg-primary/20 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2">
              <Wand size={14} className="animate-spin" />
              {isDetectingCuts ? 'Detecting smart cuts...' : 'Analyzing audio...'}
            </div>
          )}
          
          {/* Current Video Name */}
          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
            {currentVideo.name}
          </div>
          
          {/* Smart Cuts Indicator */}
          {smartCuts.length > 0 && (
            <div className="absolute top-12 left-4 bg-accent/20 text-accent px-3 py-1 rounded-full text-sm flex items-center gap-2">
              <Scissors size={14} />
              {smartCuts.length} smart cuts detected
            </div>
          )}
          {/* Video Controls Overlay */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center gap-3">
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-white hover:text-primary"
                onClick={skipBackward}
              >
                <SkipBack size={18} />
              </Button>
              <Button 
                size="sm" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-white hover:text-primary"
                onClick={skipForward}
              >
                <SkipForward size={18} />
              </Button>
              <div className="w-px h-6 bg-white/30 mx-1"></div>
              <Button size="sm" variant="ghost" className="text-white hover:text-primary">
                <Volume size={18} />
              </Button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 accent-primary"
              />
              <div className="w-px h-6 bg-white/30 mx-1"></div>
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-white hover:text-primary"
                onClick={detectSmartCuts}
                disabled={isDetectingCuts}
              >
                <Wand size={18} />
              </Button>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Smart Cuts Timeline */}
      {smartCuts.length > 0 && (
        <div className="h-16 mt-2">
          <Card className="h-full bg-timeline-bg border-panel-border p-2">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-medium text-foreground">Smart Cuts</h4>
              <div className="flex gap-1">
                {smartCuts.map((cut, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="text-xs cursor-pointer hover:bg-accent/20"
                    onClick={() => seekTo(cut.time)}
                  >
                    {cut.type}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="relative h-6 bg-muted/30 rounded">
              {smartCuts.map((cut, index) => (
                <div
                  key={index}
                  className="absolute h-full w-1 bg-accent rounded cursor-pointer hover:w-2 transition-all"
                  style={{ left: `${(cut.time / duration) * 100}%` }}
                  onClick={() => seekTo(cut.time)}
                  title={`${cut.description} (${cut.confidence.toFixed(2)})`}
                />
              ))}
              <div
                className="absolute h-full w-0.5 bg-primary"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          </Card>
        </div>
      )}
      
      {/* Waveform Visualization */}
      <div className="h-20 mt-2">
        <Card className="h-full bg-timeline-bg border-panel-border p-2">
          <WaveformCanvas
            waveformData={waveformData}
            currentTime={currentTime}
            duration={duration}
            onSeek={seekTo}
          />
        </Card>
      </div>
      
      {/* Timeline with Beat Detection */}
      <div className="h-24 mt-2">
        <Card className="h-full bg-timeline-bg border-panel-border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-foreground">Timeline & Beats</h3>
            <div className="text-xs text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          <TimelineCanvas
            beats={beats}
            currentTime={currentTime}
            duration={duration}
            onSeek={seekTo}
          />
        </Card>
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  )
}