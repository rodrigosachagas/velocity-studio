import { useState, useCallback } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { useAppStore } from "@/store/useAppStore"
import { nanoid } from "@velocity/shared"
import type { VideoFile } from "@velocity/shared"

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

  const importVideo = useCallback(async (filePath: string) => {
    setState({ isImporting: true, error: null, progress: "Probing video..." })

    try {
      // Dynamic import to avoid SSR issues
      const { invoke } = await import("@tauri-apps/api/core")

      setState((s) => ({ ...s, progress: "Reading metadata..." }))

      const probeResult = await invoke<{
        path: string
        duration: number
        fps: number
        width: number
        height: number
        codec: string
        bitrate?: number
        has_gpmf: boolean
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

      setVideo(videoFile)
      useAppStore.getState().setView("editor")

      setState({ isImporting: false, error: null, progress: null })
      return videoFile
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ isImporting: false, error: message, progress: null })
      return null
    }
  }, [setVideo])

  const openFilePicker = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog")
      const selected = await open({
        multiple: false,
        filters: [{ name: "Video", extensions: ["mp4", "mov", "MP4", "MOV"] }],
      })

      if (selected && typeof selected === "string") {
        return importVideo(selected)
      }
    } catch (err) {
      console.error("File picker error:", err)
    }
    return null
  }, [importVideo])

  return {
    ...state,
    importVideo,
    openFilePicker,
  }
}
