// 20 circular speedometer variants (SC01–SC20), translated from the design prototype.
import React, { useEffect, useRef } from "react"
import { motion, useSpring, useTransform } from "framer-motion"
import { metersPerSecondTo } from "@velocity/shared"
import type { SpeedUnit } from "@velocity/shared"
import { useExportMode } from "../../../contexts/ExportModeContext"
import type { SpeedometerProps } from "../types"

// ─── helpers ────────────────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function arcD(cx: number, cy: number, r: number, a1: number, a2: number): string {
  const [x1, y1] = polar(cx, cy, r, a1)
  const [x2, y2] = polar(cx, cy, r, a2)
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0
  const sweep = a2 > a1 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`
}

function useCirc(speed: number, unit: SpeedUnit, maxSpeed: number) {
  const isExport = useExportMode()
  const v = metersPerSecondTo(speed, unit)
  const sp = useSpring(0, { stiffness: 120, damping: 20 })
  useEffect(() => { isExport ? sp.jump(v) : sp.set(v) }, [v, isExport, sp])
  const pct = Math.min(v / maxSpeed, 1)
  return { v, pct, sp }
}

interface Colors {
  fg: string; muted: string; track: string; bg: string; bd: string
  accent: string; warn: string; danger: string
}
function clrs(theme: string | undefined, accent: string): Colors {
  const t = theme ?? "dark"
  const light = t === "light"
  return {
    fg:     light ? "#111" : "#fff",
    muted:  light ? "rgba(0,0,0,0.35)"  : "rgba(255,255,255,0.3)",
    track:  light ? "rgba(0,0,0,0.08)"  : "rgba(255,255,255,0.08)",
    bg:     t === "glass"   ? "rgba(255,255,255,0.08)" :
            light           ? "rgba(255,255,255,0.95)" :
            t === "minimal" ? "transparent" : "rgba(10,10,12,0.92)",
    bd:     t === "minimal" ? "transparent" :
            light           ? "1px solid rgba(0,0,0,0.08)" :
                              "1px solid rgba(255,255,255,0.07)",
    accent,
    warn:   "#ffaa00",
    danger: "#ff3333",
  }
}

function Shell({ size, c, rounded = 12, children }: {
  size: number; c: Colors; rounded?: number | string; children: React.ReactNode
}) {
  return (
    <div style={{
      width: size, height: size, background: c.bg, border: c.bd,
      borderRadius: rounded,
      backdropFilter: c.bd !== "transparent" ? undefined : undefined,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
      boxShadow: c.bg !== "transparent" ? "0 8px 32px rgba(0,0,0,0.4)" : undefined,
    }}>{children}</div>
  )
}

const MONO = "ui-monospace,'Cascadia Code',monospace"

// ─── SC01 · Classic 240° arc ────────────────────────────────────────────────
export function ClassicSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct, sp } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const S = -210, W = 240, r = 82, cx = 100, cy = 100
  const circ = 2 * Math.PI * r
  const arcLen = (W / 360) * circ
  const dashOff = useTransform(sp, [0, maxSpeed], [arcLen, 0])
  const trackRotation = S + 90 // start angle → SVG rotation offset
  const ticks = 13 // major every 2 = 7 labels

  return (
    <Shell size={size} c={c} rounded={12}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={c.track} strokeWidth={8}
          strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round"
          transform={`rotate(${trackRotation} ${cx} ${cy})`} />
        {/* Progress */}
        <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke={c.accent} strokeWidth={8}
          strokeDasharray={`${arcLen} ${circ}`}
          strokeDashoffset={dashOff}
          strokeLinecap="round"
          transform={`rotate(${trackRotation} ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 8px ${c.accent}88)` }} />
        {/* Ticks */}
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const a = S + (W / ticks) * i
          const major = i % 2 === 0
          const [x1, y1] = polar(cx, cy, r + 2, a)
          const [x2, y2] = polar(cx, cy, major ? r - 10 : r - 6, a)
          const [lx, ly] = polar(cx, cy, r - 18, a)
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={major ? c.muted : c.track} strokeWidth={major ? 1.5 : 0.8} />
              {major && i % 4 === 0 && (
                <text x={lx} y={ly + 3} textAnchor="middle"
                  fill={c.muted} fontSize="9" fontFamily={MONO}>
                  {Math.round((i / ticks) * maxSpeed)}
                </text>
              )}
            </g>
          )
        })}
        {/* Value */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="42" fontWeight={500}
          fill={c.fg} fontFamily={MONO} letterSpacing="-0.03em">
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x={cx} y={cy + 16} textAnchor="middle" fontSize="9" letterSpacing="0.3em"
            fill={c.muted} fontFamily={MONO}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC02 · Minimal thin ring ────────────────────────────────────────────────
export function ThinRingSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const r = 88, circ = 2 * Math.PI * r

  return (
    <Shell size={size} c={c} rounded="50%">
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        <circle cx="100" cy="100" r={r} fill="none" stroke={c.track} strokeWidth="1.5" />
        <circle cx="100" cy="100" r={r} fill="none" stroke={c.accent} strokeWidth="1.5"
          strokeDasharray={`${circ * pct} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 100 100)"
          style={{ filter: `drop-shadow(0 0 6px ${c.accent})` }} />
        <text x="100" y="96" textAnchor="middle" fontFamily={MONO}
          fontSize="48" fontWeight={300} letterSpacing="-0.04em" fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="114" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC03 · Segmented LED arc ────────────────────────────────────────────────
export function LEDSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const segs = 28, start = -210, sweep = 240
  const filled = Math.round(pct * segs)

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {Array.from({ length: segs }, (_, i) => {
          const a = start + (sweep / segs) * (i + 0.5)
          const active = i < filled
          const warn = i / segs > 0.85
          const color = active ? (warn ? c.warn : c.accent) : c.track
          const [x1, y1] = polar(100, 100, 86, a)
          const [x2, y2] = polar(100, 100, 70, a)
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color} strokeWidth="4" strokeLinecap="round"
              style={active ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined} />
          )
        })}
        <text x="100" y="104" textAnchor="middle" fontFamily={MONO}
          fontSize="42" fontWeight={500} fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="122" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC04 · Dual ring (current outer + session avg inner) ────────────────────
export function DualRingSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  // accumulate a running average
  const avgRef = useRef<{ sum: number; n: number }>({ sum: 0, n: 0 })
  useEffect(() => {
    if (v > 0) { avgRef.current.sum += v; avgRef.current.n++ }
  }, [v])
  const avg = avgRef.current.n > 0 ? avgRef.current.sum / avgRef.current.n : v * 0.8
  const avgPct = Math.min(avg / maxSpeed, 1)

  const r1 = 82, r2 = 64
  const c1 = 2 * Math.PI * r1, c2 = 2 * Math.PI * r2

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        <circle cx="100" cy="100" r={r1} fill="none" stroke={c.track} strokeWidth="3" />
        <circle cx="100" cy="100" r={r1} fill="none" stroke={c.accent} strokeWidth="3"
          strokeDasharray={`${c1 * pct} ${c1}`} strokeLinecap="round"
          transform="rotate(-90 100 100)"
          style={{ filter: `drop-shadow(0 0 6px ${c.accent})` }} />
        <circle cx="100" cy="100" r={r2} fill="none" stroke={c.track} strokeWidth="2" />
        <circle cx="100" cy="100" r={r2} fill="none" stroke={c.fg} strokeWidth="2"
          strokeOpacity={0.5}
          strokeDasharray={`${c2 * avgPct} ${c2}`} strokeLinecap="round"
          transform="rotate(-90 100 100)" />
        <text x="100" y="96" textAnchor="middle" fontFamily={MONO}
          fontSize="36" fill={c.accent} fontWeight={500}>
          {Math.round(v)}
        </text>
        <text x="100" y="118" textAnchor="middle" fontFamily={MONO}
          fontSize="11" fill={c.muted}>
          avg {Math.round(avg)}
        </text>
        {showUnit && (
          <text x="100" y="134" textAnchor="middle" fontFamily={MONO}
            fontSize="8" letterSpacing="0.2em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC05 · Tick progressive lighting ───────────────────────────────────────
export function TicksSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const ticks = 60, start = -210, sweep = 240
  const filled = Math.round(pct * ticks)

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const a = start + (sweep / ticks) * i
          const active = i <= filled
          const major = i % 6 === 0
          const [x1, y1] = polar(100, 100, 88, a)
          const [x2, y2] = polar(100, 100, major ? 74 : 81, a)
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={active ? c.accent : c.track}
              strokeOpacity={active ? 1 : 0.4}
              strokeWidth={major ? 1.6 : 1}
              style={active ? { filter: `drop-shadow(0 0 3px ${c.accent})` } : undefined} />
          )
        })}
        <text x="100" y="102" textAnchor="middle" fontFamily={MONO}
          fontSize="40" fontWeight={500} fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="122" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC06 · Inverted CCW fill ────────────────────────────────────────────────
export function InvertSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const r = 82, circ = 2 * Math.PI * r

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        <circle cx="100" cy="100" r={r} fill="none" stroke={c.track} strokeWidth="10" />
        {/* CCW fill: rotate -90 then flip Y */}
        <circle cx="100" cy="100" r={r} fill="none" stroke={c.accent} strokeWidth="10"
          strokeDasharray={`${circ * pct} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 100 100) scale(1 -1) translate(0 -200)"
          style={{ filter: `drop-shadow(0 0 6px ${c.accent})` }} />
        <text x="100" y="104" textAnchor="middle" fontFamily={MONO}
          fontSize="40" fontWeight={500} fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="124" textAnchor="middle" fontFamily={MONO}
            fontSize="8" letterSpacing="0.25em" fill={c.muted}>
            {(unit as string).toUpperCase()} · CCW
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC07 · Full 360° conic gradient ────────────────────────────────────────
export function ConicSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)

  return (
    <Shell size={size} c={c}>
      <div style={{
        width: size * 0.78, height: size * 0.78, borderRadius: "50%",
        background: `conic-gradient(from -90deg, ${c.accent} 0%, ${c.accent} ${pct * 100}%, ${c.track} ${pct * 100}%, ${c.track} 100%)`,
        padding: 6,
      }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: "50%", background: c.bg,
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
          gap: 2,
        }}>
          <span style={{ fontSize: size * 0.2, fontWeight: 500, color: c.fg, lineHeight: 1, fontFamily: MONO, letterSpacing: "-0.03em" }}>
            {Math.round(v)}
          </span>
          {showUnit && (
            <span style={{ fontSize: size * 0.045, color: c.muted, letterSpacing: "0.3em", fontFamily: MONO }}>
              {(unit as string).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </Shell>
  )
}

// ─── SC08 · Half-moon 180° ───────────────────────────────────────────────────
export function HalfMoonSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 130" width={size} height={size * 0.65} style={{ position: "absolute", bottom: 0 }}>
        <path d={arcD(100, 110, 82, 180, 360)} fill="none" stroke={c.track} strokeWidth="10" strokeLinecap="round" />
        <path d={arcD(100, 110, 82, 180, 180 + 180 * pct)} fill="none" stroke={c.accent} strokeWidth="10" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${c.accent})` }} />
        {Array.from({ length: 9 }, (_, i) => {
          const a = 180 + i * 22.5
          const [x1, y1] = polar(100, 110, 68, a)
          const [x2, y2] = polar(100, 110, 60, a)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.muted} strokeWidth="1" />
        })}
        <text x="100" y="100" textAnchor="middle" fontFamily={MONO}
          fontSize="40" fontWeight={500} fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="120" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC09 · Triple concentric rings ─────────────────────────────────────────
export function TripleRingSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {([88, 74, 60] as const).map((r, i) => {
          const circ = 2 * Math.PI * r
          const offset = [0, 0.05, 0.1][i]!
          const p = Math.max(0, pct - offset)
          return (
            <g key={r}>
              <circle cx="100" cy="100" r={r} fill="none" stroke={c.track} strokeWidth="2.5" />
              <circle cx="100" cy="100" r={r} fill="none" stroke={c.accent} strokeWidth="2.5"
                strokeOpacity={1 - i * 0.25}
                strokeDasharray={`${circ * p} ${circ}`} strokeLinecap="round"
                transform="rotate(-90 100 100)"
                style={{ filter: `drop-shadow(0 0 ${4 - i}px ${c.accent})` }} />
            </g>
          )
        })}
        <text x="100" y="102" textAnchor="middle" fontFamily={MONO}
          fontSize="32" fontWeight={500} fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="118" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC10 · Dotted ring ──────────────────────────────────────────────────────
export function DotsSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const dots = 36, filled = Math.round(pct * dots)

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {Array.from({ length: dots }, (_, i) => {
          const a = -90 + (i / dots) * 360
          const [x, y] = polar(100, 100, 84, a)
          const active = i < filled
          return (
            <circle key={i} cx={x} cy={y} r={active ? 2.4 : 1.6}
              fill={active ? c.accent : c.muted}
              opacity={active ? 1 : 0.3}
              style={active ? { filter: `drop-shadow(0 0 4px ${c.accent})` } : undefined} />
          )
        })}
        <text x="100" y="102" textAnchor="middle" fontFamily={MONO}
          fontSize="40" fontWeight={500} fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="122" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC11 · Heavy analog needle ──────────────────────────────────────────────
export function AnalogNeedleSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, sp } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const ticks = 25, labels = 7
  // SVG-native rotate(angle,cx,cy) avoids CSS transformOrigin ambiguity on SVG elements.
  const needleSVGTransform = useTransform(sp, [0, maxSpeed], [
    "rotate(-120,100,100)",
    "rotate(120,100,100)",
  ])

  return (
    <Shell size={size} c={c} rounded="50%">
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        <circle cx="100" cy="100" r="90" fill="none" stroke={c.track} strokeWidth="2" />
        {Array.from({ length: ticks }, (_, i) => {
          const a = -210 + (i / (ticks - 1)) * 240
          const major = i % 4 === 0
          const [x1, y1] = polar(100, 100, 84, a)
          const [x2, y2] = polar(100, 100, major ? 70 : 77, a)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={major ? c.fg : c.track} strokeWidth={major ? 2 : 1} />
        })}
        {Array.from({ length: labels }, (_, i) => {
          const a = -210 + (i / (labels - 1)) * 240
          const [x, y] = polar(100, 100, 56, a)
          return <text key={i} x={x} y={y + 4} textAnchor="middle"
            fontFamily={MONO} fontSize="11" fill={c.muted}>
            {Math.round((i / (labels - 1)) * maxSpeed)}
          </text>
        })}
        <motion.g transform={needleSVGTransform}>
          <polygon points="100,100 96,26 100,16 104,26" fill={c.accent}
            style={{ filter: `drop-shadow(0 0 6px ${c.accent})` }} />
        </motion.g>
        <circle cx="100" cy="100" r="10" fill={c.bg} stroke={c.accent} strokeWidth="1.5" />
        <circle cx="100" cy="100" r="3" fill={c.accent} />
        {showUnit && (
          <text x="100" y="160" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC12 · Numerals around ring ─────────────────────────────────────────────
export function NumeralsSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const r = 76, start = -210, sweep = 240
  const labelVals = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map(f => Math.round(f * maxSpeed))

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {/* Track: 240° arc from -210° to 30° (same span as labels) */}
        <path d={arcD(100, 100, r, start, start + sweep)} fill="none"
          stroke={c.track} strokeWidth="6" strokeLinecap="round" />
        {/* Progress: fills from -210° clockwise */}
        {pct > 0.001 && (
          <path d={arcD(100, 100, r, start, start + sweep * pct)} fill="none"
            stroke={c.accent} strokeWidth="6" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${c.accent})` }} />
        )}
        {labelVals.map((val, i) => {
          const a = -210 + (val / maxSpeed) * 240
          const [x, y] = polar(100, 100, 94, a)
          return <text key={i} x={x} y={y + 3} textAnchor="middle"
            fontFamily={MONO} fontSize="9" fill={c.muted}>{val}</text>
        })}
        <text x="100" y="104" textAnchor="middle" fontFamily={MONO}
          fontSize="38" fontWeight={500} fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="122" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC14 · Notched chunky arc ───────────────────────────────────────────────
export function NotchedSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const notches = 12, start = -210, sweep = 240

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {Array.from({ length: notches }, (_, i) => {
          const a1 = start + (sweep / notches) * i + 1
          const a2 = start + (sweep / notches) * (i + 1) - 1
          const active = (i + 1) / notches <= pct
          // last 2 notches (10,11) → red; middle half (6-9) → yellow; lower half → green
          const zoneColor = i >= 10 ? c.danger : i >= 6 ? c.warn : c.accent
          const color = active ? zoneColor : c.track
          return (
            <path key={i} d={arcD(100, 100, 80, a1, a2)} fill="none"
              stroke={color} strokeWidth="14" strokeLinecap="butt"
              opacity={active ? 1 : 0.25}
              style={active ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined} />
          )
        })}
        <text x="100" y="106" textAnchor="middle" fontFamily={MONO}
          fontSize="42" fontWeight={500} fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="124" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC15 · Glow-only (no track ring) ───────────────────────────────────────
export function GlowOnlySpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const start = -210, sweep = 240
  const arcColor = pct > 0.9 ? c.danger : pct > 0.5 ? c.warn : c.accent

  return (
    <Shell size={size} c={{ ...c, bg: "rgba(0,0,0,0.95)", bd: "1px solid rgba(255,255,255,0.04)" }}>
      <svg viewBox="0 0 220 220" width={size} height={size} style={{ position: "absolute" }}>
        <defs>
          <filter id="big-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {pct > 0.001 && <>
          {/* Soft glow layer */}
          <path d={arcD(110, 110, 84, start, start + sweep * pct)}
            fill="none" stroke={arcColor} strokeWidth="16" strokeLinecap="round"
            opacity="0.2" filter="url(#big-glow)" />
          {/* Mid layer */}
          <path d={arcD(110, 110, 84, start, start + sweep * pct)}
            fill="none" stroke={arcColor} strokeWidth="5" strokeLinecap="round"
            opacity="0.7" />
          {/* Sharp edge */}
          <path d={arcD(110, 110, 84, start, start + sweep * pct)}
            fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="1.5" strokeLinecap="round" />
        </>}
        <text x="110" y="118" textAnchor="middle" fontFamily={MONO}
          fontSize="58" fontWeight={300} letterSpacing="-0.05em" fill="rgba(255,255,255,0.95)">
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="110" y="140" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill="rgba(255,255,255,0.3)">
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC16 · Stepped blocks ───────────────────────────────────────────────────
export function StepBlocksSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const blocks = 8, start = -210, sweep = 240

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {Array.from({ length: blocks }, (_, i) => {
          const a1 = start + (sweep / blocks) * i + 2.5
          const a2 = start + (sweep / blocks) * (i + 1) - 2.5
          const active = (i + 1) / blocks <= pct
          // blocks 0-3 (0–50%) green, 4-6 (50–87.5%) yellow, 7 (87.5–100%) red
          const zoneColor = i >= 7 ? c.danger : i >= 4 ? c.warn : c.accent
          return (
            <g key={i}>
              <path d={arcD(100, 100, 80, a1, a2)} fill="none" stroke={c.track} strokeWidth="18" />
              {active && (
                <path d={arcD(100, 100, 80, a1, a2)} fill="none" stroke={zoneColor} strokeWidth="18"
                  style={{ filter: `drop-shadow(0 0 6px ${zoneColor})` }} />
              )}
            </g>
          )
        })}
        <text x="100" y="102" textAnchor="middle" fontFamily={MONO}
          fontSize="40" fontWeight={500} fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="122" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC17 · Redline zone ─────────────────────────────────────────────────────
export function RedlineSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const start = -210, sweep = 240
  const warnZone = 0.5, dangerZone = 0.9
  const fillColor = pct > dangerZone ? c.danger : pct > warnZone ? c.warn : c.accent
  const inDanger = pct > dangerZone
  const [dl_x1, dl_y1] = polar(100, 100, 94, start + sweep * dangerZone)
  const [dl_x2, dl_y2] = polar(100, 100, 64, start + sweep * dangerZone)

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {/* Track */}
        <path d={arcD(100, 100, 80, start, start + sweep)} fill="none"
          stroke={c.track} strokeWidth="10" strokeLinecap="round" />
        {/* Yellow zone (50–90%) */}
        <path d={arcD(100, 100, 80, start + sweep * warnZone, start + sweep * dangerZone)} fill="none"
          stroke={c.warn} strokeWidth="10" strokeLinecap="butt" opacity="0.18" />
        {/* Red zone (90–100%) */}
        <path d={arcD(100, 100, 80, start + sweep * dangerZone, start + sweep)} fill="none"
          stroke={c.danger} strokeWidth="10" strokeLinecap="round" opacity="0.3" />
        {/* Active fill */}
        {pct > 0.001 && (
          <path d={arcD(100, 100, 80, start, start + sweep * pct)} fill="none"
            stroke={fillColor} strokeWidth="10" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${fillColor})` }} />
        )}
        {/* Danger zone tick */}
        <line x1={dl_x1} y1={dl_y1} x2={dl_x2} y2={dl_y2} stroke={c.danger} strokeWidth="2" />
        <text x="100" y="104" textAnchor="middle" fontFamily={MONO}
          fontSize="42" fontWeight={500} fill={inDanger ? c.danger : c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="124" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={inDanger ? c.danger : c.muted}>
            {inDanger ? "REDLINE" : (unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC18 · Heat gradient sweep ─────────────────────────────────────────────
export function HeatGradientSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const start = -210, sweep = 240
  const gradId = `heat-${size}`

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="20" y1="100" x2="180" y2="100">
            <stop offset="0%"   stopColor="oklch(0.82 0.16 215)" />
            <stop offset="50%"  stopColor="oklch(0.82 0.16 145)" />
            <stop offset="80%"  stopColor="oklch(0.82 0.16 75)" />
            <stop offset="100%" stopColor="oklch(0.75 0.18 25)" />
          </linearGradient>
        </defs>
        <path d={arcD(100, 100, 80, start, start + sweep)} fill="none"
          stroke={c.track} strokeWidth="10" strokeLinecap="round" />
        <path d={arcD(100, 100, 80, start, start + sweep * pct)} fill="none"
          stroke={`url(#${gradId})`} strokeWidth="10" strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 5px rgba(255,255,255,0.25))" }} />
        <text x="100" y="104" textAnchor="middle" fontFamily={MONO}
          fontSize="42" fontWeight={500} fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="124" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
      </svg>
    </Shell>
  )
}

// ─── SC19 · Mirrored dual arcs ───────────────────────────────────────────────
export function MirroredSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)

  return (
    <Shell size={size} c={c}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {/* Top arc track */}
        <path d={arcD(100, 100, 78, -170, -10)} fill="none"
          stroke={c.track} strokeWidth="8" strokeLinecap="round" />
        <path d={arcD(100, 100, 78, -170, -170 + 160 * pct)} fill="none"
          stroke={c.accent} strokeWidth="8" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${c.accent})` }} />
        {/* Bottom arc track (mirror) */}
        <path d={arcD(100, 100, 78, 10, 170)} fill="none"
          stroke={c.track} strokeWidth="8" strokeLinecap="round" />
        <path d={arcD(100, 100, 78, 170, 170 - 160 * pct)} fill="none"
          stroke={c.accent} strokeWidth="8" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${c.accent})` }} />
        <text x="100" y="94" textAnchor="middle" fontFamily={MONO}
          fontSize="36" fontWeight={500} fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="110" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.3em" fill={c.muted}>
            {(unit as string).toUpperCase()}
          </text>
        )}
        <text x="100" y="126" textAnchor="middle" fontFamily={MONO}
          fontSize="11" fill={c.accent}>
          {(pct * 100).toFixed(0)}%
        </text>
      </svg>
    </Shell>
  )
}

// ─── SC20 · Cyberpunk hex ────────────────────────────────────────────────────
export function CyberpunkSpeedometer({
  speed = 0, unit = "kmh", maxSpeed = 200,
  accentColor = "#00ff88", theme = "dark", size = 220, showUnit = true,
}: SpeedometerProps) {
  const { v, pct } = useCirc(speed, unit as SpeedUnit, maxSpeed)
  const c = clrs(theme, accentColor)
  const start = -210, sweep = 240
  const segs = 40, filled = Math.round(pct * segs)

  return (
    <Shell size={size} c={{ ...c, bg: "rgba(4,4,6,0.97)", bd: "1px solid rgba(255,255,255,0.05)" }}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {/* Hex frame */}
        <polygon points="100,8 168,40 168,160 100,192 32,160 32,40"
          fill="none" stroke={c.track} strokeWidth="1" strokeDasharray="4 3" />
        {/* Inner arc track */}
        <path d={arcD(100, 100, 70, start, start + sweep)} fill="none"
          stroke={c.track} strokeWidth="2" />
        {/* Segmented fill */}
        {Array.from({ length: segs }, (_, i) => {
          if (i >= filled) return null
          const a1 = start + (sweep / segs) * i + 0.4
          const a2 = start + (sweep / segs) * (i + 1) - 0.4
          return (
            <path key={i} d={arcD(100, 100, 70, a1, a2)} fill="none"
              stroke={c.accent} strokeWidth="6"
              style={{ filter: `drop-shadow(0 0 4px ${c.accent})` }} />
          )
        })}
        {/* Corner brackets */}
        <line x1="30" y1="60" x2="30" y2="40" stroke={c.accent} strokeWidth="1.5" />
        <line x1="30" y1="40" x2="50" y2="40" stroke={c.accent} strokeWidth="1.5" />
        <line x1="170" y1="60" x2="170" y2="40" stroke={c.accent} strokeWidth="1.5" />
        <line x1="170" y1="40" x2="150" y2="40" stroke={c.accent} strokeWidth="1.5" />
        <line x1="30" y1="140" x2="30" y2="160" stroke={c.accent} strokeWidth="1.5" />
        <line x1="30" y1="160" x2="50" y2="160" stroke={c.accent} strokeWidth="1.5" />
        <line x1="170" y1="140" x2="170" y2="160" stroke={c.accent} strokeWidth="1.5" />
        <line x1="170" y1="160" x2="150" y2="160" stroke={c.accent} strokeWidth="1.5" />
        <text x="100" y="100" textAnchor="middle" fontFamily={MONO}
          fontSize="38" fontWeight={500} letterSpacing="-0.03em" fill={c.fg}>
          {Math.round(v)}
        </text>
        {showUnit && (
          <text x="100" y="118" textAnchor="middle" fontFamily={MONO}
            fontSize="9" letterSpacing="0.4em" fill={c.accent}>
            {(unit as string).toUpperCase()} · SYS
          </text>
        )}
        <text x="30" y="100" fontFamily={MONO} fontSize="7" fill={c.muted}>▸</text>
        <text x="164" y="100" fontFamily={MONO} fontSize="7" fill={c.muted}>◂</text>
      </svg>
    </Shell>
  )
}
