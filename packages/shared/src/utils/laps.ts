interface GPSFrame {
  timestamp: number
  latitude?: number
  longitude?: number
}

interface ValidFrame {
  timestamp: number
  latitude: number
  longitude: number
}

export interface StartFinishLine {
  lat: number
  lon: number
}

export interface LapInfo {
  lapNumber: number
  startMs: number
  endMs: number
  lapTimeMs: number
}

export interface LapSession {
  laps: LapInfo[]
  crossings: number[]
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180
  const dLon = (lon2 - lon1) * toRad
  const lat1r = lat1 * toRad
  const lat2r = lat2 * toRad
  const y = Math.sin(dLon) * Math.cos(lat2r)
  const x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

// Look back up to 5 frames to find one at least 2 m away — needed for a reliable bearing.
// Returns null if the kart is too slow or stopped (caller must accept the crossing unconditionally).
const BEARING_MIN_DIST_M = 2
const BEARING_LOOKBACK = 5

function lookBackBearing(valid: ValidFrame[], i: number): number | null {
  const curr = valid[i]!
  for (let k = 1; k <= BEARING_LOOKBACK && i - k >= 0; k++) {
    const prev = valid[i - k]!
    if (haversineMeters(prev.latitude, prev.longitude, curr.latitude, curr.longitude) >= BEARING_MIN_DIST_M) {
      return bearingDeg(prev.latitude, prev.longitude, curr.latitude, curr.longitude)
    }
  }
  return null
}

export function computeLaps(
  frames: GPSFrame[],
  startFinish: StartFinishLine,
  opts: { thresholdMeters?: number; minLapMs?: number } = {},
): LapSession {
  const { thresholdMeters = 30, minLapMs = 15_000 } = opts

  const valid = frames.filter(
    (f): f is ValidFrame => f.latitude != null && f.longitude != null,
  )
  if (valid.length < 2) return { laps: [], crossings: [] }

  const crossings: number[] = []
  let inZone = false
  let lastCrossingMs = -Infinity
  let refBearing: number | null = null

  for (let i = 0; i < valid.length; i++) {
    const f = valid[i]!
    const d = haversineMeters(f.latitude, f.longitude, startFinish.lat, startFinish.lon)
    if (d < thresholdMeters) {
      if (!inZone && f.timestamp - lastCrossingMs > minLapMs) {
        const bearing = lookBackBearing(valid, i)

        // Accept crossing when:
        // • bearing can't be computed (kart slow/stopped) — always accept
        // • no reference direction yet (first crossing) — always accept, then lock direction
        // • heading is within ±90° of the reference direction
        const dirOk =
          bearing === null ||
          refBearing === null ||
          angleDiff(bearing, refBearing) <= 90

        if (dirOk) {
          if (refBearing === null && bearing !== null) {
            refBearing = bearing
          }
          crossings.push(f.timestamp)
          lastCrossingMs = f.timestamp
          inZone = true
        }
      }
    } else {
      inZone = false
    }
  }

  const laps: LapInfo[] = crossings.slice(0, -1).map((startMs, i) => ({
    lapNumber: i + 1,
    startMs,
    endMs: crossings[i + 1]!,
    lapTimeMs: crossings[i + 1]! - startMs,
  }))

  return { laps, crossings }
}

export interface CurrentLapState {
  lapNumber: number
  elapsedMs: number
  lastLapTimeMs: number | null
  bestLapTimeMs: number | null
  totalLaps: number
}

export function getCurrentLapState(session: LapSession, currentMs: number): CurrentLapState {
  const { laps, crossings } = session

  let lapNumber = 0
  let lapStartMs = crossings[0] ?? currentMs

  for (let i = 0; i < crossings.length; i++) {
    if (currentMs >= crossings[i]!) {
      lapNumber = i + 1
      lapStartMs = crossings[i]!
    }
  }

  const elapsedMs = lapNumber > 0 ? Math.max(0, currentMs - lapStartMs) : 0
  const completedBefore = laps.filter((l) => l.endMs <= currentMs)
  const lastLap = completedBefore[completedBefore.length - 1]
  const bestLap =
    completedBefore.length > 0
      ? completedBefore.reduce((b, l) => (l.lapTimeMs < b.lapTimeMs ? l : b), completedBefore[0]!)
      : null

  return {
    lapNumber,
    elapsedMs,
    lastLapTimeMs: lastLap?.lapTimeMs ?? null,
    bestLapTimeMs: bestLap?.lapTimeMs ?? null,
    totalLaps: laps.length,
  }
}

// ─── Multi-lap consensus track ───────────────────────────────────────────────

/** Resamples a lat/lon polyline to `n` uniformly-spaced points along its arc length. */
function arcLengthResample(
  pts: { lat: number; lon: number }[],
  n: number,
): { lat: number; lon: number }[] {
  if (pts.length < 2 || n < 2) return pts

  // Build cumulative distance array
  const cum: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1]! + haversineMeters(pts[i - 1]!.lat, pts[i - 1]!.lon, pts[i]!.lat, pts[i]!.lon))
  }
  const total = cum[cum.length - 1]!
  if (total === 0) return pts

  const result: { lat: number; lon: number }[] = []
  let j = 0
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total
    // Advance to the segment that contains this distance
    while (j < cum.length - 2 && cum[j + 1]! < target) j++
    const segLen = cum[j + 1]! - cum[j]!
    const t = segLen > 0 ? (target - cum[j]!) / segLen : 0
    result.push({
      lat: pts[j]!.lat + t * (pts[j + 1]!.lat - pts[j]!.lat),
      lon: pts[j]!.lon + t * (pts[j + 1]!.lon - pts[j]!.lon),
    })
  }
  return result
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

export interface ConsensusTrack {
  /** Consensus lat/lon points (arc-length resampled, then median across laps). */
  points: { lat: number; lon: number }[]
  /** Number of complete laps used to build the consensus. */
  lapCount: number
}

/**
 * Builds a high-fidelity circuit outline from multiple GPS laps.
 *
 * Each complete lap is arc-length resampled to `n` uniform points, then the
 * median lat/lon is computed at every position. With 3+ laps, random GPS noise
 * cancels out and the result closely follows the actual circuit geometry.
 *
 * Falls back gracefully to a single-lap trace when only one lap is available.
 */
export function buildConsensusTrack(
  frames: GPSFrame[],
  startFinish: StartFinishLine,
  opts: { n?: number } = {},
): ConsensusTrack | null {
  const { n = 600 } = opts

  const valid = frames.filter((f): f is ValidFrame => f.latitude != null && f.longitude != null)
  if (valid.length < 2) return null

  const session = computeLaps(valid, startFinish)
  if (session.laps.length === 0) return null

  // Extract lat/lon for each complete lap
  const lapTracks = session.laps
    .map((lap) =>
      valid
        .filter((f) => f.timestamp >= lap.startMs && f.timestamp <= lap.endMs)
        .map((f) => ({ lat: f.latitude, lon: f.longitude })),
    )
    .filter((track) => track.length >= 4)

  if (lapTracks.length === 0) return null

  const resampled = lapTracks.map((track) => arcLengthResample(track, n))

  if (resampled.length === 1) {
    return { points: resampled[0]!, lapCount: 1 }
  }

  // Median lat/lon at each of the n positions across all laps
  const points = Array.from({ length: n }, (_, i) => {
    const lats = resampled.map((lap) => lap[i]!.lat).sort((a, b) => a - b)
    const lons = resampled.map((lap) => lap[i]!.lon).sort((a, b) => a - b)
    return { lat: median(lats), lon: median(lons) }
  })

  return { points, lapCount: lapTracks.length }
}

export function formatLapTime(ms: number): string {
  const totalSec = ms / 1000
  const min = Math.floor(totalSec / 60)
  const sec = Math.floor(totalSec % 60)
  const cent = Math.floor((ms % 1000) / 10)
  return `${min}:${sec.toString().padStart(2, "0")}.${cent.toString().padStart(2, "0")}`
}
