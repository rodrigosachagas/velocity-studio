import { useState, useCallback } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { normalizeTelemetry, computeSpeed, computeLeanAngle } from "@velocity/telemetry"
import type { TelemetryTrack } from "@velocity/shared"

interface ExtractionState {
  isExtracting: boolean
  error: string | null
  progress: string | null
  track: TelemetryTrack | null
}

export function useTelemetryExtraction() {
  const [state, setState] = useState<ExtractionState>({
    isExtracting: false,
    error: null,
    progress: null,
    track: null,
  })

  const project = useProjectStore((s) => s.project)
  const setTelemetry = useProjectStore((s) => s.setTelemetry)

  const extract = useCallback(async () => {
    const video = project?.video
    if (!video) {
      setState((s) => ({ ...s, error: "No video loaded" }))
      return null
    }

    setState({ isExtracting: true, error: null, progress: "Detecting telemetry source...", track: null })

    try {
      let track: TelemetryTrack | null = null

      if (video.hasGPMF) {
        setState((s) => ({ ...s, progress: "Extracting GPMF data..." }))
        const { invoke } = await import("@tauri-apps/api/core")
        const rawBytes = await invoke<number[]>("extract_gpmf_raw", { path: video.path })
        const buffer = new Uint8Array(rawBytes).buffer

        const { extractGPMF } = await import("@velocity/telemetry")
        track = await extractGPMF(buffer, video.path)
      }

      if (!track) {
        setState((s) => ({ ...s, progress: "Trying ExifTool fallback..." }))
        const { extractExifTool } = await import("@velocity/telemetry")
        const { invoke } = await import("@tauri-apps/api/core")
        track = await extractExifTool(video.path, invoke as (cmd: string, args: Record<string, unknown>) => Promise<string>)
      }

      if (!track) {
        throw new Error("No telemetry data found in this video")
      }

      setState((s) => ({ ...s, progress: "Processing telemetry..." }))

      // Derive speed from GPS if not present
      const withSpeed = computeSpeed(track.frames)
      const withLean = computeLeanAngle(withSpeed)
      const trackWithDerived: TelemetryTrack = { ...track, frames: withLean }

      const normalized = normalizeTelemetry(trackWithDerived, {
        smooth: true,
        smoothWindow: 5,
        resample: true,
        targetFps: 30,
      })

      setTelemetry(normalized)
      setState({ isExtracting: false, error: null, progress: null, track: normalized })
      return normalized
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ isExtracting: false, error: message, progress: null, track: null })
      return null
    }
  }, [project?.video, setTelemetry])

  return { ...state, extract }
}
