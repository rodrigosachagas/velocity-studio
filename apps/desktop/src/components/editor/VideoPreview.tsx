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
  const seekTime = useTimelineStore((s) => s.currentTime)
  const setVideoCurrentTime = useAppStore((s) => s.setVideoCurrentTime)

  // Double-buffer: two video slots
  const slotRef = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)]
  // Which slot is currently visible/active
  const [activeSlot, setActiveSlot] = useState(0)
  const activeSlotRef = useRef(0)
  // Segment index loaded in each slot (-1 = empty)
  const slotSegIdxRef = useRef<[number, number]>([-1, -1])
  // Src state for rendering
  const [slotSrc, setSlotSrc] = useState<[string | undefined, string | undefined]>([undefined, undefined])

  const rafRef = useRef<number | null>(null)
  const lastSeekRef = useRef(-1)

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

  // Init: load segment 0 into slot 0, segment 1 into slot 1
  useEffect(() => {
    if (segments.length === 0) return
    loadSlot(0, 0)
    activeSlotRef.current = 0
    slotSegIdxRef.current = [0, -1]
    setActiveSlot(0)
    if (segments.length > 1) loadSlot(1, 1)
  }, [segments.length > 0 ? segments[0]?.id : null]) // eslint-disable-line react-hooks/exhaustive-deps

  // RAF loop: report global time
  useEffect(() => {
    const loop = () => {
      const slot = activeSlotRef.current as 0 | 1
      const video = slotRef[slot]?.current
      const segIdx = slotSegIdxRef.current[slot]
      const seg = segIdx >= 0 ? segments[segIdx] : undefined
      if (video && seg) {
        const globalTime = seg.startGlobalTime + video.currentTime
        setVideoCurrentTime(globalTime)

        // Preload next segment when approaching end
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
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [segments, setVideoCurrentTime, loadSlot])

  // Play / pause
  useEffect(() => {
    const slot = activeSlotRef.current
    const video = slotRef[slot]?.current
    if (!video) return
    if (isPlaying) video.play().catch(() => {})
    else video.pause()
  }, [isPlaying])

  // Seek handler
  useEffect(() => {
    if (isPlaying) return
    if (Math.abs(seekTime - lastSeekRef.current) < 0.04) return
    lastSeekRef.current = seekTime

    const targetSeg = segmentAtTime(segments, seekTime)
    if (!targetSeg) return
    const targetIdx = segments.indexOf(targetSeg)
    const localTime = localTimeInSegment(targetSeg, seekTime)

    const currentSlot = activeSlotRef.current
    const currentSegIdx = slotSegIdxRef.current[currentSlot]

    if (currentSegIdx === targetIdx) {
      // Same segment — just seek
      const video = slotRef[currentSlot]?.current
      if (video && Math.abs(video.currentTime - localTime) > 0.04) {
        video.currentTime = localTime
      }
    } else {
      // Different segment — load into inactive slot, swap
      const newSlot = (1 - currentSlot) as 0 | 1
      loadSlot(newSlot, targetIdx)
      activeSlotRef.current = newSlot
      setActiveSlot(newSlot)
      // Seek once the element has loaded
      const applySeek = () => {
        const video = slotRef[newSlot]?.current
        if (!video) return
        video.currentTime = localTime
      }
      // Slight defer so the src update propagates to the DOM
      requestAnimationFrame(applySeek)
    }
  }, [seekTime, isPlaying, segments, loadSlot])

  // On ended: advance to next segment
  const handleEnded = useCallback(
    (slot: 0 | 1) => {
      if (slot !== activeSlotRef.current) return
      const nextIdx = slotSegIdxRef.current[slot] + 1
      if (nextIdx >= segments.length) return

      const newSlot = (1 - slot) as 0 | 1
      // Ensure next segment is loaded in the other slot
      if (slotSegIdxRef.current[newSlot] !== nextIdx) {
        loadSlot(newSlot, nextIdx)
      }
      activeSlotRef.current = newSlot
      setActiveSlot(newSlot)
      slotRef[newSlot]?.current?.play().catch(() => {})

      // Preload segment after next into vacated slot
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
          style={{ visibility: activeSlot === slot ? "visible" : "hidden" }}
          playsInline
          muted
          preload="auto"
          onEnded={() => handleEnded(slot)}
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
  const currentTime = useTimelineStore((s) => s.currentTime)
  const setVideoCurrentTime = useAppStore((s) => s.setVideoCurrentTime)

  useEffect(() => {
    const loop = () => {
      setVideoCurrentTime(videoRef.current?.currentTime ?? 0)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [setVideoCurrentTime])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) video.play().catch(() => {})
    else video.pause()
  }, [isPlaying])

  useEffect(() => {
    const video = videoRef.current
    if (!video || isPlaying) return
    if (Math.abs(video.currentTime - currentTime) > 0.04) video.currentTime = currentTime
  }, [currentTime, isPlaying])

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
