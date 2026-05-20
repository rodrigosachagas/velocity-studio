import { useRef, useEffect, useState } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { useTimelineStore } from "@velocity/timeline"
import { useAppStore } from "@/store/useAppStore"

export function VideoPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number | null>(null)
  const project = useProjectStore((s) => s.project)
  const blobUrl = useProjectStore((s) => s.videoBlobUrl)
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const currentTime = useTimelineStore((s) => s.currentTime)
  const setVideoCurrentTime = useAppStore((s) => s.setVideoCurrentTime)

  // RAF loop: poll video.currentTime and push it to the shared store
  // This is the single source of truth for widget telemetry interpolation
  useEffect(() => {
    const loop = () => {
      const t = videoRef.current?.currentTime ?? 0
      setVideoCurrentTime(t)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [setVideoCurrentTime])

  // Play / pause video based on timeline state
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [isPlaying])

  // Seek video when timeline scrubs while paused
  useEffect(() => {
    const video = videoRef.current
    if (!video || isPlaying) return
    if (Math.abs(video.currentTime - currentTime) > 0.04) {
      video.currentTime = currentTime
    }
  }, [currentTime, isPlaying])

  // In Tauri, convertFileSrc builds the correct asset:// URL for the current platform.
  // In browser mode, blobUrl is always set so the fallback is never reached.
  // In Tauri mode, convertFileSrc handles path encoding and platform differences.
  // We set it via useEffect to avoid calling dynamic imports during render.
  const [tauriSrc, setTauriSrc] = useState<string | undefined>()
  useEffect(() => {
    const path = project?.video?.path
    if (blobUrl || !path || !("__TAURI_INTERNALS__" in window)) {
      setTauriSrc(undefined)
      return
    }
    import("@tauri-apps/api/core")
      .then(({ convertFileSrc }) => setTauriSrc(convertFileSrc(path)))
      .catch(() => setTauriSrc(undefined))
  }, [blobUrl, project?.video?.path])

  const videoSrc = blobUrl ?? tauriSrc

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
