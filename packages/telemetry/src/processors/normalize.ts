import type { TelemetryFrame, TelemetryTrack } from "@velocity/shared"
import { smoothTelemetry, resampleTelemetry } from "@velocity/shared"

export interface NormalizeOptions {
  smooth?: boolean
  smoothWindow?: number
  resample?: boolean
  targetFps?: number
  offsetMs?: number
}

export function normalizeTelemetry(
  track: TelemetryTrack,
  options: NormalizeOptions = {}
): TelemetryTrack {
  const { smooth = true, smoothWindow = 5, resample = true, targetFps = 30, offsetMs = 0 } =
    options

  let frames = track.frames

  if (offsetMs !== 0) {
    frames = frames.map((f) => ({ ...f, timestamp: f.timestamp + offsetMs }))
  }

  frames = deduplicateFrames(frames)
  frames = frames.sort((a, b) => a.timestamp - b.timestamp)

  if (smooth) {
    frames = smoothTelemetry(frames, smoothWindow)
  }

  if (resample) {
    frames = resampleTelemetry(frames, targetFps)
  }

  const first = frames[0]
  const last = frames[frames.length - 1]

  return {
    ...track,
    frames,
    sampleRate: targetFps,
    duration: first && last ? last.timestamp - first.timestamp : track.duration,
  }
}

function deduplicateFrames(frames: TelemetryFrame[]): TelemetryFrame[] {
  const seen = new Set<number>()
  return frames.filter((f) => {
    if (seen.has(f.timestamp)) return false
    seen.add(f.timestamp)
    return true
  })
}

export function computeSpeed(frames: TelemetryFrame[]): TelemetryFrame[] {
  return frames.map((frame, i) => {
    if (frame.speed !== undefined) return frame

    const prev = frames[i - 1]
    if (!prev || frame.latitude === undefined || frame.longitude === undefined) return frame
    if (prev.latitude === undefined || prev.longitude === undefined) return frame

    const dist = haversineDistance(prev.latitude, prev.longitude, frame.latitude, frame.longitude)
    const dt = (frame.timestamp - prev.timestamp) / 1000
    const speed = dt > 0 ? dist / dt : 0

    return { ...frame, speed }
  })
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function computeLeanAngle(frames: TelemetryFrame[]): TelemetryFrame[] {
  return frames.map((frame) => {
    if (frame.leanAngle !== undefined) return frame
    if (!frame.acceleration) return frame

    const { x, y, z } = frame.acceleration
    const lean = (Math.atan2(x, Math.sqrt(y ** 2 + z ** 2)) * 180) / Math.PI

    return { ...frame, leanAngle: lean }
  })
}
