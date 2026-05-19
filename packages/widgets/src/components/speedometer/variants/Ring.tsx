import { motion, useSpring, useTransform } from "framer-motion"
import { metersPerSecondTo } from "@velocity/shared"
import type { SpeedometerProps } from "../types"

export function RingSpeedometer({
  speed = 0,
  unit = "kmh",
  maxSpeed = 200,
  accentColor = "#00ff88",
  secondaryColor,
  theme = "dark",
  size = 140,
  showUnit = true,
  showMax = false,
}: SpeedometerProps) {
  const converted = metersPerSecondTo(speed, unit)
  const springSpeed = useSpring(converted, { stiffness: 90, damping: 20 })
  const progress = Math.min(converted / maxSpeed, 1)

  const r = 58
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - progress)

  const glowOpacity = useTransform(springSpeed, [0, maxSpeed], [0.2, 0.9])

  const bg = theme === "glass" ? "rgba(255,255,255,0.06)" :
    theme === "light" ? "rgba(255,255,255,0.97)" :
    theme === "minimal" ? "transparent" : "rgba(10,10,10,0.0)"
  const textColor = theme === "light" ? "#111" : "#fff"
  const mutedColor = theme === "light" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)"
  const trackColor = theme === "light" ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.06)"

  return (
    <div style={{
      width: size, height: size,
      background: bg,
      borderRadius: "50%",
      backdropFilter: theme === "glass" ? "blur(20px)" : undefined,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
    }}>
      <svg viewBox="0 0 140 140" width={size} height={size} style={{ position: "absolute" }}>
        {/* Outer glow ring */}
        <motion.circle cx="70" cy="70" r={r + 4} fill="none"
          stroke={accentColor} strokeWidth={1}
          strokeOpacity={glowOpacity}
          style={{ filter: `blur(3px)` }} />

        {/* Track ring */}
        <circle cx="70" cy="70" r={r} fill="none"
          stroke={trackColor} strokeWidth={8} />

        {/* Progress ring */}
        <motion.circle cx="70" cy="70" r={r} fill="none"
          stroke={accentColor} strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ filter: `drop-shadow(0 0 6px ${accentColor})` }} />

        {/* Speed dots at 25/50/75% */}
        {[0.25, 0.5, 0.75].map((pct) => {
          const angle = -90 + pct * 360
          const rad = (angle * Math.PI) / 180
          const x = 70 + r * Math.cos(rad)
          const y = 70 + r * Math.sin(rad)
          const isActive = progress >= pct
          return (
            <circle key={pct} cx={x} cy={y} r={3}
              fill={isActive ? (secondaryColor ?? "#fff") : trackColor} />
          )
        })}
      </svg>

      {/* Center content */}
      <div style={{ textAlign: "center", position: "relative" }}>
        <motion.div style={{
          fontSize: size * 0.28, fontWeight: 800, color: textColor,
          fontVariantNumeric: "tabular-nums", lineHeight: 1,
          fontFamily: "system-ui",
          textShadow: `0 0 30px ${accentColor}50`,
        }}>
          {Math.round(converted)}
        </motion.div>
        {showUnit && (
          <div style={{
            fontSize: size * 0.09, color: mutedColor, letterSpacing: "0.14em",
            textTransform: "uppercase", fontFamily: "system-ui", marginTop: 2,
          }}>{unit}</div>
        )}
        {showMax && (
          <div style={{ fontSize: size * 0.07, color: mutedColor, marginTop: 1, fontFamily: "system-ui" }}>
            / {maxSpeed}
          </div>
        )}
      </div>
    </div>
  )
}
