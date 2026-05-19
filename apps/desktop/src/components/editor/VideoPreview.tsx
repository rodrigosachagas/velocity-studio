import { useRef, useEffect } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { useTimelineStore } from "@velocity/timeline"

export function VideoPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const project = useProjectStore((s) => s.project)
  const blobUrl = useProjectStore((s) => s.videoBlobUrl)
  const currentTime = useTimelineStore((s) => s.currentTime)
  const isPlaying = useTimelineStore((s) => s.isPlaying)

  // Seek when timeline changes (only if delta > 1 frame @ 30fps to avoid loop)
  useEffect(() => {
    const video = videoRef.current
    if (!video || isPlaying) return
    if (Math.abs(video.currentTime - currentTime) > 0.04) {
      video.currentTime = currentTime
    }
  }, [currentTime, isPlaying])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [isPlaying])

  // Prefer blobUrl (browser mode) over Tauri asset protocol
  const videoSrc = blobUrl
    ?? (project?.video?.path ? `https://asset.localhost/${project.video.path}` : undefined)

  if (!project?.video || !videoSrc) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <p className="text-white/20 text-sm">Nenhum vídeo carregado</p>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      key={videoSrc}
      className="absolute inset-0 w-full h-full object-cover bg-black"
      src={videoSrc}
      playsInline
      muted
      preload="auto"
    />
  )
}
