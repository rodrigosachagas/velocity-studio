import type { TelemetryFrame, TelemetryTrack } from "@velocity/shared"
import { smoothTelemetry, resampleTelemetry } from "@velocity/shared"

export interface NormalizeOptions {
  smooth?: boolean
  smoothWindow?: number
  resample?: boolean
  targetFps?: number
  offsetMs?: number
  /** Max plausible speed in m/s — default 100 (360 kph) */
  maxSpeedMs?: number
  /** Max plausible acceleration in m/s² — default 20 (~2g) */
  maxAccelMs2?: number
  /** Zero out speeds below this threshold (GPS drift) — default 0.3 m/s (~1 kph) */
  lowSpeedThresholdMs?: number
}

export function normalizeTelemetry(
  track: TelemetryTrack,
  options: NormalizeOptions = {}
): TelemetryTrack {
  const {
    smooth = true,
    smoothWindow = 5,
    resample = true,
    targetFps = 30,
    offsetMs = 0,
    maxSpeedMs = 100,
    maxAccelMs2 = 20,
    lowSpeedThresholdMs = 0.3,
  } = options

  let frames = track.frames

  if (offsetMs !== 0) {
    frames = frames.map((f) => ({ ...f, timestamp: f.timestamp + offsetMs }))
  }

  frames = deduplicateFrames(frames)
  frames = frames.sort((a, b) => a.timestamp - b.timestamp)

  // Remove physically impossible speed spikes before any smoothing
  frames = filterSpeedOutliers(frames, maxSpeedMs, maxAccelMs2)
  frames = clampLowSpeed(frames, lowSpeedThresholdMs)

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

/**
 * Remove GPS speed spikes that are physically impossible.
 * Strategy: median filter (window 3) then plausibility clamp.
 * Handles:
 *   - Hard cap at maxSpeedMs (e.g. 100 m/s = 360 kph)
 *   - Acceleration clamp: speed change > maxAccelMs2 × Δt → clamp to previous
 *   - Isolated spikes: if a single sample is >> neighbours, replace with neighbour avg
 */
export function filterSpeedOutliers(
  frames: TelemetryFrame[],
  maxSpeedMs = 100,
  maxAccelMs2 = 20
): TelemetryFrame[] {
  if (frames.length < 3) return frames

  // Pass 1: hard cap + isolated spike removal (median-of-3)
  const pass1 = frames.map((f, i) => {
    if (f.speed === undefined) return f
    let s = f.speed

    // Hard cap
    if (s > maxSpeedMs) s = frames[i - 1]?.speed ?? 0

    // Isolated spike: compare to neighbours
    const prev = frames[i - 1]?.speed
    const next = frames[i + 1]?.speed
    if (prev !== undefined && next !== undefined) {
      const median = [prev, s, next].sort((a, b) => a - b)[1]!
      // If this value is > 3× the median of the triplet and > 5 m/s above both neighbours
      if (s > median * 2 && s - prev > 5 && s - next > 5) {
        s = (prev + next) / 2
      }
    }

    return s === f.speed ? f : { ...f, speed: s }
  })

  // Pass 2: acceleration plausibility clamp
  const pass2: TelemetryFrame[] = []
  for (let i = 0; i < pass1.length; i++) {
    const f = pass1[i]!
    if (f.speed === undefined || i === 0) {
      pass2.push(f)
      continue
    }
    const prev = pass2[i - 1]!
    if (prev.speed === undefined) { pass2.push(f); continue }

    const dt = (f.timestamp - prev.timestamp) / 1000 // seconds
    if (dt <= 0) { pass2.push(f); continue }

    const maxDelta = maxAccelMs2 * dt
    const actualDelta = Math.abs(f.speed - prev.speed)

    if (actualDelta > maxDelta) {
      // Clamp the speed to the max physically plausible change
      const sign = f.speed > prev.speed ? 1 : -1
      pass2.push({ ...f, speed: prev.speed + sign * maxDelta })
    } else {
      pass2.push(f)
    }
  }

  return pass2
}

/**
 * Zero out speeds below threshold to remove GPS drift noise when stationary.
 * GPS chips report ~0.2–0.5 m/s "movement" even when completely stopped.
 */
export function clampLowSpeed(
  frames: TelemetryFrame[],
  thresholdMs = 0.3
): TelemetryFrame[] {
  return frames.map((f) =>
    f.speed !== undefined && f.speed < thresholdMs
      ? { ...f, speed: 0 }
      : f
  )
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
