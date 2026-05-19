import { useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { useTimelineStore } from "@velocity/timeline"
import { formatTimecode } from "@velocity/shared"
import { Icon } from "@/components/ui/Icon"

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

  const scrubberRef = useRef<HTMLDivElement>(null)

  const handleScrubberClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = scrubberRef.current?.getBoundingClientRect()
      if (!rect || duration === 0) return
      const t = ((e.clientX - rect.left) / rect.width) * duration
      seek(Math.max(0, Math.min(t, duration)))
    },
    [seek, duration]
  )

  const handleScrubberMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.buttons !== 1) return
      handleScrubberClick(e)
    },
    [handleScrubberClick]
  )

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div className="flex flex-col h-full bg-surface-50">
      {/* Playback controls */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.07]">
        <button
          onClick={() => seek(0)}
          className="btn-ghost p-1.5"
          title="Go to start"
        >
          <Icon name="step-backward" size={14} />
        </button>
        <button
          onClick={() => stepBackward(1)}
          className="btn-ghost p-1.5"
          title="Previous frame"
        >
          <Icon name="chevron_right" size={14} className="rotate-180" />
        </button>

        <button
          onClick={() => (isPlaying ? pause() : play())}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-accent text-black hover:bg-accent/90 active:scale-95 transition-all"
          title={isPlaying ? "Pause" : "Play"}
        >
          <Icon name={isPlaying ? "pause" : "play"} size={14} />
        </button>

        <button
          onClick={() => stepForward(1)}
          className="btn-ghost p-1.5"
          title="Next frame"
        >
          <Icon name="chevron_right" size={14} />
        </button>
        <button
          onClick={() => seek(duration)}
          className="btn-ghost p-1.5"
          title="Go to end"
        >
          <Icon name="step-forward" size={14} />
        </button>

        <div className="mx-2 h-4 w-px bg-white/[0.07]" />

        {/* Timecode */}
        <span className="font-mono text-sm text-white/70 tabular-nums">
          {formatTimecode(currentTime)}
        </span>
        <span className="text-white/20 text-xs">/</span>
        <span className="font-mono text-xs text-white/30 tabular-nums">
          {formatTimecode(duration)}
        </span>
      </div>

      {/* Scrubber + waveform area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track labels */}
        <div className="w-32 shrink-0 border-r border-white/[0.07] flex flex-col">
          <TrackLabel name="Video" icon="video" />
          <TrackLabel name="Telemetry" icon="activity" />
          <TrackLabel name="Widgets" icon="layers" />
        </div>

        {/* Tracks + scrubber */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Ruler */}
          <TimelineRuler duration={duration} currentTime={currentTime} />

          {/* Tracks */}
          <div
            ref={scrubberRef}
            className="flex-1 relative cursor-crosshair select-none"
            onClick={handleScrubberClick}
            onMouseMove={handleScrubberMouseMove}
          >
            <div className="flex flex-col h-full">
              <TrackRow color="rgba(68,136,255,0.4)" progress={progress} />
              <TrackRow color="rgba(0,255,136,0.4)" progress={progress} filled />
              <TrackRow color="rgba(255,136,68,0.4)" progress={progress} />
            </div>

            {/* Playhead */}
            <motion.div
              className="absolute top-0 bottom-0 w-0.5 bg-accent pointer-events-none z-20"
              style={{ left: `${progress * 100}%` }}
              animate={{ left: `${progress * 100}%` }}
              transition={{ type: "tween", ease: "linear", duration: 0 }}
            >
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent rounded-sm rotate-45 -translate-y-1" />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TrackLabel({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="flex-1 flex items-center gap-2 px-3 border-b border-white/[0.05]">
      <Icon name={icon} size={11} className="text-white/30" />
      <span className="text-[10px] text-white/40 font-medium">{name}</span>
    </div>
  )
}

function TimelineRuler({
  duration,
  currentTime,
}: {
  duration: number
  currentTime: number
}) {
  const ticks = Math.min(Math.floor(duration), 60)

  return (
    <div className="h-5 relative bg-surface-100 border-b border-white/[0.07] overflow-hidden">
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const pct = duration > 0 ? (i / ticks) * 100 : 0
        const isMajor = i % 5 === 0
        return (
          <div
            key={i}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${pct}%` }}
          >
            <div
              className={`w-px ${isMajor ? "h-3 bg-white/20" : "h-1.5 bg-white/10"}`}
            />
            {isMajor && (
              <span className="text-[8px] text-white/25 font-mono mt-0.5">
                {formatTimecode(i)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TrackRow({
  color,
  progress,
  filled,
}: {
  color: string
  progress: number
  filled?: boolean
}) {
  return (
    <div className="flex-1 relative border-b border-white/[0.04]">
      {filled && (
        <div
          className="absolute top-1 bottom-1 left-1 rounded-sm opacity-60"
          style={{
            width: `calc(${progress * 100}% - 4px)`,
            background: color,
          }}
        />
      )}
    </div>
  )
}
