import type { TelemetryFrame, TelemetryTrack } from "@velocity/shared"
import { nanoid } from "@velocity/shared"
import { extractGPMFBytesFromFile, extractGPMFBytesFromUrl } from "./mp4-demux"

// gopro-telemetry with repeatSticky:true merges sticky fields directly onto each sample
interface GPMFSample {
  value: unknown
  cts?: number
  date?: string
  // GPS quality — present directly when repeatSticky:true
  fix?: number
  precision?: number
  // Legacy: present when repeatSticky:false
  sticky?: { fix?: number; precision?: number }
}

interface GPMFStreamData {
  samples?: GPMFSample[]
  units?: string[]
}

interface GPMFDevice {
  streams?: Record<string, GPMFStreamData>
}

export async function extractGPMF(
  gpmfBuffer: ArrayBuffer,
  sourceFile: string
): Promise<TelemetryTrack | null> {
  try {
    const { default: goproTelemetry } = await import("gopro-telemetry")

    // Uint8Array works in both Node.js and browser WebView (no Buffer polyfill needed)
    const rawData = new Uint8Array(gpmfBuffer)

    const result = await goproTelemetry(
      { rawData },
      {
        stream: ["GPS5", "GPS9", "ACCL", "GYRO"],
        // repeatSticky:true → fix/precision appear on every sample directly (not nested in sticky)
        repeatSticky: true,
        smooth: 1,
        debug: false,
      }
    ) as unknown as Record<string, GPMFDevice>

    const frames = buildFrames(result)
    if (frames.length === 0) return null

    // GPS5 runs at 18 Hz; ACCL/GYRO run at ~200 Hz.
    // Most frames are IMU-only and have no speed/position.
    // Forward-fill (then backward-fill) GPS fields so that every frame has speed
    // before resampling — otherwise the interpolator hits undefined and widgets show 0.
    const filledFrames = fillGPSGaps(frames)
    const withHeading = addHeading(filledFrames)
    const first = withHeading[0]!
    const last = withHeading[withHeading.length - 1]!

    return {
      id: nanoid("tel_"),
      sourceFile,
      frames: withHeading,
      sampleRate: estimateSampleRate(withHeading),
      duration: last.timestamp - first.timestamp,
      metadata: { source: "gpmf" },
    }
  } catch (err) {
    console.error("[GPMF] extraction failed:", err)
    return null
  }
}

/**
 * Browser-compatible GPMF extractor that reads directly from a File object.
 * Uses a minimal MP4 demuxer to locate the GoPro MET track without ffmpeg.
 */
export async function extractGPMFFromFile(file: File): Promise<TelemetryTrack | null> {
  try {
    const bytes = await extractGPMFBytesFromFile(file)
    if (!bytes || bytes.length < 8) return null
    return extractGPMF(bytes.buffer as ArrayBuffer, file.name)
  } catch (err) {
    console.error("[GPMF] browser extraction failed:", err)
    return null
  }
}

/**
 * GPMF extractor that reads from a URL using HTTP Range requests.
 * Works with Tauri asset:// URLs — no ffmpeg needed, same fast path as the browser.
 */
export async function extractGPMFFromUrl(url: string, sourceFile: string): Promise<TelemetryTrack | null> {
  try {
    const bytes = await extractGPMFBytesFromUrl(url)
    if (!bytes || bytes.length < 8) return null
    return extractGPMF(bytes.buffer as ArrayBuffer, sourceFile)
  } catch (err) {
    console.error("[GPMF] URL extraction failed:", err)
    return null
  }
}

function buildFrames(data: Record<string, GPMFDevice>): TelemetryFrame[] {
  const frameMap = new Map<number, TelemetryFrame>()

  for (const [, device] of Object.entries(data)) {
    const streams = device.streams
    if (!streams) continue

    for (const [streamName, stream] of Object.entries(streams)) {
      const samples = stream.samples ?? []

      for (const sample of samples) {
        const ts = Math.round(sample.cts ?? 0)
        const existing = frameMap.get(ts) ?? { timestamp: ts }
        const merged = mergeStreamSample(existing, streamName, sample)
        frameMap.set(ts, merged)
      }
    }
  }

  return Array.from(frameMap.values()).sort((a, b) => a.timestamp - b.timestamp)
}

function mergeStreamSample(
  frame: TelemetryFrame,
  streamName: string,
  sample: GPMFSample,
): TelemetryFrame {
  const key = streamName.toUpperCase()

  if (key === "GPS5" || key === "GPS9") {
    const gps = sample.value as number[] | undefined
    if (!Array.isArray(gps) || gps.length < 4) return frame

    // GPS quality — with repeatSticky:true these are flat on the sample
    const fix = sample.fix ?? sample.sticky?.fix
    const prec = sample.precision ?? sample.sticky?.precision

    // Require at least 2D fix; skip 9999 precision (no signal)
    if (fix !== undefined && fix < 2) return frame
    if (prec !== undefined && prec > 800) return frame

    return {
      ...frame,
      latitude: gps[0],
      longitude: gps[1],
      altitude: gps[2],
      speed: gps[3],   // 2D GPS speed in m/s
      // gps[4] is 3D speed — heading computed separately from positions
    }
  }

  if (key === "ACCL") {
    const acc = sample.value as number[] | undefined
    if (!Array.isArray(acc) || acc.length < 3) return frame
    // Planar g-force: lateral (x) + longitudinal (z) only.
    // Excluding y-axis so gravity (~9.81 m/s² at rest) doesn't inflate the reading.
    return {
      ...frame,
      acceleration: { x: acc[0]!, y: acc[1]!, z: acc[2]! },
      gForce: Math.sqrt(acc[0]! ** 2 + acc[2]! ** 2) / 9.81,
    }
  }

  if (key === "GYRO") {
    const gyro = sample.value as number[] | undefined
    if (!Array.isArray(gyro) || gyro.length < 3) return frame
    return {
      ...frame,
      gyroscope: { x: gyro[0]!, y: gyro[1]!, z: gyro[2]! },
    }
  }

  return frame
}

/**
 * Propagate GPS fields (speed, lat, lon, alt) from GPS frames to adjacent IMU-only
 * frames so that every frame has a speed value before resampling.
 *
 * Without this, ACCL/GYRO frames (200 Hz) between GPS frames (18 Hz) have
 * speed=undefined, and the resampler interpolates undefined→undefined, causing
 * widgets to flicker between 0 and the real value.
 */
function fillGPSGaps(frames: TelemetryFrame[]): TelemetryFrame[] {
  type GPSFields = Pick<TelemetryFrame, "speed" | "latitude" | "longitude" | "altitude">

  // Forward pass — carry last known GPS values forward
  let last: GPSFields | null = null
  const forwarded = frames.map((f): TelemetryFrame => {
    if (f.speed !== undefined) {
      last = { speed: f.speed, latitude: f.latitude, longitude: f.longitude, altitude: f.altitude }
      return f
    }
    return last !== null ? { ...f, ...last } : f
  })

  // Backward pass — fill frames before the very first GPS reading
  let first: GPSFields | null = null
  for (const f of forwarded) {
    if (f.speed !== undefined) { first = { speed: f.speed, latitude: f.latitude, longitude: f.longitude, altitude: f.altitude }; break }
  }
  if (first === null) return forwarded

  return forwarded.map((f) => (f.speed !== undefined ? f : { ...f, ...first! }))
}

function addHeading(frames: TelemetryFrame[]): TelemetryFrame[] {
  return frames.map((f, i) => {
    if (i === 0) return f
    const prev = frames[i - 1]!
    if (f.latitude == null || f.longitude == null ||
        prev.latitude == null || prev.longitude == null) return f

    const dLon = ((f.longitude - prev.longitude) * Math.PI) / 180
    const phi1 = (prev.latitude * Math.PI) / 180
    const phi2 = (f.latitude * Math.PI) / 180
    const y = Math.sin(dLon) * Math.cos(phi2)
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon)
    return { ...f, heading: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 }
  })
}

function estimateSampleRate(frames: TelemetryFrame[]): number {
  if (frames.length < 2) return 1
  const first = frames[0]!
  const last = frames[frames.length - 1]!
  const durationSec = (last.timestamp - first.timestamp) / 1000
  return durationSec > 0 ? frames.length / durationSec : 1
}
