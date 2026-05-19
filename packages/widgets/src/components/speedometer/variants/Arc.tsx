import { motion, useSpring, useTransform } from "framer-motion"
import { metersPerSecondTo } from "@velocity/shared"
import type { SpeedometerProps } from "../types"

export function ArcSpeedometer({
  speed = 0,
  unit = "kmh",
  maxSpeed = 200,
  accentColor = "#00ff88",
  secondaryColor,
  theme = "dark",
  size = 160,
  showLabel = true,
  showUnit = true,
  showMax = false,
  tickCount = 9,
}: SpeedometerProps) {
  const converted = metersPerSecondTo(speed, unit)
  const springSpeed = useSpring(converted, { stiffness: 120, damping: 20 })
  const rotation = useTransform(springSpeed, [0, maxSpeed], [-135, 135])

  const bg =
    theme === "glass" ? "rgba(255,255,255,0.08)" :
    theme === "light" ? "rgba(255,255,255,0.95)" :
    theme === "minimal" ? "transparent" :
    "rgba(12,12,12,0.92)"
  const textColor = theme === "light" ? "#111" : "#fff"
  const mutedColor = theme === "light" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)"
  const trackColor = theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.07)"

  const r = 60
  const circumference = 2 * Math.PI * r
  const arcFraction = 270 / 360
  const arcLength = arcFraction * circumference
  const progress = Math.min(converted / maxSpeed, 1)
  const dashOffset = arcLength * (1 - progress)

  return (
    <div style={{
      width: size, height: size,
      background: bg,
      border: theme === "minimal" ? "none" : `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: "50%",
      backdropFilter: theme === "glass" ? "blur(16px)" : undefined,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      boxShadow: theme !== "minimal" ? "0 8px 32px rgba(0,0,0,0.4)" : undefined,
    }}>
      <svg viewBox="0 0 160 160" width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        {/* Track */}
        <circle cx="80" cy="80" r={r} fill="none"
          stroke={trackColor} strokeWidth={6}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(135 80 80)" />

        {/* Progress */}
        <motion.circle cx="80" cy="80" r={r} fill="none"
          stroke={accentColor} strokeWidth={6}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(135 80 80)"
          style={{ filter: `drop-shadow(0 0 8px ${accentColor}88)` }} />

        {/* Tick marks */}
        {Array.from({ length: tickCount + 1 }, (_, i) => {
          const angle = -135 + (i / tickCount) * 270
          const rad = (angle * Math.PI) / 180
          const isMajor = i % Math.ceil(tickCount / 4) === 0
          const inner = isMajor ? 42 : 44
          const outer = 50
          return (
            <line key={i}
              x1={80 + inner * Math.cos(rad)} y1={80 + inner * Math.sin(rad)}
              x2={80 + outer * Math.cos(rad)} y2={80 + outer * Math.sin(rad)}
              stroke={isMajor ? mutedColor : trackColor}
              strokeWidth={isMajor ? 1.5 : 0.75} />
          )
        })}

        {/* Needle */}
        <motion.g style={{ transformOrigin: "80px 80px", rotate: rotation }}>
          <line x1="80" y1="80" x2="80" y2="27"
            stroke={accentColor} strokeWidth={2} strokeLinecap="round" />
          <line x1="80" y1="80" x2="80" y2="94"
            stroke={secondaryColor ?? mutedColor} strokeWidth={1.5} strokeLinecap="round" />
        </motion.g>
        <circle cx="80" cy="80" r={5} fill={accentColor}
          style={{ filter: `drop-shadow(0 0 4px ${accentColor})` }} />

        {showMax && (
          <text x="80" y="110" textAnchor="middle" fill={mutedColor}
            fontSize="9" fontFamily="system-ui">{maxSpeed}</text>
        )}
      </svg>

      <div style={{ position: "relative", textAlign: "center", marginTop: size * 0.08 }}>
        <motion.div style={{
          fontSize: size * 0.2, fontWeight: 700, color: textColor,
          fontVariantNumeric: "tabular-nums", lineHeight: 1,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
          {Math.round(converted)}
        </motion.div>
        {showUnit && (
          <div style={{
            fontSize: size * 0.08, color: mutedColor,
            textTransform: "uppercase", letterSpacing: "0.12em",
            fontFamily: "system-ui", marginTop: 1,
          }}>{unit}</div>
        )}
      </div>
    </div>
  )
}
