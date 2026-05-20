import { useState, useRef } from "react"
import { toPng, getFontEmbedCSS } from "html-to-image"
import { flushSync } from "react-dom"
import { isTauri } from "@/lib/tauri"

export interface ExportSettings {
  codec: "h264" | "h265" | "prores"
  crf: number
  /** Cap export to this many seconds — useful for quick test renders */
  maxDuration?: number
}

export interface ExportState {
  phase: "idle" | "rendering" | "encoding" | "done" | "error"
  currentFrame: number
  totalFrames: number
  progress: number
  outputPath: string | null
  error: string | null
}

export function useExport() {
  const [state, setState] = useState<ExportState>({
    phase: "idle",
    currentFrame: 0,
    totalFrames: 0,
    progress: 0,
    outputPath: null,
    error: null,
  })
  const cancelRef = useRef(false)

  const startExport = async (
    overlayRef: React.RefObject<HTMLDivElement | null>,
    setOverlayTime: (t: number) => void,
    options: ExportSettings & {
      videoPath: string
      /** Native file paths for multi-segment export (replaces videoPath) */
      segmentPaths?: string[]
      fps: number
      duration: number
      videoWidth: number
      videoHeight: number
    }
  ) => {
    if (!isTauri()) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: "Export requires the desktop app (Tauri). Running in browser mode.",
      }))
      return
    }

    const isMultiSeg = (options.segmentPaths?.length ?? 0) > 1
    const primaryPath = isMultiSeg ? options.segmentPaths![0] : options.videoPath

    if (!isMultiSeg && options.videoPath.startsWith("blob:")) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: "Cannot export: video was loaded via browser file picker. Re-open the app via Tauri and load the video with the native file picker.",
      }))
      return
    }

    cancelRef.current = false

    try {
      // Dynamic imports — Tauri APIs are only available inside the Tauri runtime
      const { save } = await import("@tauri-apps/plugin-dialog")
      const { mkdir, writeFile } = await import("@tauri-apps/plugin-fs")
      const { tempDir } = await import("@tauri-apps/api/path")
      const { invoke } = await import("@tauri-apps/api/core")

      const outputPath = await save({
        defaultPath: "output.mp4",
        filters: [{ name: "Video", extensions: ["mp4"] }],
      })
      if (!outputPath) return

      const fps = options.fps
      const effectiveDuration = options.maxDuration
        ? Math.min(options.duration, options.maxDuration)
        : options.duration
      const totalFrames = Math.ceil(effectiveDuration * fps)
      setState({ phase: "rendering", currentFrame: 0, totalFrames, progress: 0, outputPath, error: null })

      // Create temp dir for overlay PNG frames
      const tmp = await tempDir()
      const framesDir = `${tmp}/velocity_export_${Date.now()}`
      await mkdir(framesDir, { recursive: true })

      // Pre-embed fonts once — html-to-image fetches font URLs on every toPng call
      // by default; doing it upfront cuts ~30–40% of per-frame rendering time.
      let fontEmbedCSS: string | undefined
      if (overlayRef.current) {
        try { fontEmbedCSS = await getFontEmbedCSS(overlayRef.current) } catch { /* optional */ }
      }

      // Disk writes are pipelined: we fire each write and move on to the next frame.
      // At most WRITE_WINDOW writes are in-flight at once to cap memory pressure.
      const WRITE_WINDOW = 6
      const pendingWrites: Promise<void>[] = []

      // Frame capture loop
      for (let i = 0; i < totalFrames; i++) {
        if (cancelRef.current) {
          await Promise.allSettled(pendingWrites)
          setState((s) => ({ ...s, phase: "idle" }))
          return
        }

        const time = i / fps

        // Synchronous React re-render so widget props update before capture
        flushSync(() => setOverlayTime(time))

        // One rAF is enough: spring.jump() applies instantly (no animation queued)
        await new Promise<void>((r) => requestAnimationFrame(() => r()))

        if (!overlayRef.current) continue

        // Capture the overlay as a transparent PNG
        const dataUrl = await toPng(overlayRef.current, {
          backgroundColor: undefined,
          pixelRatio: 1,
          width: options.videoWidth,
          height: options.videoHeight,
          fontEmbedCSS,
        })

        // Decode base64 → binary
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)

        const frameNum = String(i).padStart(5, "0")

        // Fire write without awaiting — overlaps disk I/O with next frame render
        const writePromise = writeFile(`${framesDir}/frame_${frameNum}.png`, bytes)
        pendingWrites.push(writePromise)
        if (pendingWrites.length >= WRITE_WINDOW) {
          await pendingWrites.splice(0, 1)[0]
        }

        setState((s) => ({
          ...s,
          currentFrame: i + 1,
          progress: ((i + 1) / totalFrames) * 0.8,
        }))
      }

      // Drain remaining writes before handing off to ffmpeg
      await Promise.all(pendingWrites)

      if (cancelRef.current) return

      // FFmpeg: composite overlay frames onto the original video
      setState((s) => ({ ...s, phase: "encoding", progress: 0.82 }))

      await invoke("render_video", {
        options: {
          input_path: isMultiSeg ? primaryPath : options.videoPath,
          input_paths: isMultiSeg ? options.segmentPaths : null,
          overlay_frames_dir: framesDir,
          output_path: outputPath,
          width: options.videoWidth,
          height: options.videoHeight,
          fps,
          codec: options.codec,
          crf: options.crf,
          max_duration_seconds: options.maxDuration ?? null,
        },
      })

      setState({
        phase: "done",
        currentFrame: totalFrames,
        totalFrames,
        progress: 1,
        outputPath,
        error: null,
      })
    } catch (e) {
      setState((s) => ({ ...s, phase: "error", error: String(e) }))
    }
  }

  const cancel = async () => {
    cancelRef.current = true
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core")
      invoke("cancel_render").catch(() => {})
    }
    setState((s) => ({ ...s, phase: "idle" }))
  }

  const reset = () =>
    setState({ phase: "idle", currentFrame: 0, totalFrames: 0, progress: 0, outputPath: null, error: null })

  return { startExport, cancel, reset, state }
}
