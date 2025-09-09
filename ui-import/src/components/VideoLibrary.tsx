import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Upload, Play, Clock, FileVideo, X, CheckSquare, Square, MusicNote } from "@phosphor-icons/react"
import { useKV } from '@github/spark/hooks'
import { useRef, useState, useCallback, useEffect } from "react"

interface VideoItem {
  id: string
  name: string
  url: string
  duration: number
  size: number
  createdAt: number
  thumbnail?: string
  selected?: boolean
}

interface VideoFile {
  url: string
  name: string
  duration: number
}

export default function VideoLibrary() {
  const [videos, setVideos] = useKV<VideoItem[]>("video-library", [])
  const [currentVideo, setCurrentVideo] = useKV<VideoFile | null>("current-video", null)
  const [selectedAudio, setSelectedAudio] = useKV<string | null>("selected-audio", null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  // Fixed thumbnail size for consistent 2-column layout
  const thumbnailSize = 150
  
  // Calculate selected videos count
  const selectedCount = videos.filter(v => v.selected).length
  const allSelected = videos.length > 0 && selectedCount === videos.length

  // Handle audio file selection
  const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('audio/')) {
      const url = URL.createObjectURL(file)
      setSelectedAudio(url)
    }
    if (audioInputRef.current) {
      audioInputRef.current.value = ''
    }
  }

  // Toggle video selection
  const toggleVideoSelection = (videoId: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    setVideos(currentVideos => 
      currentVideos.map(v => 
        v.id === videoId ? { ...v, selected: !v.selected } : v
      )
    )
  }

  // Select all videos
  const toggleSelectAll = () => {
    const newState = !allSelected
    setVideos(currentVideos => 
      currentVideos.map(v => ({ ...v, selected: newState }))
    )
  }
  // Generate thumbnail from video
  const generateThumbnail = useCallback(async (video: HTMLVideoElement): Promise<string> => {
    return new Promise((resolve) => {
      video.currentTime = Math.min(video.duration * 0.1, 10) // 10% in or 10s max
      
      video.addEventListener('seeked', function onSeeked() {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        canvas.width = 160
        canvas.height = 160
        
        if (ctx) {
          // Calculate square crop from center of video
          const videoAspect = video.videoWidth / video.videoHeight
          let sourceX = 0, sourceY = 0, sourceSize = 0
          
          if (videoAspect > 1) {
            // Video is wider than tall - crop from center width
            sourceSize = video.videoHeight
            sourceX = (video.videoWidth - sourceSize) / 2
          } else {
            // Video is taller than wide - crop from center height  
            sourceSize = video.videoWidth
            sourceY = (video.videoHeight - sourceSize) / 2
          }
          
          ctx.drawImage(video, sourceX, sourceY, sourceSize, sourceSize, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        }
        
        video.removeEventListener('seeked', onSeeked)
      }, { once: true })
    })
  }, [])
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  // Format duration
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    setIsUploading(true)

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('video/')) continue

      try {
        const url = URL.createObjectURL(file)
        const video = document.createElement('video')
        
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = async () => {
            try {
              const thumbnail = await generateThumbnail(video)
              
              const videoItem: VideoItem = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                name: file.name,
                url,
                duration: video.duration,
                size: file.size,
                createdAt: Date.now(),
                thumbnail,
                selected: false
              }
              
              setVideos(currentVideos => [...currentVideos, videoItem])
              resolve()
            } catch (error) {
              reject(error)
            }
          }
          video.onerror = reject
          video.src = url
        })
      } catch (error) {
        console.error('Error processing video file:', error)
      }
    }

    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Select video for editing
  const selectVideo = (video: VideoItem) => {
    setCurrentVideo({
      url: video.url,
      name: video.name,
      duration: video.duration
    })
  }

  // Remove video from library
  const removeVideo = (videoId: string, event?: React.MouseEvent) => {
    event?.stopPropagation() // Prevent card selection when clicking remove
    setVideos(currentVideos => {
      const videoToRemove = currentVideos.find(v => v.id === videoId)
      const updatedVideos = currentVideos.filter(v => v.id !== videoId)
      // If the removed video was currently selected, clear selection
      if (currentVideo && videoToRemove && currentVideo.url === videoToRemove.url) {
        setCurrentVideo(null)
      }
      return updatedVideos
    })
  }

  return (
    <div className="h-full flex flex-col bg-card border-r border-panel-border min-w-0">
      <div className="p-4 border-b border-panel-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Video Library</h2>
        </div>
        
        {/* Select Audio Button */}
        <Button 
          className="w-full gap-2 mb-3 bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={() => audioInputRef.current?.click()}
        >
          <MusicNote size={16} />
          {selectedAudio ? 'Change Audio' : 'Select Audio'}
        </Button>
        <Input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          onChange={handleAudioUpload}
          className="hidden"
        />
        
        {/* Select All Button */}
        {videos.length > 0 && (
          <Button 
            variant="outline"
            className="w-full gap-2 mb-3"
            onClick={toggleSelectAll}
          >
            {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            {allSelected ? `Deselect All` : `Select All`}
            {selectedCount > 0 && ` (${selectedCount})`}
          </Button>
        )}
        
        <Button 
          className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload size={16} />
          {isUploading ? 'Importing...' : 'Import Videos'}
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
      
      <ScrollArea className="flex-1">
        <div 
          ref={containerRef}
          className="p-3 grid grid-cols-2 gap-1"
        >
          {videos.map((video) => (
            <div
              key={video.id}
              className={`relative cursor-pointer transition-all border rounded-md group overflow-hidden aspect-square ${
                currentVideo?.url === video.url 
                  ? 'bg-primary/10 border-primary/50 glow-primary' 
                  : video.selected
                  ? 'bg-accent/10 border-accent/50'
                  : 'hover:bg-muted/50 border-border/50 hover:border-accent/30'
              }`}
              onClick={() => selectVideo(video)}
              style={{ 
                width: `${thumbnailSize}px`,
                height: `${thumbnailSize}px`
              }}
            >
              {/* Selection checkbox */}
              <button
                onClick={(e) => toggleVideoSelection(video.id, e)}
                className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white rounded p-1"
              >
                {video.selected ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>

              {/* Remove button */}
              <button
                onClick={(e) => removeVideo(video.id, e)}
                className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-full p-1"
              >
                <X size={12} />
              </button>
              
              {video.thumbnail ? (
                <img 
                  src={video.thumbnail} 
                  alt={video.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                  <FileVideo size={Math.min(32, thumbnailSize * 0.3)} className="text-muted-foreground" />
                </div>
              )}
              
              {/* Play overlay on hover */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="bg-primary/90 rounded-full p-2">
                  <Play size={Math.min(20, thumbnailSize * 0.2)} className="text-primary-foreground ml-0.5" />
                </div>
              </div>
              
              {/* Duration badge */}
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                <Clock size={8} />
                {formatDuration(video.duration)}
              </div>
              
              {/* Current indicator */}
              {currentVideo?.url === video.url && (
                <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                  Current
                </div>
              )}

              {/* Selection indicator */}
              {video.selected && (
                <div className="absolute inset-0 bg-accent/20 border-2 border-accent rounded-md"></div>
              )}
            </div>
          ))}
          
          {/* Add more videos card */}
          <div 
            className="border-dashed border-2 border-muted cursor-pointer hover:border-accent/50 transition-colors flex items-center justify-center overflow-hidden aspect-square rounded-md"
            style={{ 
              width: `${thumbnailSize}px`,
              height: `${thumbnailSize}px`
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-center">
              <Plus className="mx-auto mb-2 text-muted-foreground" size={24} />
              <p className="text-xs text-muted-foreground">Add more</p>
            </div>
          </div>
          
          {/* Empty state */}
          {videos.length === 0 && (
            <div className="col-span-full text-center py-8">
              <FileVideo size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">No videos in your library</p>
              <p className="text-xs text-muted-foreground">
                Import video files to start creating beat-synced edits
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}