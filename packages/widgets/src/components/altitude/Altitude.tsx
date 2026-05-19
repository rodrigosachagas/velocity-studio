import { motion, useSpring } from "framer-motion"
import type { AltitudeUnit } from "@velocity/shared"
import { metersToFeet } from "@velocity/shared"

interface AltitudeProps {
  altitude?: number
  unit?: AltitudeUnit
  accentColor?: string
  theme?: "dark" | "light" | "glass" | "minimal"
  width?: number
  height?: number
}

export function Altitude({
  altitude = 0,
  unit = "m",
  accentColor = "#4488ff",
  theme = "dark",
  width = 140,
  height = 60,
}: AltitudeProps) {
  const value = unit === "ft" ? metersToFeet(altitude) : altitude
  const springAlt = useSpring(value, { stiffness: 60, damping: 20 })

  const bg =
    theme === "glass"
      ? "rgba(255,255,255,0.1)"
      : theme === "light"
        ? "rgba(255,255,255,0.92)"
        : theme === "minimal"
          ? "transparent"
          : "rgba(0,0,0,0.85)"

  const textColor = theme === "light" ? "#111" : "#fff"
  const mutedColor = theme === "light" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)"

  return (
    <div
      style={{
        width,
        height,
        background: bg,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 16px",
      }}
    >
      {/* Mountain icon */}
      <svg width={24} height={24} viewBox="0 0 24 24">
        <path
          d="M3 20L12 4L21 20H3Z"
          fill="none"
          stroke={accentColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path d="M8 20L12 12L16 20" fill={accentColor} opacity={0.3} />
      </svg>

      <div>
        <div
          style={{
            fontSize: 9,
            color: mutedColor,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Altitude
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <motion.span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: textColor,
              fontVariantNumeric: "tabular-nums",
              fontFamily: "system-ui, sans-serif",
              lineHeight: 1,
            }}
          >
            {springAlt.get().toFixed(0)}
          </motion.span>
          <span
            style={{
              fontSize: 11,
              color: mutedColor,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {unit}
          </span>
        </div>
      </div>
    </div>
  )
}
