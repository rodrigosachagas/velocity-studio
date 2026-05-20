import type { VideoSegment } from "../types/segment"
import type { TelemetryTrack } from "../types/telemetry"

// GoPro filename: GH{chapter:02}{recording:04}.MP4 or GX{chapter:02}{recording:04}.MP4
export function goProSortKey(name: string): number {
  const m = name.match(/^G[HX](\d{2})(\d{4})\./i)
  if (!m) return Infinity
  const chapter = parseInt(m[1]!, 10)
  const recording = parseInt(m[2]!, 10)
  return recording * 1000 + chapter
}

export function sortAndTimestampSegments(segments: VideoSegment[]): VideoSegment[] {
  const sorted = [...segments].sort((a, b) => goProSortKey(a.name) - goProSortKey(b.name))
  let cursor = 0
  return sorted.map((seg, i) => {
    const s = { ...seg, order: i, startGlobalTime: cursor }
    cursor += seg.duration
    return s
  })
}

export function mergeSegmentTelemetries(
  segments: VideoSegment[],
  telemetries: Record<string, TelemetryTrack>,
): TelemetryTrack | null {
  const sorted = [...segments].sort((a, b) => a.order - b.order)
  const allFrames = []
  let totalDuration = 0

  for (const seg of sorted) {
    const track = telemetries[seg.id]
    if (!track || track.frames.length === 0) continue

    const firstTs = track.frames[0]!.timestamp
    const offsetMs = seg.startGlobalTime * 1000

    for (const frame of track.frames) {
      allFrames.push({ ...frame, timestamp: frame.timestamp - firstTs + offsetMs })
    }
    totalDuration = seg.startGlobalTime + seg.duration
  }

  if (allFrames.length === 0) return null

  const firstTrack = Object.values(telemetries)[0]
  return {
    id: "merged",
    sourceFile: sorted.map((s) => s.name).join("+"),
    frames: allFrames,
    sampleRate: firstTrack?.sampleRate ?? 18,
    duration: totalDuration,
    metadata: firstTrack?.metadata,
  }
}

export function segmentAtTime(segments: VideoSegment[], globalTimeSec: number): VideoSegment | null {
  const sorted = [...segments].sort((a, b) => a.order - b.order)
  for (const seg of sorted) {
    if (globalTimeSec >= seg.startGlobalTime && globalTimeSec < seg.startGlobalTime + seg.duration) {
      return seg
    }
  }
  // Clamp to last segment if at/past end
  const last = sorted[sorted.length - 1]
  if (last && globalTimeSec >= last.startGlobalTime) {
    return last
  }
  return null
}

export function localTimeInSegment(seg: VideoSegment, globalTimeSec: number): number {
  return Math.max(0, globalTimeSec - seg.startGlobalTime)
}

export function totalSegmentsDuration(segments: VideoSegment[]): number {
  return segments.reduce((sum, s) => sum + s.duration, 0)
}
