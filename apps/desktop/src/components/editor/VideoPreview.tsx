import { useRef, useEffect, useState, useMemo, useCallback } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { useTimelineStore } from "@velocity/timeline"
import { useAppStore } from "@/store/useAppStore"
import { segmentAtTime, localTimeInSegment } from "@velocity/shared"
import type { VideoSegment } from "@velocity/shared"

const PRELOAD_S = 5

// ─── Multi-segment player ────────────────────────────────────────────────────

function MultiSegmentPreview({
  segments,
  blobUrls,
}: {
  segments: VideoSegment[]
  blobUrls: Record<string, string>
}) {
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const seekVersion = useTimelineStore((s) => s.seekVersion)
  const reportPlaybackTime = useTimelineStore((s) => s.reportPlaybackTime)
  const setVideoCurrentTime = useAppStore((s) => s.setVideoCurrentTime)

  // Double-buffer: two video slots
  const slotRef = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)]
  const [activeSlot, setActiveSlot] = useState(0)
  const activeSlotRef = useRef(0)
  const slotSegIdxRef = useRef<[number, number]>([-1, -1])
  const [slotSrc, setSlotSrc] = useState<[string | undefined, string | undefined]>([undefined, undefined])

  const rafRef = useRef<number | null>(null)

  // Track last processed seekVersion — seek effect fires exactly once per user-initiated seek
  const processedSeekVerRef = useRef(seekVersion)

  // Pending cross-segment seek: holds the slot + time we're waiting to swap to.
  // We only flip visibility AFTER the target video has seeked to the right frame.
  const pendingSeekRef = useRef<{ slot: 0 | 1; time: number; id: number } | null>(null)
  const seekIdRef = useRef(0)

  // Mirror of isPlaying for use inside callbacks (avoids stale closure captures)
  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying

  const getSrc = useCallback(
    (seg: VideoSegment) => blobUrls[seg.id],
    [blobUrls],
  )

  const loadSlot = useCallback(
    (slot: 0 | 1, segIdx: number) => {
      const seg = segments[segIdx]
      if (!seg) return
      slotSegIdxRef.current[slot] = segIdx
      const src = getSrc(seg)
      setSlotSrc((prev) => {
        const next: [string | undefined, string | undefined] = [...prev] as [string | undefined, string | undefined]
        next[slot] = src
        return next
      })
    },
    [segments, getSrc],
  )

  // Commit a pending seek swap — only if the seek ID still matches (not superseded).
  // Resumes/pauses videos to keep them in sync with playback state.
  const commitSwap = useCallback((slot: 0 | 1, id: number) => {
    if (pendingSeekRef.current?.id !== id) return
    pendingSeekRef.current = null
    const prevSlot = activeSlotRef.current as 0 | 1
    activeSlotRef.current = slot
    setActiveSlot(slot)
    if (isPlayingRef.current) {
      slotRef[slot]?.current?.play().catch(() => {})
      slotRef[prevSlot]?.current?.pause()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Called when an inactive slot has loaded metadata, can play, or is already loaded.
  // Seeks to the target time and commits the swap once positioned correctly.
  const handleSlotReady = useCallback(
    (slot: 0 | 1) => {
      const pending = pendingSeekRef.current
      if (!pending || pending.slot !== slot) return
      const video = slotRef[slot]?.current
      // If the video isn't loaded enough to seek yet, bail — onCanPlay will retry
      if (!video || video.readyState < 2) return

      const id = pending.id

      if (Math.abs(video.currentTime - pending.time) < 0.05) {
        commitSwap(slot, id)
      } else {
        video.currentTime = pending.time
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked)
          commitSwap(slot, id)
        }
        video.addEventListener("seeked", onSeeked)
      }
    },
    [commitSwap], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Init: load segment 0 into slot 0, segment 1 into slot 1
  useEffect(() => {
    if (segments.length === 0) return
    loadSlot(0, 0)
    activeSlotRef.current = 0
    slotSegIdxRef.current = [0, -1]
    setActiveSlot(0)
    if (segments.length > 1) loadSlot(1, 1)
  }, [segments.length > 0 ? segments[0]?.id : null]) // eslint-disable-line react-hooks/exhaustive-deps

  // RAF loop: report global time to both stores + trigger preload
  useEffect(() => {
    const loop = () => {
      const slot = activeSlotRef.current as 0 | 1
      const video = slotRef[slot]?.current
      const segIdx = slotSegIdxRef.current[slot]
      const seg = segIdx >= 0 ? segments[segIdx] : undefined
      if (video && seg) {
        const t = seg.startGlobalTime + video.currentTime
        setVideoCurrentTime(t)
        reportPlaybackTime(t)

        const nextIdx = segIdx + 1
        const otherSlot = (1 - slot) as 0 | 1
        if (
          nextIdx < segments.length &&
          slotSegIdxRef.current[otherSlot] !== nextIdx &&
          video.duration > 0 &&
          video.duration - video.currentTime < PRELOAD_S
        ) {
          loadSlot(otherSlot, nextIdx)
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [segments, setVideoCurrentTime, reportPlaybackTime, loadSlot])

  // Play / pause — acts on the currently active slot
  useEffect(() => {
    const slot = activeSlotRef.current
    const video = slotRef[slot]?.current
    if (!video) return
    if (isPlaying) video.play().catch(() => {})
    else video.pause()
  }, [isPlaying])

  // Seek handler — fires exactly once per user-initiated seek (seekVersion increment).
  // Cross-segment seeks: load the target segment into the inactive slot, then swap
  // as soon as it's positioned at the right frame.
  useEffect(() => {
    if (seekVersion === processedSeekVerRef.current) return
    processedSeekVerRef.current = seekVersion

    // Read target time directly from store state — no subscription needed
    const targetTime = useTimelineStore.getState().currentTime
    const targetSeg = segmentAtTime(segments, targetTime)
    if (!targetSeg) return
    const targetIdx = segments.indexOf(targetSeg)
    const localTime = localTimeInSegment(targetSeg, targetTime)

    const currentSlot = activeSlotRef.current
    const currentSegIdx = slotSegIdxRef.current[currentSlot]

    if (currentSegIdx === targetIdx) {
      // Same segment — seek active video in place
      const video = slotRef[currentSlot]?.current
      if (video && Math.abs(video.currentTime - localTime) > 0.04) {
        video.currentTime = localTime
      }
    } else {
      // Different segment — stage in inactive slot
      const newSlot = (1 - currentSlot) as 0 | 1
      seekIdRef.current += 1
      const capturedId = seekIdRef.current
      pendingSeekRef.current = { slot: newSlot, time: localTime, id: capturedId }

      // Only call loadSlot if the segment isn't already there (prevents unnecessary src change)
      if (slotSegIdxRef.current[newSlot] !== targetIdx) {
        loadSlot(newSlot, targetIdx)
      }

      // Try immediately via RAF — handles the already-loaded case where no events fire.
      // handleSlotReady's readyState guard ensures it's a no-op if still loading.
      requestAnimationFrame(() => {
        if (pendingSeekRef.current?.id === capturedId) {
          handleSlotReady(newSlot)
        }
      })
    }
  }, [seekVersion, segments, loadSlot, handleSlotReady])

  // On ended: advance to next segment
  const handleEnded = useCallback(
    (slot: 0 | 1) => {
      if (slot !== activeSlotRef.current) return
      const nextIdx = slotSegIdxRef.current[slot] + 1
      if (nextIdx >= segments.length) return

      const newSlot = (1 - slot) as 0 | 1
      if (slotSegIdxRef.current[newSlot] !== nextIdx) loadSlot(newSlot, nextIdx)

      // Ensure the preloaded slot is at position 0 before making it visible
      const nextVideo = slotRef[newSlot]?.current
      if (nextVideo && nextVideo.currentTime > 0.05) nextVideo.currentTime = 0

      activeSlotRef.current = newSlot
      setActiveSlot(newSlot)
      slotRef[newSlot]?.current?.play().catch(() => {})

      const afterNext = nextIdx + 1
      if (afterNext < segments.length) loadSlot(slot, afterNext)
    },
    [segments, loadSlot],
  )

  return (
    <>
      {([0, 1] as const).map((slot) => (
        <video
          key={slot}
          ref={slotRef[slot]}
          src={slotSrc[slot]}
          className="absolute inset-0 w-full h-full object-cover bg-black"
          style={{
            opacity: activeSlot === slot ? 1 : 0,
            transition: "opacity 0.06s linear",
            pointerEvents: activeSlot === slot ? "auto" : "none",
          }}
          playsInline
          muted
          preload="auto"
          onEnded={() => handleEnded(slot)}
          onLoadedMetadata={() => handleSlotReady(slot)}
          onCanPlay={() => handleSlotReady(slot)}
        />
      ))}
    </>
  )
}

// ─── Single-segment player (legacy) ─────────────────────────────────────────

function SingleVideoPreview({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number | null>(null)
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const seekVersion = useTimelineStore((s) => s.seekVersion)
  const currentTime = useTimelineStore((s) => s.currentTime)
  const reportPlaybackTime = useTimelineStore((s) => s.reportPlaybackTime)
  const setVideoCurrentTime = useAppStore((s) => s.setVideoCurrentTime)

  const processedSeekVerRef = useRef(-1)
  const seekTargetRef = useRef(0)
  seekTargetRef.current = currentTime

  // RAF loop: video drives both stores during playback
  useEffect(() => {
    const loop = () => {
      const t = videoRef.current?.currentTime ?? 0
      setVideoCurrentTime(t)
      reportPlaybackTime(t)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [setVideoCurrentTime, reportPlaybackTime])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) video.play().catch(() => {})
    else video.pause()
  }, [isPlaying])

  // Seek effect — fires only on user-initiated seeks, not on every playback frame
  useEffect(() => {
    if (seekVersion === processedSeekVerRef.current) return
    processedSeekVerRef.current = seekVersion
    const video = videoRef.current
    if (!video) return
    const t = seekTargetRef.current
    if (Math.abs(video.currentTime - t) > 0.04) video.currentTime = t
  }, [seekVersion])

  return (
    <video
      ref={videoRef}
      key={src}
      className="absolute inset-0 w-full h-full object-cover bg-black"
      src={src}
      playsInline
      muted
      preload="auto"
    />
  )
}

// ─── Root ────────────────────────────────────────────────────────────────────

export function VideoPreview() {
  const project = useProjectStore((s) => s.project)
  const blobUrl = useProjectStore((s) => s.videoBlobUrl)
  const segmentBlobUrls = useProjectStore((s) => s.segmentBlobUrls)

  const segments = useMemo(
    () => [...(project?.segments ?? [])].sort((a, b) => a.order - b.order),
    [project?.segments],
  )

  const [tauriSrc, setTauriSrc] = useState<string | undefined>()
  useEffect(() => {
    const path = project?.video?.path
    if (blobUrl || !path || !("__TAURI_INTERNALS__" in window)) {
      setTauriSrc(undefined)
      return
    }
    import("@tauri-apps/api/core")
      .then(({ convertFileSrc }) => setTauriSrc(convertFileSrc(path)))
      .catch(() => setTauriSrc(undefined))
  }, [blobUrl, project?.video?.path])

  const singleSrc = blobUrl ?? tauriSrc

  if (!project?.video && segments.length === 0) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <p className="text-white/20 text-sm">Nenhum vídeo carregado</p>
      </div>
    )
  }

  if (segments.length > 0) {
    return (
      <MultiSegmentPreview
        segments={segments}
        blobUrls={segmentBlobUrls}
      />
    )
  }

  if (!singleSrc) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <p className="text-white/20 text-sm">Nenhum vídeo carregado</p>
      </div>
    )
  }

  return <SingleVideoPreview src={singleSrc} />
}
