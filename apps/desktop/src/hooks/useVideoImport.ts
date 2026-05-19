import { useState, useCallback } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { useAppStore } from "@/store/useAppStore"
import { nanoid } from "@velocity/shared"
import type { VideoFile } from "@velocity/shared"
import { isTauri, probeVideoElement, openBrowserFilePicker } from "@/lib/tauri"

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
  const createProject = useProjectStore((s) => s.createProject)
  const project = useProjectStore((s) => s.project)

  /** Import from a native file path — only works inside Tauri */
  const importFromPath = useCallback(async (filePath: string): Promise<VideoFile | null> => {
    setState({ isImporting: true, error: null, progress: "Lendo metadados..." })
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      const probeResult = await invoke<{
        path: string; duration: number; fps: number
        width: number; height: number; codec: string
        bitrate?: number; has_gpmf: boolean
      }>("probe_video", { path: filePath })

      const fileName = filePath.split("/").pop() ?? filePath.split("\\").pop() ?? filePath
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
          hasGPMF: probeResult.has_gpmf,
        },
      }

      if (!project) createProject()
      setVideo(videoFile)
      useAppStore.getState().setView("editor")
      setState({ isImporting: false, error: null, progress: null })
      return videoFile
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ isImporting: false, error: message, progress: null })
      return null
    }
  }, [setVideo, createProject, project])

  /** Import from a browser File object — works in Vite dev mode (no Tauri needed) */
  const importFromFile = useCallback(async (file: File): Promise<VideoFile | null> => {
    setState({ isImporting: true, error: null, progress: "Lendo metadados do vídeo..." })
    try {
      const meta = await probeVideoElement(file)
      const blobUrl = URL.createObjectURL(file)

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
          hasGPMF: false,
        },
        blobUrl,
      }

      if (!project) createProject()
      setVideo(videoFile)
      useAppStore.getState().setView("editor")
      setState({ isImporting: false, error: null, progress: null })
      return videoFile
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ isImporting: false, error: `Erro ao ler vídeo: ${message}`, progress: null })
      return null
    }
  }, [setVideo, createProject, project])

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
      if (path) return importFromPath(path)
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
