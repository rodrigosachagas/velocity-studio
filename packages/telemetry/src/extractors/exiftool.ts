import type { TelemetryFrame, TelemetryTrack } from "@velocity/shared"
import { nanoid } from "@velocity/shared"

interface ExifGPSData {
  GPSLatitude?: string
  GPSLongitude?: string
  GPSAltitude?: string
  GPSSpeed?: string
  GPSTrack?: string
  GPSDateTime?: string
  GPSTimeStamp?: string
  GPSDateStamp?: string
  Duration?: string
}

/**
 * Parse ExifTool JSON output (already fetched by the caller via Tauri invoke).
 * The app layer is responsible for invoking `extract_exif` — this function
 * only handles parsing of the resulting JSON string.
 */
export function parseExifToolOutput(jsonString: string, sourceFile: string): TelemetryTrack | null {
  let records: ExifGPSData[]
  try {
    records = JSON.parse(jsonString) as ExifGPSData[]
  } catch {
    return null
  }

  if (!records || records.length === 0) return null

  const frames = parseExifGPS(records)
  if (frames.length === 0) return null

  const first = frames[0]!
  const last = frames[frames.length - 1]!

  return {
    id: nanoid("tel_"),
    sourceFile,
    frames,
    sampleRate: estimateSampleRate(frames),
    duration: last.timestamp - first.timestamp,
    metadata: { source: "exiftool" },
  }
}

/**
 * Convenience alias — the caller must provide an `invokeFn` that calls the Tauri backend.
 * In the desktop app, pass `(cmd, args) => invoke(cmd, args)` from `@tauri-apps/api/core`.
 */
export async function extractExifTool(
  filePath: string,
  invokeFn: (cmd: string, args: Record<string, unknown>) => Promise<string>
): Promise<TelemetryTrack | null> {
  try {
    const result = await invokeFn("extract_exif", { path: filePath })
    return parseExifToolOutput(result, filePath)
  } catch {
    return null
  }
}

function parseExifGPS(records: ExifGPSData[]): TelemetryFrame[] {
  let baseTime: number | null = null

  return records
    .map((record, i) => {
      const ts = parseTimestamp(record) ?? (baseTime !== null ? baseTime + i * 100 : i * 100)
      if (i === 0) baseTime = ts

      const frame: TelemetryFrame = { timestamp: ts }

      if (record.GPSLatitude) frame.latitude = parseDMS(record.GPSLatitude)
      if (record.GPSLongitude) frame.longitude = parseDMS(record.GPSLongitude)
      if (record.GPSAltitude) frame.altitude = parseFloat(record.GPSAltitude)
      if (record.GPSSpeed) frame.speed = parseFloat(record.GPSSpeed) / 3.6
      if (record.GPSTrack) frame.heading = parseFloat(record.GPSTrack)

      return frame
    })
    .filter((f) => f.latitude !== undefined || f.longitude !== undefined)
}

function parseDMS(value: string): number | undefined {
  const match = /^(\d+) deg (\d+)' ([\d.]+)" ([NSEW])$/.exec(value)
  if (!match) return parseFloat(value)
  const [, d, m, s, dir] = match
  const decimal = parseInt(d!) + parseInt(m!) / 60 + parseFloat(s!) / 3600
  return dir === "S" || dir === "W" ? -decimal : decimal
}

function parseTimestamp(record: ExifGPSData): number | null {
  const dt = record.GPSDateTime
  if (dt) {
    const parsed = Date.parse(dt.replace(":", "-").replace(":", "-"))
    if (!isNaN(parsed)) return parsed
  }
  return null
}

function estimateSampleRate(frames: TelemetryFrame[]): number {
  if (frames.length < 2) return 1
  const first = frames[0]!
  const last = frames[frames.length - 1]!
  const durationSec = (last.timestamp - first.timestamp) / 1000
  return durationSec > 0 ? frames.length / durationSec : 1
}
