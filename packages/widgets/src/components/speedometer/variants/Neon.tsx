import { useEffect } from "react"
import { motion, useSpring, useTransform } from "framer-motion"
import { metersPerSecondTo } from "@velocity/shared"
import { useExportMode } from "../../../contexts/ExportModeContext"
import type { SpeedometerProps } from "../types"

export function NeonSpeedometer({
  speed = 0,
  unit = "kmh",
  maxSpeed = 200,
  accentColor = "#00ff88",
  secondaryColor = "#ff00aa",
  theme = "dark",
  size = 180,
  showUnit = true,
  showMax = false,
  tickCount = 30,
}: SpeedometerProps) {
  const isExport = useExportMode()
  const converted = metersPerSecondTo(speed, unit)
  const springSpeed = useSpring(0, { stiffness: 100, damping: 16 })
  useEffect(() => { isExport ? springSpeed.jump(converted) : springSpeed.set(converted) }, [converted, isExport])

  const r = 72
  const circumference = 2 * Math.PI * r
  const arcFraction = 300 / 360
  const arcLength = arcFraction * circumference
  const progress = Math.min(converted / maxSpeed, 1)
  const dashOffset = arcLength * (1 - progress)

  const pulseOpacity = useTransform(springSpeed, [0, maxSpeed * 0.6, maxSpeed], [0.5, 0.8, 1])

  // Gradient blend: accentColor → secondaryColor
  const gradId = `neon-grad-${accentColor.replace("#", "")}`

  return (
    <div style={{
      width: size, height: size,
      background: "rgba(0,0,0,0.92)",
      borderRadius: "50%",
      border: "1px solid rgba(255,255,255,0.05)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
      boxShadow: `0 0 40px ${accentColor}20, inset 0 0 60px rgba(0,0,0,0.8)`,
    }}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accentColor} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>
          <filter id="neon-blur">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer glow blur layer */}
        <motion.circle cx="100" cy="100" r={r} fill="none"
          stroke={`url(#${gradId})`} strokeWidth={12}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(120 100 100)"
          style={{ opacity: pulseOpacity, filter: "blur(6px)" }} />

        {/* Sharp neon line */}
        <motion.circle cx="100" cy="100" r={r} fill="none"
          stroke={`url(#${gradId})`} strokeWidth={3}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(120 100 100)" />

        {/* Track */}
        <circle cx="100" cy="100" r={r} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth={3}
          strokeDasharray={`${arcLength} ${circumference}`}
          transform="rotate(120 100 100)" />

        {/* Tick marks */}
        {Array.from({ length: tickCount + 1 }, (_, i) => {
          const angle = -150 + (i / tickCount) * 300
          const rad = (angle * Math.PI) / 180
          const isMajor = i % 5 === 0
          const outer = 88
          const inner = isMajor ? 76 : 82
          const pct = i / tickCount
          const tickColor = pct <= progress
            ? (pct > 0.6 ? secondaryColor : accentColor)
            : "rgba(255,255,255,0.1)"
          return (
            <line key={i}
              x1={100 + inner * Math.cos(rad)} y1={100 + inner * Math.sin(rad)}
              x2={100 + outer * Math.cos(rad)} y2={100 + outer * Math.sin(rad)}
              stroke={tickColor} strokeWidth={isMajor ? 2 : 1} />
          )
        })}

        {/* Needle glow tip */}
        {(() => {
          const angle = -150 + progress * 300
          const rad = (angle * Math.PI) / 180
          const x = 100 + r * Math.cos(rad)
          const y = 100 + r * Math.sin(rad)
          return (
            <g>
              <circle cx={x} cy={y} r={5} fill={accentColor}
                style={{ filter: `drop-shadow(0 0 8px ${accentColor})` }} />
              <circle cx={x} cy={y} r={10} fill={accentColor} opacity={0.2}
                style={{ filter: "blur(4px)" }} />
            </g>
          )
        })()}
      </svg>

      {/* Center */}
      <div style={{ position: "relative", textAlign: "center" }}>
        <motion.div style={{
          fontSize: size * 0.22, fontWeight: 800, color: "#fff",
          fontVariantNumeric: "tabular-nums", lineHeight: 1,
          fontFamily: "system-ui",
          textShadow: `0 0 20px ${accentColor}, 0 0 40px ${accentColor}80`,
        }}>
          {Math.round(converted)}
        </motion.div>
        {showUnit && (
          <div style={{
            fontSize: size * 0.075, letterSpacing: "0.16em",
            textTransform: "uppercase", fontFamily: "system-ui",
            color: accentColor, textShadow: `0 0 10px ${accentColor}`,
            marginTop: 2,
          }}>{unit}</div>
        )}
      </div>
    </div>
  )
}
