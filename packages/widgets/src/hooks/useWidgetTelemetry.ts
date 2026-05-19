import { useMemo } from "react"
import type { TelemetryFrame, TelemetryTrack } from "@velocity/shared"
import { interpolateTelemetryAt } from "@velocity/shared"

export function useWidgetTelemetry(
  track: TelemetryTrack | undefined,
  currentTime: number
): TelemetryFrame | null {
  return useMemo(() => {
    if (!track || track.frames.length === 0) return null
    return interpolateTelemetryAt(track.frames, currentTime * 1000)
  }, [track, currentTime])
}
