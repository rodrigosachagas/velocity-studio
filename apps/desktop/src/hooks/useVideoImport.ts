import { useState, useCallback } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { useAppStore } from "@/store/useAppStore"
import { nanoid } from "@velocity/shared"
import type { VideoFile, VideoSegment, TelemetryTrack } from "@velocity/shared"
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
  const addSegments = useProjectStore((s) => s.addSegments)
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

  /** Import multiple video files as sequential segments */
  const importSegments = useCallback(async (files: File[], replace = true): Promise<void> => {
    const videoFiles = files.filter((f) => /\.(mp4|mov)$/i.test(f.name) || f.type.startsWith("video/"))
    if (videoFiles.length === 0) return

    setState({ isImporting: true, error: null, progress: `Importando ${videoFiles.length} arquivo(s)...` })
    if (!project) createProject()
    useAppStore.getState().setView("editor")

    try {
      const newSegs: VideoSegment[] = []
      const telMap: Record<string, TelemetryTrack> = {}
      const blobMap: Record<string, string> = {}

      for (const file of videoFiles) {
        const id = nanoid("seg_")
        setState({ isImporting: true, error: null, progress: `Lendo ${file.name}...` })

        let duration = 0, fps = 30, width = 1920, height = 1080, codec = "video/mp4"
        let nativePath: string | undefined

        if (isTauri()) {
          nativePath = (file as File & { path?: string }).path
          if (nativePath) {
            try {
              const { invoke, convertFileSrc } = await import("@tauri-apps/api/core")
              const probe = await invoke<{
                duration: number; fps: number; width: number; height: number; codec: string
              }>("probe_video", { path: nativePath })
              duration = probe.duration; fps = probe.fps; width = probe.width
              height = probe.height; codec = probe.codec
              blobMap[id] = convertFileSrc(nativePath)
            } catch {
              const meta = await probeVideoElement(file)
              duration = meta.duration; fps = meta.fps; width = meta.width; height = meta.height
              blobMap[id] = URL.createObjectURL(file)
            }
          } else {
            const meta = await probeVideoElement(file)
            duration = meta.duration; fps = meta.fps; width = meta.width; height = meta.height
            blobMap[id] = URL.createObjectURL(file)
          }
        } else {
          const meta = await probeVideoElement(file)
          duration = meta.duration; fps = meta.fps; width = meta.width; height = meta.height
          blobMap[id] = URL.createObjectURL(file)
        }

        const isGoPro = /^(GH|GX|GL|GP|GOPR)/i.test(file.name)
        const seg: VideoSegment = {
          id,
          path: nativePath ?? blobMap[id],
          name: file.name,
          order: 0,
          startGlobalTime: 0,
          duration,
          fps,
          width,
          height,
          codec,
          hasGPMF: isGoPro,
          size: file.size,
        }
        newSegs.push(seg)

        if (isGoPro) {
          setState({ isImporting: true, error: null, progress: `Extraindo GPMF de ${file.name}...` })
          try {
            let track: TelemetryTrack | null = null
            if (nativePath) {
              const { convertFileSrc } = await import("@tauri-apps/api/core")
              const { extractGPMFFromUrl } = await import("@velocity/telemetry")
              track = await extractGPMFFromUrl(convertFileSrc(nativePath), nativePath)
            } else {
              track = await extractGPMFFromFile(file)
            }
            if (track && track.frames.length > 0) {
              const withSpeed = computeSpeed(track.frames)
              const withLean = computeLeanAngle(withSpeed)
              telMap[id] = normalizeTelemetry({ ...track, frames: withLean }, {
                smooth: true, smoothWindow: 5, resample: true, targetFps: 30,
              })
            }
          } catch { /* GPMF optional — continue without */ }
        }
      }

      addSegments(newSegs, telMap, blobMap, replace)
      setState({ isImporting: false, error: null, progress: null })
    } catch (err) {
      setState({ isImporting: false, error: String(err), progress: null })
    }
  }, [project, createProject, addSegments])

  /** Unified drop handler — works in both Tauri and browser */
  const importFromDrop = useCallback(async (files: FileList | File[]): Promise<VideoFile | null> => {
    const arr = Array.from(files)
    const videoFiles = arr.filter((f) => /\.(mp4|mov|MP4|MOV)$/i.test(f.name) || f.type.startsWith("video/"))

    if (videoFiles.length === 0) {
      setState({ isImporting: false, error: "Formato não suportado. Use MP4 ou MOV.", progress: null })
      return null
    }

    // Multiple files → segment mode
    if (videoFiles.length > 1) {
      await importSegments(videoFiles)
      return null
    }

    const videoFile = videoFiles[0]!
    if (isTauri()) {
      // In Tauri, File objects exposed via drag-drop have a .path property
      const path = (videoFile as File & { path?: string }).path
      if (path) {
        const blobUrl = URL.createObjectURL(videoFile)
        return importFromPath(path, blobUrl)
      }
    }

    return importFromFile(videoFile)
  }, [importFromPath, importFromFile, importSegments])

  /** Open native picker (Tauri) or browser file picker — supports 1 or many files */
  const openFilePicker = useCallback(async (): Promise<VideoFile | null> => {
    if (isTauri()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog")
        const selected = await open({
          multiple: true,
          filters: [{ name: "Video", extensions: ["mp4", "mov"] }],
        })
        if (!selected) return null
        const paths = Array.isArray(selected) ? selected : [selected]
        if (paths.length === 0) return null
        if (paths.length === 1) {
          return importFromPath(paths[0] as string)
        }
        // Multiple files → segment mode (replace any existing)
        const fakeFiles = paths.map((p) => ({
          name: (p as string).split("/").pop() ?? (p as string),
          path: p,
        })) as unknown as File[]
        await importSegments(fakeFiles, true)
        return null
      } catch (err) {
        console.error("Tauri file picker error:", err)
      }
      return null
    }

    // Browser fallback — use multi-file input
    return new Promise<VideoFile | null>((resolve) => {
      const input = document.createElement("input")
      input.type = "file"
      input.multiple = true
      input.accept = "video/mp4,video/quicktime,.mp4,.mov"
      input.onchange = async () => {
        const files = Array.from(input.files ?? [])
        if (files.length === 0) { resolve(null); return }
        if (files.length === 1) {
          resolve(await importFromFile(files[0]!))
        } else {
          await importSegments(files, true)
          resolve(null)
        }
      }
      input.click()
    })
  }, [importFromPath, importFromFile, importSegments])

  /** Open picker for multiple files (segment import) */
  const openSegmentsPicker = useCallback(async (): Promise<void> => {
    if (isTauri()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog")
        const selected = await open({
          multiple: true,
          filters: [{ name: "Video", extensions: ["mp4", "mov"] }],
        })
        if (Array.isArray(selected) && selected.length > 0) {
          // Tauri returns path strings for each selected file
          const fakeFiles = selected.map((path) => ({
            name: (path as string).split("/").pop() ?? path,
            path,
          })) as unknown as File[]
          await importSegments(fakeFiles, false)
        }
      } catch (err) {
        console.error("Tauri file picker error:", err)
      }
      return
    }
    // Browser fallback: use hidden multi-file input
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.accept = "video/mp4,video/quicktime,.mp4,.mov"
    input.onchange = async () => {
      const files = Array.from(input.files ?? [])
      if (files.length > 0) await importSegments(files, false)
    }
    input.click()
  }, [importSegments])

  return {
    ...state,
    importFromPath,
    importFromFile,
    importFromDrop,
    importSegments,
    openFilePicker,
    openSegmentsPicker,
    /** @deprecated use importFromPath or importFromFile */
    importVideo: importFromPath,
  }
}
