import type { TelemetryFrame, TelemetryTrack } from "@velocity/shared"
import { nanoid } from "@velocity/shared"

export type SimulationProfile = "road" | "mountain" | "track" | "cycling" | "walking"

export interface SimOptions {
  duration: number      // seconds
  fps?: number
  profile?: SimulationProfile
  startLat?: number
  startLon?: number
  startAlt?: number
}

const PROFILES: Record<SimulationProfile, { maxSpeed: number; accel: number; altRange: number }> = {
  road:     { maxSpeed: 33,  accel: 0.15, altRange: 50  },  // ~120 kmh
  mountain: { maxSpeed: 22,  accel: 0.08, altRange: 300 },  // ~80 kmh, big alt swings
  track:    { maxSpeed: 55,  accel: 0.25, altRange: 10  },  // ~200 kmh track day
  cycling:  { maxSpeed: 11,  accel: 0.05, altRange: 80  },  // ~40 kmh
  walking:  { maxSpeed: 2.2, accel: 0.03, altRange: 20  },  // ~8 kmh
}

/**
 * Generate realistic-looking synthetic telemetry from a video duration.
 * Uses overlapping sine waves with noise to mimic real GPS + IMU data.
 */
export function simulateTelemetry(opts: SimOptions): TelemetryTrack {
  const {
    duration,
    fps = 30,
    profile = "road",
    startLat = -23.561,
    startLon = -46.656,
    startAlt = 760,
  } = opts

  const p = PROFILES[profile]
  const totalFrames = Math.ceil(duration * fps)
  const intervalMs = 1000 / fps

  let lat = startLat
  let lon = startLon
  let heading = 30
  let currentSpeed = 0

  const frames: TelemetryFrame[] = Array.from({ length: totalFrames }, (_, i) => {
    const t = i / fps
    const progress = t / duration

    // Speed: sinusoidal with multiple harmonics to feel organic
    const targetSpeed =
      p.maxSpeed *
      (0.3 + 0.4 * Math.abs(Math.sin(t * 0.15 + 0.5)) +
       0.2 * Math.abs(Math.sin(t * 0.4 + 1.2)) +
       0.1 * Math.abs(Math.sin(t * 1.1))) *
      // Slow acceleration at start, slow brake near end
      Math.min(1, Math.min(progress * 8, (1 - progress) * 8))

    // Smooth speed change
    currentSpeed += (targetSpeed - currentSpeed) * p.accel
    currentSpeed = Math.max(0, currentSpeed)

    // Heading: slow gentle curves
    const headingDelta =
      3.0 * Math.sin(t * 0.08) +
      1.5 * Math.sin(t * 0.22 + 0.7) +
      0.3 * Math.sin(t * 0.85)
    heading = (heading + headingDelta + 360) % 360

    // Move GPS position based on speed + heading
    const distPerFrame = currentSpeed / fps
    const headRad = (heading * Math.PI) / 180
    lat += (distPerFrame * Math.cos(headRad)) / 111320
    lon += (distPerFrame * Math.sin(headRad)) / (111320 * Math.cos((lat * Math.PI) / 180))

    // Altitude: smooth undulation
    const altitude =
      startAlt +
      p.altRange * (0.5 * Math.sin(t * 0.05) + 0.3 * Math.sin(t * 0.12 + 1) + 0.2 * Math.sin(t * 0.28))

    // Acceleration (IMU simulation)
    const braking = headingDelta * 0.02
    const longAcc = (targetSpeed - currentSpeed) * 0.3
    const latAcc = Math.sin(headRad) * currentSpeed * 0.04 * headingDelta
    const gForce = Math.sqrt(longAcc ** 2 + latAcc ** 2 + 1) / 9.81 + 0.9

    const leanAngle = Math.atan2(latAcc, 9.81) * (180 / Math.PI)

    return {
      timestamp: i * intervalMs,
      speed: currentSpeed,
      altitude,
      latitude: lat,
      longitude: lon,
      heading,
      gForce: Math.min(gForce, 3.5),
      leanAngle,
      acceleration: {
        x: latAcc,
        y: longAcc,
        z: 9.81 + braking,
      },
      gyroscope: {
        x: headingDelta * 0.02,
        y: Math.sin(t * 0.5) * 0.1,
        z: longAcc * 0.05,
      },
    }
  })

  return {
    id: nanoid("tel_sim_"),
    sourceFile: "simulated",
    frames,
    sampleRate: fps,
    duration: duration * 1000,
    metadata: { source: "simulated", profile },
  }
}
