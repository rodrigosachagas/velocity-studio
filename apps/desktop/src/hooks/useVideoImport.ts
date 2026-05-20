import { useState, useCallback } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { useAppStore } from "@/store/useAppStore"
import { nanoid } from "@velocity/shared"
import type { VideoFile } from "@velocity/shared"
import { isTauri, probeVideoElement, openBrowserFilePicker } from "@/lib/tauri"
import { simulateTelemetry, normalizeTelemetry, computeSpeed, computeLeanAngle, extractGPMFFromFile } from "@velocity/telemetry"

interface ImportState {
  isImporting: boolean
  error: string | null
  progress: string | null
}

export function useVideoImport() {
  const [state, setState] = useState<ImportState>({
    isImporting: false,
    error: null,
    progress: null,
  })

  const setVideo = useProjectStore((s) => s.setVideo)
  const setTelemetry = useProjectStore((s) => s.setTelemetry)
  const createProject = useProjectStore((s) => s.createProject)
  const project = useProjectStore((s) => s.project)

  // Generate demo telemetry immediately after a non-GPMF video loads
  const autoSimulate = useCallback((duration: number) => {
    try {
      const raw = simulateTelemetry({ duration, fps: 30, profile: "road" })
      const withSpeed = computeSpeed(raw.frames)
      const withLean = computeLeanAngle(withSpeed)
      const normalized = normalizeTelemetry({ ...raw, frames: withLean }, {
        smooth: true, smoothWindow: 5, resample: true, targetFps: 30,
      })
      setTelemetry(normalized)
    } catch {
      // silent — simulation failure shouldn't block video import
    }
  }, [setTelemetry])

  /** Import from a native file path — only works inside Tauri.
   *  blobUrlOverride: optional blob URL created from a File object (drag-drop case).
   *  When provided, the video element uses it directly (no asset protocol needed). */
  const importFromPath = useCallback(async (filePath: string, blobUrlOverride?: string): Promise<VideoFile | null> => {
    setState({ isImporting: true, error: null, progress: "Lendo metadados..." })
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      const probeResult = await invoke<{
        path: string; duration: number; fps: number
        width: number; height: number; codec: string
        bitrate?: number; has_gpmf: boolean
      }>("probe_video", { path: filePath })

      const fileName = filePath.split("/").pop() ?? filePath.split("\\").pop() ?? filePath

      // GoPro filename pattern: treat as GPMF candidate even if probe missed the stream
      const looksLikeGoPro = /^(GH|GX|GL|GP|GOPR)/i.test(fileName)
      const hasGPMF = probeResult.has_gpmf || looksLikeGoPro

      const videoFile: VideoFile = {
        metadata: {
          id: nanoid("vid_"),
          path: filePath,
          name: fileName,
          size: 0,
          duration: probeResult.duration,
          fps: probeResult.fps,
          width: probeResult.width,
          height: probeResult.height,
          codec: probeResult.codec,
          bitrate: probeResult.bitrate,
          hasGPMF,
        },
        // Use blob URL for video playback when available (drag-drop provides it)
        blobUrl: blobUrlOverride,
      }

      if (!project) createProject()
      setVideo(videoFile)
      useAppStore.getState().setView("editor")

      if (hasGPMF) {
        setState({ isImporting: false, error: null, progress: "Extraindo telemetria GPMF..." })
        try {
          const { convertFileSrc } = await import("@tauri-apps/api/core")
          const assetUrl = convertFileSrc(filePath)
          const { extractGPMFFromUrl, computeSpeed, computeLeanAngle, normalizeTelemetry } = await import("@velocity/telemetry")
          const track = await extractGPMFFromUrl(assetUrl, filePath)
          if (track && track.frames.length > 0) {
            const withSpeed = computeSpeed(track.frames)
            const withLean = computeLeanAngle(withSpeed)
            const normalized = normalizeTelemetry({ ...track, frames: withLean }, {
              smooth: true, smoothWindow: 5, resample: true, targetFps: 30,
            })
            setTelemetry(normalized)
          } else {
            setState({ isImporting: false, error: "GPMF encontrado mas sem frames GPS. Usando simulação.", progress: null })
            autoSimulate(probeResult.duration)
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          setState({ isImporting: false, error: `Extração GPMF falhou: ${msg}. Usando simulação.`, progress: null })
          autoSimulate(probeResult.duration)
          return videoFile
        }
      } else {
        autoSimulate(probeResult.duration)
      }

      setState({ isImporting: false, error: null, progress: null })
      return videoFile
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ isImporting: false, error: message, progress: null })
      return null
    }
  }, [setVideo, setTelemetry, createProject, project, autoSimulate])

  /** Import from a browser File object — works in Vite dev mode (no Tauri needed) */
  const importFromFile = useCallback(async (file: File): Promise<VideoFile | null> => {
    setState({ isImporting: true, error: null, progress: "Lendo metadados do vídeo..." })
    try {
      const meta = await probeVideoElement(file)
      const blobUrl = URL.createObjectURL(file)

      // Detect GoPro by filename: GH/GX/GL/GP prefix covers all Hero/Max/Live models
      const isGoPro = /^(GH|GX|GL|GP|GOPR)/i.test(file.name)

      const videoFile: VideoFile = {
        metadata: {
          id: nanoid("vid_"),
          path: blobUrl,
          name: file.name,
          size: file.size,
          duration: meta.duration,
          fps: meta.fps,
          width: meta.width,
          height: meta.height,
          codec: file.type || "video/mp4",
          hasGPMF: isGoPro,
        },
        blobUrl,
      }

      if (!project) createProject()
      setVideo(videoFile)
      useAppStore.getState().setView("editor")

      if (isGoPro) {
        // Try to extract real GPMF from the file in the browser
        setState({ isImporting: false, error: null, progress: "Extraindo telemetria GPMF..." })
        try {
          const track = await extractGPMFFromFile(file)
          if (track && track.frames.length > 0) {
            const withSpeed = computeSpeed(track.frames)
            const withLean = computeLeanAngle(withSpeed)
            const normalized = normalizeTelemetry({ ...track, frames: withLean }, { smooth: true, smoothWindow: 5, resample: true, targetFps: 30 })
            setTelemetry(normalized)
          } else {
            // GPMF found by filename but extraction yielded no frames — fall back
            autoSimulate(meta.duration)
          }
        } catch {
          autoSimulate(meta.duration)
        }
      } else {
        autoSimulate(meta.duration)
      }

      setState({ isImporting: false, error: null, progress: null })
      return videoFile
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ isImporting: false, error: `Erro ao ler vídeo: ${message}`, progress: null })
      return null
    }
  }, [setVideo, setTelemetry, createProject, project, autoSimulate])

  /** Unified drop handler — works in both Tauri and browser */
  const importFromDrop = useCallback(async (files: FileList | File[]): Promise<VideoFile | null> => {
    const arr = Array.from(files)
    const videoFile = arr.find((f) => /\.(mp4|mov|MP4|MOV)$/i.test(f.name) || f.type.startsWith("video/"))
    if (!videoFile) {
      setState({ isImporting: false, error: "Formato não suportado. Use MP4 ou MOV.", progress: null })
      return null
    }

    if (isTauri()) {
      // In Tauri, File objects exposed via drag-drop have a .path property
      const path = (videoFile as File & { path?: string }).path
      if (path) {
        const blobUrl = URL.createObjectURL(videoFile)
        return importFromPath(path, blobUrl)
      }
    }

    return importFromFile(videoFile)
  }, [importFromPath, importFromFile])

  /** Open native picker (Tauri) or browser file picker */
  const openFilePicker = useCallback(async (): Promise<VideoFile | null> => {
    if (isTauri()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog")
        const selected = await open({
          multiple: false,
          filters: [{ name: "Video", extensions: ["mp4", "mov"] }],
        })
        if (selected && typeof selected === "string") return importFromPath(selected)
      } catch (err) {
        console.error("Tauri file picker error:", err)
      }
      return null
    }

    // Browser fallback
    const file = await openBrowserFilePicker("video/mp4,video/quicktime,.mp4,.mov")
    if (file) return importFromFile(file)
    return null
  }, [importFromPath, importFromFile])

  return {
    ...state,
    importFromPath,
    importFromFile,
    importFromDrop,
    openFilePicker,
    /** @deprecated use importFromPath or importFromFile */
    importVideo: importFromPath,
  }
}
