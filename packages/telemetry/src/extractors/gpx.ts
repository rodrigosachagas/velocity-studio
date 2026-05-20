import type { TelemetryFrame, TelemetryTrack } from "@velocity/shared"
import { nanoid } from "@velocity/shared"

interface GPXPoint {
  lat: number
  lon: number
  ele?: number
  time?: number
}

/**
 * Parse a GPX file string into a TelemetryTrack.
 * Pure browser-compatible — no Tauri/Node required.
 */
export function parseGPX(gpxText: string, sourceFile = "gpx"): TelemetryTrack | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(gpxText, "application/xml")

    const parseError = doc.querySelector("parsererror")
    if (parseError) return null

    // Support both <trkpt> (track points) and <wpt> (waypoints)
    const pointEls = Array.from(doc.querySelectorAll("trkpt, rtept, wpt"))
    if (pointEls.length === 0) return null

    const points: GPXPoint[] = pointEls.map((el) => {
      const lat = parseFloat(el.getAttribute("lat") ?? "0")
      const lon = parseFloat(el.getAttribute("lon") ?? "0")
      const ele = parseFloat(el.querySelector("ele")?.textContent ?? "NaN")
      const timeStr = el.querySelector("time")?.textContent
      const time = timeStr ? Date.parse(timeStr) : undefined
      return { lat, lon, ele: isNaN(ele) ? undefined : ele, time }
    })

    // Normalize timestamps: use absolute epoch ms if available, else 100ms intervals
    let baseTime = points.find((p) => p.time !== undefined)?.time ?? 0
    const frames: TelemetryFrame[] = points.map((p, i) => {
      const ts = p.time ?? baseTime + i * 100
      return {
        timestamp: ts - (points[0]?.time ?? 0), // relative to start (ms)
        latitude: p.lat,
        longitude: p.lon,
        altitude: p.ele,
      }
    })

    // Compute speed from GPS positions
    const withSpeed = frames.map((frame, i) => {
      const prev = frames[i - 1]
      if (!prev || frame.latitude == null || frame.longitude == null) return frame
      if (prev.latitude == null || prev.longitude == null) return frame

      const dist = haversine(prev.latitude, prev.longitude, frame.latitude, frame.longitude)
      const dt = (frame.timestamp - prev.timestamp) / 1000
      const speed = dt > 0 ? dist / dt : 0
      return { ...frame, speed }
    })

    // Compute heading
    const withHeading = withSpeed.map((frame, i) => {
      const prev = withSpeed[i - 1]
      if (!prev || frame.latitude == null || frame.longitude == null) return frame
      if (prev.latitude == null || prev.longitude == null) return frame
      const heading = bearing(prev.latitude, prev.longitude, frame.latitude, frame.longitude)
      return { ...frame, heading }
    })

    const first = withHeading[0]!
    const last = withHeading[withHeading.length - 1]!
    const durationMs = last.timestamp - first.timestamp
    const sampleRate = durationMs > 0 ? withHeading.length / (durationMs / 1000) : 1

    return {
      id: nanoid("tel_"),
      sourceFile,
      frames: withHeading,
      sampleRate,
      duration: durationMs,
      metadata: { source: "gpx", pointCount: withHeading.length },
    }
  } catch {
    return null
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
