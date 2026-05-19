import { motion, useSpring, useTransform } from "framer-motion"
import { metersPerSecondTo, type SpeedUnit } from "@velocity/shared"

interface SpeedometerProps {
  speed?: number
  unit?: SpeedUnit
  maxSpeed?: number
  accentColor?: string
  theme?: "dark" | "light" | "glass" | "minimal"
  size?: number
  label?: boolean
}

const THEMES = {
  dark: {
    bg: "rgba(0,0,0,0.85)",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.4)",
    border: "rgba(255,255,255,0.08)",
  },
  light: {
    bg: "rgba(255,255,255,0.92)",
    text: "#111111",
    muted: "rgba(0,0,0,0.4)",
    border: "rgba(0,0,0,0.08)",
  },
  glass: {
    bg: "rgba(255,255,255,0.1)",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.5)",
    border: "rgba(255,255,255,0.2)",
  },
  minimal: {
    bg: "transparent",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.5)",
    border: "transparent",
  },
}

export function Speedometer({
  speed = 0,
  unit = "kmh",
  maxSpeed = 200,
  accentColor = "#00ff88",
  theme = "dark",
  size = 160,
  label = true,
}: SpeedometerProps) {
  const converted = metersPerSecondTo(speed, unit)
  const colors = THEMES[theme]

  const springSpeed = useSpring(converted, { stiffness: 120, damping: 20 })
  const rotation = useTransform(springSpeed, [0, maxSpeed], [-135, 135])

  const r = 60
  const strokeWidth = 6
  const circumference = 2 * Math.PI * r
  const arcLength = (270 / 360) * circumference
  const progress = Math.min(converted / maxSpeed, 1)
  const dashOffset = arcLength * (1 - progress)

  return (
    <div
      style={{
        width: size,
        height: size,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "50%",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <svg
        viewBox="0 0 160 160"
        width={size}
        height={size}
        style={{ position: "absolute", inset: 0 }}
      >
        {/* Track arc */}
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={colors.muted}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform="rotate(135 80 80)"
          opacity={0.3}
        />
        {/* Progress arc */}
        <motion.circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={accentColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(135 80 80)"
          style={{ filter: `drop-shadow(0 0 6px ${accentColor})` }}
        />
        {/* Needle */}
        <motion.line
          x1="80"
          y1="80"
          x2="80"
          y2="26"
          stroke={accentColor}
          strokeWidth={2}
          strokeLinecap="round"
          style={{
            transformOrigin: "80px 80px",
            rotate: rotation,
          }}
        />
        <circle cx="80" cy="80" r={4} fill={accentColor} />
      </svg>

      {/* Value display */}
      <div style={{ position: "relative", textAlign: "center", marginTop: size * 0.1 }}>
        <motion.div
          style={{
            fontSize: size * 0.2,
            fontWeight: 700,
            color: colors.text,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {Math.round(converted)}
        </motion.div>
        {label && (
          <div
            style={{
              fontSize: size * 0.085,
              color: colors.muted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {unit}
          </div>
        )}
      </div>
    </div>
  )
}
