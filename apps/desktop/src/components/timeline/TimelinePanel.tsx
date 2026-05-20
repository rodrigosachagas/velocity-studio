import { useRef, useCallback, useState, useEffect, useMemo } from "react"
import { useTimelineStore } from "@velocity/timeline"
import { formatTimecode } from "@velocity/shared"
import { Icon } from "@/components/ui/Icon"
import { useProjectStore } from "@/store/useProjectStore"
import type { VideoSegment } from "@velocity/shared"

const SEG_COLORS = [
  "rgba(68,136,255,0.5)",
  "rgba(255,160,60,0.5)",
  "rgba(180,80,255,0.5)",
  "rgba(60,210,140,0.5)",
  "rgba(255,80,120,0.5)",
]
// Solid accent colors for boundaries/handles
const SEG_SOLID = ["#4488ff", "#ffa03c", "#b450ff", "#3cd28c", "#ff5078"]

const TICK_INTERVALS = [0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]

function pickTickInterval(visibleSecs: number): number {
  return TICK_INTERVALS.find((i) => visibleSecs / i <= 14) ?? 300
}

export function TimelinePanel() {
  const currentTime = useTimelineStore((s) => s.currentTime)
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const play = useTimelineStore((s) => s.play)
  const pause = useTimelineStore((s) => s.pause)
  const seek = useTimelineStore((s) => s.seek)
  const stepForward = useTimelineStore((s) => s.stepForward)
  const stepBackward = useTimelineStore((s) => s.stepBackward)
  const engine = useTimelineStore((s) => s.engine)
  const duration = engine?.getState().duration ?? 0

  const project = useProjectStore((s) => s.project)
  const setTrimPoints = useProjectStore((s) => s.setTrimPoints)
  const inPoint: number | undefined = project?.timeline.inPoint
  const outPoint: number | undefined = project?.timeline.outPoint

  const segments: VideoSegment[] = useMemo(
    () => [...(project?.segments ?? [])].sort((a, b) => a.order - b.order),
    [project?.segments],
  )

  const [zoom, setZoom] = useState(1)
  const [scrollFrac, setScrollFrac] = useState(0)
  const [dragging, setDragging] = useState<"in" | "out" | null>(null)

  const scrubberRef = useRef<HTMLDivElement>(null)
  const tracksRef = useRef<HTMLDivElement>(null)

  // ── coordinate helpers ──────────────────────────────────────────────────────
  const visibleDuration = Math.max(0.5, duration / zoom)
  const maxScrollSec = Math.max(0, duration - visibleDuration)
  const startSec = scrollFrac * maxScrollSec
  const endSec = startSec + visibleDuration

  const timeToFrac = useCallback(
    (t: number) => visibleDuration > 0 ? (t - startSec) / visibleDuration : 0,
    [visibleDuration, startSec],
  )
  const fracToTime = useCallback(
    (f: number) => startSec + f * visibleDuration,
    [startSec, visibleDuration],
  )

  // ── zoom centered on playhead ───────────────────────────────────────────────
  const applyZoom = useCallback(
    (newZoom: number) => {
      const clamped = Math.max(0.1, Math.min(8, newZoom))
      setZoom(clamped)
      const newVisible = duration / clamped
      const newMax = Math.max(0, duration - newVisible)
      if (newMax > 0) {
        const desiredStart = Math.max(0, currentTime - newVisible * 0.5)
        setScrollFrac(Math.min(1, desiredStart / newMax))
      } else {
        setScrollFrac(0)
      }
    },
    [duration, currentTime],
  )

  // ── auto-scroll while playing ──────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || maxScrollSec <= 0) return
    const f = timeToFrac(currentTime)
    if (f > 0.9) {
      const newStart = currentTime - visibleDuration * 0.15
      setScrollFrac(Math.max(0, Math.min(1, newStart / maxScrollSec)))
    }
  }, [currentTime, isPlaying, timeToFrac, visibleDuration, maxScrollSec])

  // ── mouse-wheel zoom ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = tracksRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.82 : 1.22
      applyZoom(Math.max(0.1, Math.min(8, zoom * factor)))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [zoom, applyZoom])

  // ── scrub ──────────────────────────────────────────────────────────────────
  const clientToTime = useCallback(
    (clientX: number) => {
      const rect = scrubberRef.current?.getBoundingClientRect()
      if (!rect) return null
      const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return fracToTime(f)
    },
    [fracToTime],
  )

  const handleScrubDown = useCallback(
    (e: React.MouseEvent) => {
      if (dragging || e.button !== 0) return
      const t = clientToTime(e.clientX)
      if (t !== null) seek(t)
    },
    [seek, clientToTime, dragging],
  )

  const handleScrubMove = useCallback(
    (e: React.MouseEvent) => {
      if (e.buttons !== 1 || dragging) return
      const t = clientToTime(e.clientX)
      if (t !== null) seek(t)
    },
    [seek, clientToTime, dragging],
  )

  // ── trim dragging ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const t = clientToTime(e.clientX)
      if (t === null) return
      if (dragging === "in") {
        const clamped = Math.max(0, Math.min(t, (outPoint ?? duration) - 0.5))
        setTrimPoints(clamped, outPoint)
      } else {
        const clamped = Math.min(duration, Math.max(t, (inPoint ?? 0) + 0.5))
        setTrimPoints(inPoint, clamped)
      }
    }
    const onUp = () => setDragging(null)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [dragging, clientToTime, inPoint, outPoint, duration, setTrimPoints])

  // ── derived fractions ──────────────────────────────────────────────────────
  const playFrac = Math.max(0, Math.min(1, timeToFrac(currentTime)))
  const inFrac = inPoint != null ? timeToFrac(inPoint) : null
  const outFrac = outPoint != null ? timeToFrac(outPoint) : null
  const hasTrim = inPoint != null || outPoint != null

  const zoomLabel = zoom === 1 ? "1×" : zoom < 1
    ? `${zoom.toFixed(1)}×`
    : `${zoom.toFixed(zoom < 2 ? 1 : 0)}×`

  return (
    <div className="flex flex-col h-full bg-surface-50">
      {/* ── Controls ── */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/[0.07] flex-wrap">
        {/* Playback */}
        <button onClick={() => seek(0)} className="btn-ghost p-1.5" title="Início">
          <Icon name="step-backward" size={13} />
        </button>
        <button onClick={() => stepBackward(1)} className="btn-ghost p-1.5" title="Frame anterior">
          <Icon name="chevron_right" size={13} className="rotate-180" />
        </button>
        <button
          onClick={() => (isPlaying ? pause() : play())}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-accent text-black hover:bg-accent/90 active:scale-95 transition-all shrink-0"
        >
          <Icon name={isPlaying ? "pause" : "play"} size={13} />
        </button>
        <button onClick={() => stepForward(1)} className="btn-ghost p-1.5" title="Próximo frame">
          <Icon name="chevron_right" size={13} />
        </button>
        <button onClick={() => seek(duration)} className="btn-ghost p-1.5" title="Final">
          <Icon name="step-forward" size={13} />
        </button>

        <div className="mx-1 h-3.5 w-px bg-white/[0.07]" />

        {/* Timecode */}
        <span className="font-mono text-xs text-white/70 tabular-nums">{formatTimecode(currentTime)}</span>
        <span className="text-white/20 text-[10px]">/</span>
        <span className="font-mono text-[10px] text-white/30 tabular-nums">{formatTimecode(duration)}</span>

        <div className="mx-1 h-3.5 w-px bg-white/[0.07]" />

        {/* Trim */}
        <button
          onClick={() => setTrimPoints(currentTime, outPoint)}
          className="btn-ghost px-1.5 py-1 text-[10px] text-white/40 hover:text-accent font-mono"
          title="Marcar entrada aqui (IN)"
        >
          [IN
        </button>
        <button
          onClick={() => setTrimPoints(inPoint, currentTime)}
          className="btn-ghost px-1.5 py-1 text-[10px] text-white/40 hover:text-accent font-mono"
          title="Marcar saída aqui (OUT)"
        >
          OUT]
        </button>
        {hasTrim && (
          <>
            <span className="text-[9px] text-white/25 font-mono tabular-nums">
              {inPoint != null && outPoint != null
                ? formatTimecode(outPoint - inPoint)
                : inPoint != null
                ? `>${formatTimecode(inPoint)}`
                : `<${formatTimecode(outPoint!)}`}
            </span>
            <button
              onClick={() => setTrimPoints(undefined, undefined)}
              className="btn-ghost p-1 text-white/25 hover:text-red-400"
              title="Remover corte"
            >
              <Icon name="x" size={10} />
            </button>
          </>
        )}

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => applyZoom(zoom / 1.5)} className="btn-ghost p-1" title="Zoom out (scroll ↓ / botão)">
            <Icon name="minus" size={12} />
          </button>
          <span className="text-[10px] text-white/35 tabular-nums font-mono w-7 text-center">{zoomLabel}</span>
          <button onClick={() => applyZoom(zoom * 1.5)} className="btn-ghost p-1" title="Zoom in (scroll ↑)">
            <Icon name="plus" size={12} />
          </button>
        </div>
      </div>

      {/* ── Tracks ── */}
      <div className="flex flex-1 overflow-hidden" ref={tracksRef}>
        {/* Labels */}
        <div className="w-24 shrink-0 border-r border-white/[0.07] flex flex-col">
          <div className="h-5 border-b border-white/[0.07]" />
          <TrackLabel name="Vídeo" icon="video" />
          <TrackLabel name="Telemetria" icon="activity" />
          <TrackLabel name="Widgets" icon="layers" />
        </div>

        {/* Ruler + scrub area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TimelineRuler
            visibleDuration={visibleDuration}
            startSec={startSec}
            endSec={endSec}
          />

          {/* Scrubber */}
          <div
            ref={scrubberRef}
            className="flex-1 relative cursor-crosshair select-none"
            onMouseDown={handleScrubDown}
            onMouseMove={handleScrubMove}
          >
            {/* ── Track rows ── */}
            <div className="flex flex-col h-full pointer-events-none">
              {/* Video track — segment blocks */}
              <div className="flex-1 relative border-b border-white/[0.04] overflow-hidden">
                {segments.length > 0
                  ? segments.map((seg, i) => {
                      const l = Math.max(0, timeToFrac(seg.startGlobalTime)) * 100
                      const r = Math.min(1, timeToFrac(seg.startGlobalTime + seg.duration)) * 100
                      if (r <= 0 || l >= 100) return null
                      return (
                        <div
                          key={seg.id}
                          className="absolute top-1 bottom-1 rounded-sm"
                          style={{ left: `${l}%`, width: `${r - l}%`, background: SEG_COLORS[i % SEG_COLORS.length] }}
                        />
                      )
                    })
                  : duration > 0 && (
                      <div
                        className="absolute top-1 bottom-1 left-1 rounded-sm opacity-60"
                        style={{ width: `calc(${playFrac * 100}% - 4px)`, background: SEG_COLORS[0] }}
                      />
                    )}
              </div>

              {/* Telemetry track */}
              <div className="flex-1 relative border-b border-white/[0.04] overflow-hidden">
                {duration > 0 && (
                  <div
                    className="absolute top-1 bottom-1 left-0.5 rounded-sm opacity-55"
                    style={{ width: `calc(${playFrac * 100}%)`, background: "rgba(0,255,136,0.45)" }}
                  />
                )}
              </div>

              {/* Widgets track */}
              <div className="flex-1 relative border-b border-white/[0.04]" />
            </div>

            {/* ── Segment boundary markers ── */}
            {segments.slice(1).map((seg, i) => {
              const f = timeToFrac(seg.startGlobalTime)
              if (f <= 0.001 || f >= 0.999) return null
              const color = SEG_SOLID[(i + 1) % SEG_SOLID.length]
              return (
                <div
                  key={`bound-${seg.id}`}
                  className="absolute top-0 bottom-0 pointer-events-none z-10"
                  style={{ left: `${f * 100}%` }}
                >
                  <div className="absolute top-0 bottom-0 w-px" style={{ background: color, opacity: 0.8 }} />
                  <div
                    className="absolute top-0.5 text-[7px] font-bold px-0.5 rounded-sm leading-none py-0.5"
                    style={{ background: color, color: "#000", left: "2px", opacity: 0.9 }}
                  >
                    {i + 2}
                  </div>
                </div>
              )
            })}

            {/* ── Trim dim overlays ── */}
            {inFrac != null && inFrac > 0 && (
              <div
                className="absolute inset-y-0 left-0 bg-black/50 pointer-events-none z-[5]"
                style={{ width: `${Math.min(100, inFrac * 100)}%` }}
              />
            )}
            {outFrac != null && outFrac < 1 && (
              <div
                className="absolute inset-y-0 right-0 bg-black/50 pointer-events-none z-[5]"
                style={{ width: `${Math.min(100, (1 - outFrac) * 100)}%` }}
              />
            )}

            {/* ── Trim handles ── */}
            {inFrac != null && inFrac >= 0 && inFrac <= 1 && (
              <TrimHandle frac={inFrac} side="in" onMouseDown={() => setDragging("in")} />
            )}
            {outFrac != null && outFrac >= 0 && outFrac <= 1 && (
              <TrimHandle frac={outFrac} side="out" onMouseDown={() => setDragging("out")} />
            )}

            {/* ── Playhead ── */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-accent pointer-events-none z-20"
              style={{ left: `${playFrac * 100}%` }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent rounded-sm rotate-45 -translate-y-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TrackLabel({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="flex-1 flex items-center gap-2 px-3 border-b border-white/[0.05]">
      <Icon name={icon} size={11} className="text-white/30" />
      <span className="text-[10px] text-white/40 font-medium">{name}</span>
    </div>
  )
}

function TimelineRuler({
  visibleDuration,
  startSec,
  endSec,
}: {
  visibleDuration: number
  startSec: number
  endSec: number
}) {
  const interval = pickTickInterval(visibleDuration)
  const majorEvery = interval < 10 ? 5 : 2

  const ticks: { t: number; pct: number; isMajor: boolean }[] = []
  const first = Math.ceil(startSec / interval) * interval
  for (let t = first; t <= endSec + interval * 0.01; t += interval) {
    const pct = ((t - startSec) / visibleDuration) * 100
    if (pct < -1 || pct > 101) continue
    const isMajor = Math.round(t / (interval * majorEvery)) * (interval * majorEvery) === Math.round(t * 1000) / 1000
    ticks.push({ t, pct, isMajor })
  }

  return (
    <div className="h-5 relative bg-surface-100 border-b border-white/[0.07] overflow-hidden select-none">
      {ticks.map(({ t, pct, isMajor }) => (
        <div key={t} className="absolute top-0 flex flex-col items-center" style={{ left: `${pct}%` }}>
          <div className={`w-px ${isMajor ? "h-3 bg-white/20" : "h-1.5 bg-white/10"}`} />
          {isMajor && (
            <span className="text-[8px] text-white/30 font-mono mt-0.5 whitespace-nowrap">
              {formatTimecode(t)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function TrimHandle({
  frac,
  side,
  onMouseDown,
}: {
  frac: number
  side: "in" | "out"
  onMouseDown: () => void
}) {
  const color = side === "in" ? "#22dd66" : "#ff4422"
  return (
    <div
      className="absolute top-0 bottom-0 z-[15] cursor-ew-resize"
      style={{
        left: `${frac * 100}%`,
        width: 14,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onMouseDown()
      }}
    >
      {/* Vertical line */}
      <div
        className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2"
        style={{ background: color }}
      />
      {/* Handle pill at top */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-md flex items-center justify-center"
        style={{ width: 14, height: 16, background: color }}
      >
        <span className="text-[6px] font-black text-black leading-none">
          {side === "in" ? "IN" : "OUT"}
        </span>
      </div>
    </div>
  )
}
