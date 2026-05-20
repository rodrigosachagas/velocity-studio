import { useState, useCallback } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { normalizeTelemetry, computeSpeed, computeLeanAngle, parseGPX, simulateTelemetry } from "@velocity/telemetry"
import type { TelemetryTrack } from "@velocity/shared"
import type { SimulationProfile } from "@velocity/telemetry"
import { isTauri } from "@/lib/tauri"

interface ExtractionState {
  isExtracting: boolean
  error: string | null
  progress: string | null
  track: TelemetryTrack | null
}

function normalize(track: TelemetryTrack): TelemetryTrack {
  const withSpeed = computeSpeed(track.frames)
  const withLean = computeLeanAngle(withSpeed)
  return normalizeTelemetry({ ...track, frames: withLean }, {
    smooth: true,
    smoothWindow: 5,
    resample: true,
    targetFps: 30,
  })
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

  // GPMF / ExifTool extraction — Tauri only
  const extract = useCallback(async () => {
    const video = project?.video
    if (!video) {
      setState((s) => ({ ...s, error: "No video loaded" }))
      return null
    }

    // This function uses Tauri IPC — bail early in browser mode
    if (!isTauri()) {
      setState((s) => ({ ...s, error: "Extração manual disponível apenas no app desktop." }))
      return null
    }

    setState({ isExtracting: true, error: null, progress: "Detectando fonte de telemetria...", track: null })

    try {
      let track: TelemetryTrack | null = null

      if (video.hasGPMF) {
        setState((s) => ({ ...s, progress: "Extraindo dados GPMF..." }))
        const { convertFileSrc } = await import("@tauri-apps/api/core")
        const assetUrl = convertFileSrc(video.path)
        const { extractGPMFFromUrl } = await import("@velocity/telemetry")
        track = await extractGPMFFromUrl(assetUrl, video.path)
      }

      if (!track) {
        setState((s) => ({ ...s, progress: "Tentando fallback ExifTool..." }))
        const { extractExifTool } = await import("@velocity/telemetry")
        const { invoke } = await import("@tauri-apps/api/core")
        track = await extractExifTool(video.path, invoke as (cmd: string, args: Record<string, unknown>) => Promise<string>)
      }

      if (!track) throw new Error("Nenhuma telemetria encontrada neste vídeo")

      setState((s) => ({ ...s, progress: "Processing telemetry..." }))
      const normalized = normalize(track)
      setTelemetry(normalized)
      setState({ isExtracting: false, error: null, progress: null, track: normalized })
      return normalized
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ isExtracting: false, error: message, progress: null, track: null })
      return null
    }
  }, [project?.video, setTelemetry])

  // GPX file import — browser-compatible
  const extractFromGPX = useCallback(async (file: File) => {
    setState({ isExtracting: true, error: null, progress: "Parsing GPX file...", track: null })
    try {
      const text = await file.text()
      const raw = parseGPX(text, file.name)
      if (!raw) throw new Error("Could not parse GPX file — check that it contains track points.")

      setState((s) => ({ ...s, progress: "Processing GPX data..." }))
      const normalized = normalize(raw)
      setTelemetry(normalized)
      setState({ isExtracting: false, error: null, progress: null, track: normalized })
      return normalized
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ isExtracting: false, error: message, progress: null, track: null })
      return null
    }
  }, [setTelemetry])

  // Simulation — always available
  const simulate = useCallback(async (profile: SimulationProfile = "road") => {
    const duration = project?.video?.duration ?? 60
    setState({ isExtracting: true, error: null, progress: "Generating simulation...", track: null })
    try {
      const raw = simulateTelemetry({ duration, fps: 30, profile })
      const normalized = normalize(raw)
      setTelemetry(normalized)
      setState({ isExtracting: false, error: null, progress: null, track: normalized })
      return normalized
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ isExtracting: false, error: message, progress: null, track: null })
      return null
    }
  }, [project?.video?.duration, setTelemetry])

  return { ...state, extract, extractFromGPX, simulate }
}
