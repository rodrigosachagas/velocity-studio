import { useEffect, useRef } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { useAppStore } from "@/store/useAppStore"
import { isTauri } from "@/lib/tauri"
import type { Project } from "@velocity/shared"

/**
 * Handles the async parts of session restore that can't happen synchronously:
 * - Recreates video playback URLs from stored file paths (via convertFileSrc)
 * - Re-extracts GPMF telemetry from video files in the background
 *
 * The project state itself is restored synchronously in useProjectStore's
 * initial state (getInitialProject), so this hook only handles I/O work.
 *
 * Call once at the app root.
 */
export function useSessionRestore() {
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    const project = useProjectStore.getState().project
    if (!project) return  // no saved project — fresh start

    // Navigate to editor (project is already loaded)
    useAppStore.getState().setView("editor")

    if (isTauri()) {
      void restoreTauriVideoUrls(project)
      void reExtractTelemetry(project)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Recreate segmentBlobUrls from stored file paths — no user re-open needed. */
async function restoreTauriVideoUrls(project: Project): Promise<void> {
  const segments = project.segments ?? []
  if (segments.length === 0) return

  try {
    const { convertFileSrc } = await import("@tauri-apps/api/core")
    const blobUrls: Record<string, string> = {}
    for (const seg of segments) {
      if (seg.path && !seg.path.startsWith("blob:")) {
        blobUrls[seg.id] = convertFileSrc(seg.path)
      }
    }
    if (Object.keys(blobUrls).length > 0) {
      useProjectStore.setState({ segmentBlobUrls: blobUrls })
    }
  } catch {
    // Non-fatal — video preview unavailable but widgets/timeline still work
  }
}

/** Re-extract GPMF telemetry from stored file paths and populate the store. */
async function reExtractTelemetry(project: Project): Promise<void> {
  // Skip if telemetry frames were somehow preserved (shouldn't happen since
  // saveProject strips them, but guard against future changes)
  if ((project.telemetry?.frames?.length ?? 0) > 0) return

  const segments = project.segments ?? []
  const goproSegs = segments.filter(
    (s) => s.hasGPMF && s.path && !s.path.startsWith("blob:")
  )
  if (goproSegs.length === 0) return

  try {
    const { convertFileSrc } = await import("@tauri-apps/api/core")
    const { extractGPMFFromUrl, computeSpeed, computeLeanAngle, normalizeTelemetry } =
      await import("@velocity/telemetry")

    for (const seg of goproSegs) {
      try {
        const assetUrl = convertFileSrc(seg.path)
        const track = await extractGPMFFromUrl(assetUrl, seg.path)
        if (!track || track.frames.length === 0) continue

        const withSpeed = computeSpeed(track.frames)
        const withLean = computeLeanAngle(withSpeed)
        const normalized = normalizeTelemetry(
          { ...track, frames: withLean },
          { smooth: true, smoothWindow: 5, resample: true, targetFps: 30 }
        )
        useProjectStore.getState().setSegmentTelemetry(seg.id, normalized)
      } catch {
        // Skip failed segments — telemetry is best-effort
      }
    }
  } catch {
    // Non-fatal
  }
}
