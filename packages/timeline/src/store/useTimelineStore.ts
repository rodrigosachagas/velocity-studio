import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { TimelineEngine } from "../engine/TimelineEngine"
import type { TimelineState, TimelineLayer } from "@velocity/shared"

interface TimelineStore {
  engine: TimelineEngine | null
  state: TimelineState | null
  currentTime: number
  currentFrame: number
  isPlaying: boolean
  fps: number

  initEngine: (initialState?: Partial<TimelineState>, fps?: number) => void
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (time: number) => void
  seekToFrame: (frame: number) => void
  stepForward: (frames?: number) => void
  stepBackward: (frames?: number) => void
  setZoom: (level: number) => void
  addLayer: (layer: Omit<TimelineLayer, "id">) => TimelineLayer | null
  removeLayer: (layerId: string) => void
  setDuration: (duration: number) => void
  destroy: () => void
}

export const useTimelineStore = create<TimelineStore>()(
  subscribeWithSelector((set, get) => ({
    engine: null,
    state: null,
    currentTime: 0,
    currentFrame: 0,
    isPlaying: false,
    fps: 30,

    initEngine: (initialState, fps = 30) => {
      const existing = get().engine
      if (existing) existing.destroy()

      const engine = new TimelineEngine(initialState, fps)

      const unsubTime = engine.on("timeUpdate", ({ time }) => {
        set({ currentTime: time })
      })
      const unsubFrame = engine.on("frameUpdate", ({ frame }) => {
        set({ currentFrame: frame })
      })
      const unsubPlay = engine.on("playbackStart", () => set({ isPlaying: true }))
      const unsubStop = engine.on("playbackStop", () => set({ isPlaying: false }))

      set({ engine, fps, state: engine.getState() as TimelineState })

      return () => {
        unsubTime()
        unsubFrame()
        unsubPlay()
        unsubStop()
      }
    },

    play: () => get().engine?.play(),
    pause: () => get().engine?.pause(),
    toggle: () => get().engine?.toggle(),
    seek: (time) => get().engine?.seek(time),
    seekToFrame: (frame) => get().engine?.seekToFrame(frame),
    stepForward: (frames) => get().engine?.stepForward(frames),
    stepBackward: (frames) => get().engine?.stepBackward(frames),
    setZoom: (level) => get().engine?.setZoom(level),
    setDuration: (duration) => get().engine?.setDuration(duration),

    addLayer: (layer) => get().engine?.addLayer(layer) ?? null,
    removeLayer: (layerId) => get().engine?.removeLayer(layerId),

    destroy: () => {
      get().engine?.destroy()
      set({ engine: null, state: null })
    },
  }))
)
