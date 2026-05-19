import { motion, useSpring, useTransform } from "framer-motion"
import { metersPerSecondTo } from "@velocity/shared"
import type { SpeedometerProps } from "../types"

/**
 * Split Arc — two semicircles, top half progress + bottom half mirror.
 * Very modern, often seen in EV/car infotainment dashboards.
 */
export function SplitSpeedometer({
  speed = 0,
  unit = "kmh",
  maxSpeed = 200,
  accentColor = "#4488ff",
  secondaryColor = "#00ff88",
  theme = "dark",
  size = 180,
  showUnit = true,
  showMax = true,
}: SpeedometerProps) {
  const converted = metersPerSecondTo(speed, unit)
  const springSpeed = useSpring(converted, { stiffness: 100, damping: 20 })
  const progress = Math.min(converted / maxSpeed, 1)

  const r = 72
  const circumference = 2 * Math.PI * r
  const halfCirc = circumference / 2

  // Top arc progress (0→180°)
  const topDash = halfCirc * progress
  // Bottom arc: always full, colored dimly
  const bottomDash = halfCirc

  const bg = theme === "glass" ? "rgba(10,14,30,0.8)" :
    theme === "light" ? "rgba(245,248,255,0.97)" :
    theme === "minimal" ? "transparent" : "rgba(8,10,18,0.95)"
  const textColor = theme === "light" ? "#111" : "#fff"
  const mutedColor = theme === "light" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.25)"
  const trackColor = theme === "light" ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.06)"

  const glowScale = useTransform(springSpeed, [0, maxSpeed], [0.8, 1.1])

  return (
    <div style={{
      width: size, height: size,
      background: bg,
      borderRadius: "50%",
      border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
      backdropFilter: theme === "glass" ? "blur(20px)" : undefined,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
      boxShadow: theme !== "minimal" ? `0 12px 40px rgba(0,0,0,0.6), inset 0 0 60px ${accentColor}08` : undefined,
    }}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {/* Track - top half */}
        <path d={`M ${100 - r} 100 A ${r} ${r} 0 0 1 ${100 + r} 100`}
          fill="none" stroke={trackColor} strokeWidth={8} strokeLinecap="round" />
        {/* Track - bottom half */}
        <path d={`M ${100 + r} 100 A ${r} ${r} 0 0 1 ${100 - r} 100`}
          fill="none" stroke={trackColor} strokeWidth={4} strokeLinecap="round" />

        {/* Glow outer */}
        <motion.path d={`M ${100 - r} 100 A ${r} ${r} 0 0 1 ${100 + r} 100`}
          fill="none" stroke={accentColor} strokeWidth={14}
          strokeDasharray={`${topDash} ${halfCirc}`}
          strokeLinecap="round"
          style={{ opacity: 0.25, filter: "blur(4px)" }} />

        {/* Top arc progress */}
        <motion.path d={`M ${100 - r} 100 A ${r} ${r} 0 0 1 ${100 + r} 100`}
          fill="none" stroke={accentColor} strokeWidth={8}
          strokeDasharray={`${topDash} ${halfCirc}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${accentColor})` }} />

        {/* Bottom arc — secondary */}
        <motion.path d={`M ${100 + r} 100 A ${r} ${r} 0 0 1 ${100 - r} 100`}
          fill="none"
          stroke={secondaryColor ?? accentColor}
          strokeWidth={4}
          strokeDasharray={`${halfCirc * progress} ${halfCirc}`}
          strokeLinecap="round"
          style={{ opacity: 0.7, filter: `drop-shadow(0 0 4px ${secondaryColor ?? accentColor})` }} />

        {/* Tick marks */}
        {Array.from({ length: 13 }, (_, i) => {
          const angle = 180 + (i / 12) * 180
          const rad = (angle * Math.PI) / 180
          const inner = 60
          const outer = 72
          const isMajor = i % 3 === 0
          return (
            <line key={i}
              x1={100 + inner * Math.cos(rad)} y1={100 + inner * Math.sin(rad)}
              x2={100 + outer * Math.cos(rad)} y2={100 + outer * Math.sin(rad)}
              stroke={mutedColor} strokeWidth={isMajor ? 1.5 : 0.7} />
          )
        })}

        {/* 0 and max labels */}
        <text x={100 - r - 6} y={107} textAnchor="middle"
          fill={mutedColor} fontSize="8" fontFamily="system-ui">0</text>
        <text x={100 + r + 6} y={107} textAnchor="middle"
          fill={mutedColor} fontSize="8" fontFamily="system-ui">{maxSpeed}</text>
      </svg>

      {/* Center */}
      <motion.div style={{ textAlign: "center", position: "relative", scale: glowScale }}>
        <div style={{
          fontSize: size * 0.26, fontWeight: 800, color: textColor,
          fontVariantNumeric: "tabular-nums", lineHeight: 1,
          fontFamily: "system-ui",
          textShadow: `0 0 24px ${accentColor}60`,
        }}>
          {Math.round(converted)}
        </div>
        {showUnit && (
          <div style={{
            fontSize: size * 0.08, color: mutedColor, letterSpacing: "0.14em",
            textTransform: "uppercase", fontFamily: "system-ui", marginTop: 2,
          }}>{unit}</div>
        )}
      </motion.div>
    </div>
  )
}
