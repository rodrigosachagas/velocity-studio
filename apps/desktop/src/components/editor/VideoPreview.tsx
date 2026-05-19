import { useRef, useEffect } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { useTimelineStore } from "@velocity/timeline"

export function VideoPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const project = useProjectStore((s) => s.project)
  const currentTime = useTimelineStore((s) => s.currentTime)
  const isPlaying = useTimelineStore((s) => s.isPlaying)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (Math.abs(video.currentTime - currentTime) > 0.1) {
      video.currentTime = currentTime
    }
  }, [currentTime])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) video.play().catch(() => {})
    else video.pause()
  }, [isPlaying])

  if (!project?.video) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <div className="text-white/20 text-sm">No video loaded</div>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 w-full h-full object-cover"
      src={project.video.path ? `https://asset.localhost/${project.video.path}` : undefined}
      playsInline
      muted
      preload="auto"
    />
  )
}
