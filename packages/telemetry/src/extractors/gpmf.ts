import type { TelemetryFrame, TelemetryTrack } from "@velocity/shared"
import { nanoid } from "@velocity/shared"

interface GPMFStream {
  streams?: Record<
    string,
    {
      samples?: Array<{
        value: unknown
        cts?: number
        date?: string
      }>
    }
  >
}

export async function extractGPMF(
  mp4Buffer: ArrayBuffer,
  sourceFile: string
): Promise<TelemetryTrack | null> {
  try {
    // Dynamic import — gopro-telemetry is CommonJS
    const { default: goproTelemetry } = await import("gopro-telemetry")

    const rawData = await goproTelemetry(
      { rawData: Buffer.from(mp4Buffer) },
      {
        stream: ["GPS5", "ACCL", "GYRO", "CORI"],
        smooth: 1,
        debug: false,
      }
    ) as unknown as Record<string, GPMFStream>

    const frames = buildFrames(rawData)
    if (frames.length === 0) return null

    const first = frames[0]!
    const last = frames[frames.length - 1]!

    return {
      id: nanoid("tel_"),
      sourceFile,
      frames,
      sampleRate: estimateSampleRate(frames),
      duration: last.timestamp - first.timestamp,
      metadata: { source: "gpmf" },
    }
  } catch {
    return null
  }
}

function buildFrames(data: Record<string, GPMFStream>): TelemetryFrame[] {
  const frameMap = new Map<number, TelemetryFrame>()

  for (const [streamKey, streamData] of Object.entries(data)) {
    const streams = streamData.streams
    if (!streams) continue

    for (const [, stream] of Object.entries(streams)) {
      const samples = stream.samples ?? []

      for (const sample of samples) {
        const ts = sample.cts ?? 0
        const existing = frameMap.get(ts) ?? { timestamp: ts }

        const merged = mergeStreamSample(existing, streamKey, sample.value)
        frameMap.set(ts, merged)
      }
    }
  }

  return Array.from(frameMap.values()).sort((a, b) => a.timestamp - b.timestamp)
}

function mergeStreamSample(
  frame: TelemetryFrame,
  streamKey: string,
  value: unknown
): TelemetryFrame {
  const key = streamKey.toLowerCase()

  if (key.includes("gps")) {
    const gps = value as number[] | undefined
    if (Array.isArray(gps) && gps.length >= 3) {
      return {
        ...frame,
        latitude: gps[0],
        longitude: gps[1],
        altitude: gps[2],
        speed: gps[3],
        heading: gps[4],
      }
    }
  }

  if (key.includes("accl")) {
    const acc = value as number[] | undefined
    if (Array.isArray(acc) && acc.length >= 3) {
      const magnitude = Math.sqrt(acc[0]! ** 2 + acc[1]! ** 2 + acc[2]! ** 2) / 9.81
      return {
        ...frame,
        acceleration: { x: acc[0]!, y: acc[1]!, z: acc[2]! },
        gForce: magnitude,
      }
    }
  }

  if (key.includes("gyro")) {
    const gyro = value as number[] | undefined
    if (Array.isArray(gyro) && gyro.length >= 3) {
      return {
        ...frame,
        gyroscope: { x: gyro[0]!, y: gyro[1]!, z: gyro[2]! },
      }
    }
  }

  return frame
}

function estimateSampleRate(frames: TelemetryFrame[]): number {
  if (frames.length < 2) return 1
  const first = frames[0]!
  const last = frames[frames.length - 1]!
  const durationSec = (last.timestamp - first.timestamp) / 1000
  return durationSec > 0 ? frames.length / durationSec : 1
}
