import { useState, useRef } from "react"
import { toCanvas, getFontEmbedCSS } from "html-to-image"
import { flushSync } from "react-dom"
import { isTauri } from "@/lib/tauri"

export interface ExportSettings {
  codec: "h264" | "h265" | "prores"
  crf: number
  /** Explicit output FPS — undefined means match the source video's native FPS */
  outputFps?: number
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
  /** Diagnostic log entries — populated on error so the user can share them */
  logs: string[]
}

/** Encode a Uint8Array to base64 in chunks to avoid call-stack limits. */
function toBase64(bytes: Uint8Array): string {
  let str = ""
  const chunk = 32768
  for (let i = 0; i < bytes.length; i += chunk) {
    str += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(str)
}

export function useExport() {
  const [state, setState] = useState<ExportState>({
    phase: "idle",
    currentFrame: 0,
    totalFrames: 0,
    progress: 0,
    outputPath: null,
    error: null,
    logs: [],
  })
  const cancelRef = useRef(false)
  const logsRef = useRef<string[]>([])

  const log = (msg: string) => {
    const entry = `[${new Date().toISOString().slice(11, 23)}] ${msg}`
    console.log("[export]", msg)
    logsRef.current.push(entry)
  }

  const startExport = async (
    overlayRef: React.RefObject<HTMLDivElement | null>,
    setOverlayTime: (t: number) => void,
    options: ExportSettings & {
      videoPath: string
      segmentPaths?: string[]
      fps: number
      duration: number
      videoWidth: number
      videoHeight: number
      trimStart?: number
      trimEnd?: number
    }
  ) => {
    if (!isTauri()) {
      setState((s) => ({ ...s, phase: "error", error: "Export requires the desktop app (Tauri).", logs: [] }))
      return
    }

    const isMultiSeg = (options.segmentPaths?.length ?? 0) > 1
    const primaryPath = isMultiSeg ? options.segmentPaths![0] : options.videoPath

    if (!isMultiSeg && options.videoPath.startsWith("blob:")) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: "Cannot export: video was loaded via browser file picker. Use the native file picker.",
        logs: [],
      }))
      return
    }

    cancelRef.current = false
    logsRef.current = []

    log(`Starting export — codec=${options.codec} crf=${options.crf} res=${options.videoWidth}x${options.videoHeight} fps=${options.fps}`)
    log(`Segments=${isMultiSeg ? options.segmentPaths!.length : 1} duration=${options.duration.toFixed(2)}s`)

    // Screen wake lock — keeps display on so requestAnimationFrame keeps firing
    let wakeLock: WakeLockSentinel | null = null
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen")
        log("Wake lock acquired")
      }
    } catch (e) {
      log(`Wake lock unavailable: ${e}`)
    }

    const releaseWakeLock = () => { wakeLock?.release().catch(() => {}) }

    try {
      const { save } = await import("@tauri-apps/plugin-dialog")
      const { invoke } = await import("@tauri-apps/api/core")

      const isProRes = options.codec === "prores"
      const outputPath = await save({
        defaultPath: isProRes ? "output.mov" : "output.mp4",
        filters: isProRes
          ? [{ name: "ProRes Video", extensions: ["mov"] }]
          : [{ name: "Video", extensions: ["mp4"] }],
      })
      if (!outputPath) { releaseWakeLock(); return }

      log(`Output path: ${outputPath}`)

      const fps = options.fps
      const trimStart = options.trimStart ?? 0
      const trimEnd = options.trimEnd ?? options.duration
      const trimmedDuration = trimEnd - trimStart
      const effectiveDuration = options.maxDuration
        ? Math.min(trimmedDuration, options.maxDuration)
        : trimmedDuration

      const OVERLAY_FPS = 15
      const totalFrames = Math.ceil(effectiveDuration * OVERLAY_FPS)

      log(`Total frames=${totalFrames} overlayFps=${OVERLAY_FPS} trimStart=${trimStart.toFixed(2)} effectiveDuration=${effectiveDuration.toFixed(2)}`)

      setState({ phase: "rendering", currentFrame: 0, totalFrames, progress: 0, outputPath, error: null, logs: [] })

      // Pre-embed fonts once
      let fontEmbedCSS: string | undefined
      if (overlayRef.current) {
        try {
          fontEmbedCSS = await getFontEmbedCSS(overlayRef.current)
          log(`Font CSS embedded (${fontEmbedCSS?.length ?? 0} bytes)`)
        } catch (e) {
          log(`Font embed failed (non-fatal): ${e}`)
        }
      }

      // Start FFmpeg (reads overlay frames from stdin via image2pipe — no disk)
      log("Calling start_pipe_export…")
      await invoke("start_pipe_export", {
        options: {
          input_path: isMultiSeg ? primaryPath : options.videoPath,
          input_paths: isMultiSeg ? options.segmentPaths : null,
          output_path: outputPath,
          width: options.videoWidth,
          height: options.videoHeight,
          fps,
          overlay_fps: OVERLAY_FPS,
          output_fps: options.outputFps ?? null,
          codec: options.codec,
          crf: options.crf,
          max_duration_seconds: options.maxDuration ?? null,
          trim_start: trimStart > 0 ? trimStart : null,
          trim_duration: trimmedDuration < options.duration ? trimmedDuration : null,
        },
      })
      log("FFmpeg started successfully")

      let lastBytes: Uint8Array | null = null
      let captureFailures = 0
      let captureFallbacks = 0
      let captureSkips = 0

      // Frame capture loop — no filesystem writes
      for (let i = 0; i < totalFrames; i++) {
        if (cancelRef.current) {
          await invoke("cancel_render")
          setState((s) => ({ ...s, phase: "idle" }))
          releaseWakeLock()
          return
        }

        const time = trimStart + i / OVERLAY_FPS
        flushSync(() => setOverlayTime(time))
        await new Promise<void>((r) => requestAnimationFrame(() => r()))

        if (!overlayRef.current) {
          log(`Frame ${i}: overlayRef is null, skipping`)
          captureSkips++
          continue
        }

        let bytes: Uint8Array | null = null
        try {
          const canvas = await toCanvas(overlayRef.current, {
            backgroundColor: undefined,
            pixelRatio: 1,
            width: options.videoWidth,
            height: options.videoHeight,
            fontEmbedCSS,
          })
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
          canvas.width = 0  // free canvas backing store (~30 MB for 4K)
          if (blob) {
            bytes = new Uint8Array(await blob.arrayBuffer())
            lastBytes = bytes
          } else {
            log(`Frame ${i}: toBlob returned null`)
            captureFailures++
          }
        } catch (frameErr) {
          const msg = `Frame ${i}: toCanvas failed — ${frameErr}`
          console.warn(msg)
          log(msg)
          captureFailures++
        }

        const frameData = bytes ?? lastBytes
        if (!frameData) {
          captureSkips++
          if (i === 0) log("Frame 0: no frame data and no fallback — first capture failed completely")
          continue
        }
        if (!bytes && lastBytes) captureFallbacks++

        // Send frame bytes directly to Rust via base64 IPC — zero disk writes
        const b64 = toBase64(frameData)
        await invoke("pipe_frame_base64", { data: b64 })

        setState((s) => ({
          ...s,
          currentFrame: i + 1,
          progress: ((i + 1) / totalFrames) * 0.95,
        }))

        // GC yield every 50 frames
        if (i % 50 === 49) await new Promise<void>((r) => setTimeout(r, 30))
      }

      log(`Frame loop done — success=${totalFrames - captureFailures - captureSkips} failures=${captureFailures} fallbacks=${captureFallbacks} skips=${captureSkips}`)

      if (cancelRef.current) {
        await invoke("cancel_render")
        setState((s) => ({ ...s, phase: "idle" }))
        releaseWakeLock()
        return
      }

      setState((s) => ({ ...s, phase: "encoding", progress: 0.96 }))
      log("Calling finish_pipe_export…")
      await invoke("finish_pipe_export")
      log("Encoding complete!")

      setState({ phase: "done", currentFrame: totalFrames, totalFrames, progress: 1, outputPath, error: null, logs: [] })
    } catch (e) {
      const detail = String(e)
      const frameNum = state.currentFrame
      const error = frameNum > 0 ? `Frame ${frameNum}: ${detail}` : detail
      log(`FATAL ERROR: ${detail}`)
      setState((s) => ({
        ...s,
        phase: "error",
        error,
        logs: [...logsRef.current],
      }))
    } finally {
      releaseWakeLock()
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
    setState({ phase: "idle", currentFrame: 0, totalFrames: 0, progress: 0, outputPath: null, error: null, logs: [] })

  return { startExport, cancel, reset, state }
}
