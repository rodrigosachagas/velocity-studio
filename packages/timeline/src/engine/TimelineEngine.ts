import type { TimelineState, TimelineLayer, TimelineClip } from "@velocity/shared"
import { nanoid } from "@velocity/shared"

export type TimelineEngineEvent =
  | { type: "timeUpdate"; time: number }
  | { type: "playbackStart" }
  | { type: "playbackStop" }
  | { type: "seek"; time: number }
  | { type: "frameUpdate"; frame: number; fps: number }

type EventListener<T extends TimelineEngineEvent["type"]> = (
  event: Extract<TimelineEngineEvent, { type: T }>
) => void

export class TimelineEngine {
  private state: TimelineState
  private rafId: number | null = null
  private lastTimestamp: number | null = null
  private listeners = new Map<string, Set<EventListener<TimelineEngineEvent["type"]>>>()
  private fps: number

  constructor(initialState: Partial<TimelineState> = {}, fps = 30) {
    this.fps = fps
    this.state = {
      duration: 0,
      currentTime: 0,
      playbackRate: 1,
      isPlaying: false,
      zoomLevel: 1,
      scrollOffset: 0,
      layers: [],
      snapEnabled: true,
      snapThreshold: 0.1,
      ...initialState,
    }
  }

  on<T extends TimelineEngineEvent["type"]>(type: T, listener: EventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener as unknown as EventListener<TimelineEngineEvent["type"]>)
    return () => this.listeners.get(type)?.delete(listener as unknown as EventListener<TimelineEngineEvent["type"]>)
  }

  private emit(event: TimelineEngineEvent): void {
    this.listeners.get(event.type)?.forEach((l) => l(event as never))
  }

  getState(): Readonly<TimelineState> {
    return this.state
  }

  play(): void {
    if (this.state.isPlaying) return
    if (this.state.currentTime >= this.state.duration) {
      this.seek(0)
    }
    this.state = { ...this.state, isPlaying: true }
    this.lastTimestamp = null
    this.tick()
    this.emit({ type: "playbackStart" })
  }

  pause(): void {
    if (!this.state.isPlaying) return
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.state = { ...this.state, isPlaying: false }
    this.emit({ type: "playbackStop" })
  }

  toggle(): void {
    if (this.state.isPlaying) this.pause()
    else this.play()
  }

  seek(time: number): void {
    const clamped = Math.max(0, Math.min(time, this.state.duration))
    this.state = { ...this.state, currentTime: clamped }
    this.emit({ type: "seek", time: clamped })
    this.emit({ type: "timeUpdate", time: clamped })
    this.emit({ type: "frameUpdate", frame: this.timeToFrame(clamped), fps: this.fps })
  }

  seekToFrame(frame: number): void {
    this.seek(this.frameToTime(frame))
  }

  stepForward(frames = 1): void {
    this.seek(this.state.currentTime + this.frameToTime(frames))
  }

  stepBackward(frames = 1): void {
    this.seek(this.state.currentTime - this.frameToTime(frames))
  }

  setDuration(duration: number): void {
    this.state = { ...this.state, duration }
  }

  setPlaybackRate(rate: number): void {
    this.state = { ...this.state, playbackRate: rate }
  }

  setZoom(level: number): void {
    this.state = { ...this.state, zoomLevel: Math.max(0.1, Math.min(10, level)) }
  }

  addLayer(layer: Omit<TimelineLayer, "id">): TimelineLayer {
    const newLayer: TimelineLayer = { id: nanoid("layer_"), ...layer }
    this.state = { ...this.state, layers: [...this.state.layers, newLayer] }
    return newLayer
  }

  removeLayer(layerId: string): void {
    this.state = {
      ...this.state,
      layers: this.state.layers.filter((l) => l.id !== layerId),
    }
  }

  addClip(layerId: string, clip: Omit<TimelineClip, "id" | "layerId">): TimelineClip | null {
    const layer = this.state.layers.find((l) => l.id === layerId)
    if (!layer) return null

    const newClip: TimelineClip = { id: nanoid("clip_"), layerId, ...clip }
    const updatedLayer: TimelineLayer = { ...layer, clips: [...layer.clips, newClip] }
    this.state = {
      ...this.state,
      layers: this.state.layers.map((l) => (l.id === layerId ? updatedLayer : l)),
    }
    return newClip
  }

  snapTime(time: number): number {
    if (!this.state.snapEnabled) return time
    const { snapThreshold } = this.state
    const snapPoints = this.getSnapPoints()
    for (const point of snapPoints) {
      if (Math.abs(time - point) < snapThreshold) return point
    }
    return time
  }

  private getSnapPoints(): number[] {
    const points: number[] = [0, this.state.duration]
    for (const layer of this.state.layers) {
      for (const clip of layer.clips) {
        points.push(clip.startTime, clip.endTime)
      }
    }
    return points
  }

  timeToFrame(time: number): number {
    return Math.floor(time * this.fps)
  }

  frameToTime(frame: number): number {
    return frame / this.fps
  }

  getCurrentFrame(): number {
    return this.timeToFrame(this.state.currentTime)
  }

  destroy(): void {
    this.pause()
    this.listeners.clear()
  }

  private tick = (): void => {
    this.rafId = requestAnimationFrame((timestamp) => {
      if (!this.state.isPlaying) return

      if (this.lastTimestamp !== null) {
        const delta = ((timestamp - this.lastTimestamp) / 1000) * this.state.playbackRate
        const nextTime = this.state.currentTime + delta

        if (nextTime >= this.state.duration) {
          this.state = { ...this.state, currentTime: this.state.duration, isPlaying: false }
          this.emit({ type: "timeUpdate", time: this.state.duration })
          this.emit({ type: "playbackStop" })
          return
        }

        this.state = { ...this.state, currentTime: nextTime }
        this.emit({ type: "timeUpdate", time: nextTime })
        this.emit({
          type: "frameUpdate",
          frame: this.timeToFrame(nextTime),
          fps: this.fps,
        })
      }

      this.lastTimestamp = timestamp
      this.tick()
    })
  }
}
