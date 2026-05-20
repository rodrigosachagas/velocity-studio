import type { TelemetryFrame } from "../types/telemetry"

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return a + diff * t
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function interpolateTelemetryAt(
  frames: TelemetryFrame[],
  timestamp: number
): TelemetryFrame | null {
  if (frames.length === 0) return null
  if (timestamp <= (frames[0]?.timestamp ?? 0)) return frames[0] ?? null
  if (timestamp >= (frames[frames.length - 1]?.timestamp ?? 0))
    return frames[frames.length - 1] ?? null

  let lo = 0
  let hi = frames.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if ((frames[mid]?.timestamp ?? 0) <= timestamp) lo = mid
    else hi = mid
  }

  const a = frames[lo]
  const b = frames[hi]
  if (!a || !b) return a ?? b ?? null

  const t = (timestamp - a.timestamp) / (b.timestamp - a.timestamp)

  // For each numeric field: if both neighbours have the value, interpolate.
  // If only one neighbour has it, use that value (no undefined→0 fallback).
  const num = (av: number | undefined, bv: number | undefined, useLerp = true): number | undefined => {
    if (av !== undefined && bv !== undefined) return useLerp ? lerp(av, bv, t) : av
    return av ?? bv
  }

  return {
    timestamp,
    speed:    num(a.speed, b.speed),
    altitude: num(a.altitude, b.altitude),
    latitude: num(a.latitude, b.latitude),
    longitude: num(a.longitude, b.longitude),
    heading:
      a.heading !== undefined && b.heading !== undefined
        ? lerpAngle(a.heading, b.heading, t)
        : (a.heading ?? b.heading),
    gForce:    num(a.gForce, b.gForce),
    leanAngle: num(a.leanAngle, b.leanAngle),
    acceleration:
      a.acceleration && b.acceleration
        ? {
            x: lerp(a.acceleration.x, b.acceleration.x, t),
            y: lerp(a.acceleration.y, b.acceleration.y, t),
            z: lerp(a.acceleration.z, b.acceleration.z, t),
          }
        : (a.acceleration ?? b.acceleration),
    gyroscope:
      a.gyroscope && b.gyroscope
        ? {
            x: lerp(a.gyroscope.x, b.gyroscope.x, t),
            y: lerp(a.gyroscope.y, b.gyroscope.y, t),
            z: lerp(a.gyroscope.z, b.gyroscope.z, t),
          }
        : (a.gyroscope ?? b.gyroscope),
  }
}

export function smoothTelemetry(
  frames: TelemetryFrame[],
  windowSize: number = 5
): TelemetryFrame[] {
  if (frames.length < windowSize) return frames

  return frames.map((frame, i) => {
    const half = Math.floor(windowSize / 2)
    const start = Math.max(0, i - half)
    const end = Math.min(frames.length - 1, i + half)
    const window = frames.slice(start, end + 1)
    const count = window.length

    const avg = <T extends number | undefined>(
      key: keyof TelemetryFrame
    ): T => {
      const vals = window
        .map((f) => f[key])
        .filter((v): v is number => typeof v === "number")
      if (vals.length === 0) return frame[key] as T
      return (vals.reduce((a, b) => a + b, 0) / vals.length) as T
    }

    return {
      ...frame,
      speed: avg("speed"),
      altitude: avg("altitude"),
      heading: avg("heading"),
      gForce: avg("gForce"),
      leanAngle: avg("leanAngle"),
    }
  })
}

export function resampleTelemetry(
  frames: TelemetryFrame[],
  targetFps: number
): TelemetryFrame[] {
  if (frames.length < 2) return frames

  const first = frames[0]!
  const last = frames[frames.length - 1]!
  const duration = last.timestamp - first.timestamp
  const interval = 1000 / targetFps
  const count = Math.floor(duration / interval)

  return Array.from({ length: count }, (_, i) => {
    const ts = first.timestamp + i * interval
    return interpolateTelemetryAt(frames, ts) ?? { timestamp: ts }
  })
}
