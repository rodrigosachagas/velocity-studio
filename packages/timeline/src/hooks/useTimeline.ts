import { useEffect, useRef } from "react"
import { useTimelineStore } from "../store/useTimelineStore"
import type { TimelineState } from "@velocity/shared"

export function useTimeline(initialState?: Partial<TimelineState>, fps = 30) {
  const initEngine = useTimelineStore((s) => s.initEngine)
  const destroy = useTimelineStore((s) => s.destroy)
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initEngine(initialState, fps)
      initialized.current = true
    }
    return () => destroy()
  }, [])

  return useTimelineStore((s) => ({
    currentTime: s.currentTime,
    currentFrame: s.currentFrame,
    isPlaying: s.isPlaying,
    fps: s.fps,
    play: s.play,
    pause: s.pause,
    toggle: s.toggle,
    seek: s.seek,
    seekToFrame: s.seekToFrame,
    stepForward: s.stepForward,
    stepBackward: s.stepBackward,
    setZoom: s.setZoom,
    addLayer: s.addLayer,
    removeLayer: s.removeLayer,
    setDuration: s.setDuration,
  }))
}

export function useCurrentTime() {
  return useTimelineStore((s) => s.currentTime)
}

export function useCurrentFrame() {
  return useTimelineStore((s) => s.currentFrame)
}

export function useIsPlaying() {
  return useTimelineStore((s) => s.isPlaying)
}
