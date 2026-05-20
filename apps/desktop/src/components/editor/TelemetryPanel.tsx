import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useProjectStore } from "@/store/useProjectStore"
import { useAppStore } from "@/store/useAppStore"
import { Icon } from "@/components/ui/Icon"

const KMH = 3.6
const PAGE_SIZE = 50

export function TelemetryPanel() {
  const telemetry = useProjectStore((s) => s.project?.telemetry)
  const currentTime = useAppStore((s) => s.videoCurrentTime)
  const [page, setPage] = useState(0)
  const [unit, setUnit] = useState<"kmh" | "mph" | "ms">("kmh")

  const toDisplay = (ms: number) => {
    if (unit === "kmh") return (ms * KMH).toFixed(1)
    if (unit === "mph") return (ms * 2.237).toFixed(1)
    return ms.toFixed(2)
  }
  const unitLabel = unit === "kmh" ? "km/h" : unit === "mph" ? "mph" : "m/s"

  const stats = useMemo(() => {
    if (!telemetry || telemetry.frames.length === 0) return null
    const speeds = telemetry.frames.map((f) => f.speed ?? 0).filter((s) => s > 0)
    const maxSpeed = Math.max(...speeds, 0)
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
    const duration = telemetry.duration / 1000 // seconds

    // approximate total distance (trapezoid integration)
    let dist = 0
    for (let i = 1; i < telemetry.frames.length; i++) {
      const a = telemetry.frames[i - 1]!
      const b = telemetry.frames[i]!
      const dt = (b.timestamp - a.timestamp) / 1000
      dist += ((a.speed ?? 0) + (b.speed ?? 0)) * 0.5 * dt
    }

    const hasGPS = telemetry.frames.some((f) => f.latitude !== undefined)

    return {
      frameCount: telemetry.frames.length,
      sampleRate: telemetry.sampleRate,
      maxSpeedMs: maxSpeed,
      avgSpeedMs: avgSpeed,
      distanceM: dist,
      durationSec: duration,
      source: (telemetry.metadata?.source as string) ?? "unknown",
      hasGPS,
    }
  }, [telemetry])

  if (!telemetry || !stats) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center"
      >
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
          <Icon name="activity" size={18} className="text-white/20" />
        </div>
        <p className="text-white/30 text-xs leading-relaxed">
          Nenhuma telemetria carregada.
          <br />
          Importe um vídeo GoPro, arquivo GPX,
          <br />
          ou use a simulação.
        </p>
      </motion.div>
    )
  }

  const frames = telemetry.frames
  const totalPages = Math.ceil(frames.length / PAGE_SIZE)
  const pageFrames = frames.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-3 p-3"
    >
      {/* Source badge */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">
          {stats.source === "gpmf" ? "GoPro GPMF"
            : stats.source === "gpx" ? "Arquivo GPX"
            : stats.source === "simulated" ? "Simulado"
            : stats.source}
        </span>
        <div className="flex gap-1">
          {(["kmh", "mph", "ms"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                unit === u ? "bg-accent/20 text-accent" : "text-white/25 hover:text-white/50"
              }`}
            >
              {u === "kmh" ? "km/h" : u === "mph" ? "mph" : "m/s"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <StatCard label="Frames" value={stats.frameCount.toLocaleString()} />
        <StatCard label="Sample Rate" value={`${stats.sampleRate.toFixed(0)} fps`} />
        <StatCard label="Vel. Máxima" value={`${toDisplay(stats.maxSpeedMs)} ${unitLabel}`} accent />
        <StatCard label="Vel. Média" value={`${toDisplay(stats.avgSpeedMs)} ${unitLabel}`} />
        <StatCard
          label="Distância"
          value={stats.distanceM >= 1000
            ? `${(stats.distanceM / 1000).toFixed(2)} km`
            : `${stats.distanceM.toFixed(0)} m`}
        />
        <StatCard label="Duração" value={formatDuration(stats.durationSec)} />
      </div>

      {/* Speed chart */}
      <SpeedChart
        frames={frames}
        currentTime={currentTime}
        maxSpeedMs={stats.maxSpeedMs}
        unit={unit}
      />

      {/* GPS available indicator */}
      {!stats.hasGPS && (
        <div className="text-[10px] text-yellow-400/70 bg-yellow-400/[0.07] rounded-lg px-2 py-1.5 leading-relaxed">
          Sem dados GPS — distância calculada por integração de velocidade.
        </div>
      )}

      {/* Data table */}
      <div className="rounded-xl border border-white/[0.07] overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/[0.03] border-b border-white/[0.07]">
          <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Amostras</span>
          <span className="text-[9px] text-white/25 font-mono">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, frames.length)} / {frames.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-mono">
            <thead>
              <tr className="text-white/25 border-b border-white/[0.05]">
                <th className="text-left px-2 py-1">Tempo</th>
                <th className="text-right px-2 py-1">{unitLabel}</th>
                {stats.hasGPS && <th className="text-right px-2 py-1">Lat</th>}
                {stats.hasGPS && <th className="text-right px-2 py-1">Lon</th>}
                <th className="text-right px-2 py-1">Alt (m)</th>
                <th className="text-right px-2 py-1">Hdg°</th>
              </tr>
            </thead>
            <tbody>
              {pageFrames.map((f, i) => {
                const ts = f.timestamp / 1000
                const isActive = Math.abs(ts - currentTime) < (1000 / telemetry.sampleRate / 1000)
                return (
                  <tr
                    key={i}
                    className={`border-b border-white/[0.03] transition-colors ${
                      isActive ? "bg-accent/10 text-accent" : "text-white/40 hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="px-2 py-0.5">{formatTimestamp(f.timestamp)}</td>
                    <td className="px-2 py-0.5 text-right">
                      {f.speed !== undefined ? toDisplay(f.speed) : "—"}
                    </td>
                    {stats.hasGPS && (
                      <td className="px-2 py-0.5 text-right">
                        {f.latitude !== undefined ? f.latitude.toFixed(6) : "—"}
                      </td>
                    )}
                    {stats.hasGPS && (
                      <td className="px-2 py-0.5 text-right">
                        {f.longitude !== undefined ? f.longitude.toFixed(6) : "—"}
                      </td>
                    )}
                    <td className="px-2 py-0.5 text-right">
                      {f.altitude !== undefined ? f.altitude.toFixed(1) : "—"}
                    </td>
                    <td className="px-2 py-0.5 text-right">
                      {f.heading !== undefined ? f.heading.toFixed(1) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/[0.07] bg-white/[0.02]">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded text-white/40 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="chevron_right" size={11} className="rotate-180" />
            </button>
            <span className="text-[9px] text-white/30 font-mono">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1 rounded text-white/40 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="chevron_right" size={11} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Sub-components

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-2 rounded-lg bg-surface-200 border border-white/[0.06]">
      <div className="text-[9px] text-white/30 mb-0.5 uppercase tracking-wider">{label}</div>
      <div className={`text-xs font-semibold font-mono ${accent ? "text-accent" : "text-white/80"}`}>
        {value}
      </div>
    </div>
  )
}

function SpeedChart({
  frames,
  currentTime,
  maxSpeedMs,
  unit,
}: {
  frames: { timestamp: number; speed?: number }[]
  currentTime: number
  maxSpeedMs: number
  unit: "kmh" | "mph" | "ms"
}) {
  const W = 220
  const H = 60
  const PAD = 4

  const toUnit = (ms: number) => {
    if (unit === "kmh") return ms * 3.6
    if (unit === "mph") return ms * 2.237
    return ms
  }
  const maxDisplay = toUnit(maxSpeedMs) || 1

  const durationMs = frames.length > 0
    ? (frames[frames.length - 1]!.timestamp - frames[0]!.timestamp)
    : 1

  const points = frames.map((f) => {
    const x = PAD + ((f.timestamp - (frames[0]?.timestamp ?? 0)) / durationMs) * (W - PAD * 2)
    const s = toUnit(f.speed ?? 0)
    const y = H - PAD - (s / maxDisplay) * (H - PAD * 2)
    return { x, y }
  })

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const area = [
    `${PAD},${H - PAD}`,
    ...points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${W - PAD},${H - PAD}`,
  ].join(" ")

  // Current time indicator
  const firstTs = frames[0]?.timestamp ?? 0
  const lastTs = frames[frames.length - 1]?.timestamp ?? 1
  const videoDurationSec = (lastTs - firstTs) / 1000
  const progress = videoDurationSec > 0 ? Math.min(currentTime / videoDurationSec, 1) : 0
  const playheadX = PAD + progress * (W - PAD * 2)

  return (
    <div className="rounded-lg bg-surface-200 border border-white/[0.06] overflow-hidden">
      <div className="px-2 pt-1.5 pb-0 text-[9px] text-white/25 uppercase tracking-wider">
        Velocidade
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block">
        {/* Zero line */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />

        {/* Area fill */}
        <polygon points={area} fill="rgba(0,255,136,0.07)" />

        {/* Speed line */}
        <polyline points={polyline} fill="none" stroke="rgba(0,255,136,0.7)" strokeWidth={1} strokeLinejoin="round" />

        {/* Playhead */}
        <line
          x1={playheadX} y1={PAD}
          x2={playheadX} y2={H - PAD}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={0.75}
          strokeDasharray="2,2"
        />

        {/* Max label */}
        <text x={W - PAD - 1} y={PAD + 6} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize={7} fontFamily="monospace">
          {maxDisplay.toFixed(0)}
        </text>
        <text x={W - PAD - 1} y={H - PAD - 2} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize={7} fontFamily="monospace">
          0
        </text>
      </svg>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers

function formatTimestamp(ms: number): string {
  const s = ms / 1000
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2).padStart(5, "0")
  return `${m}:${sec}`
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}m ${s}s`
}
