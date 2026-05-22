import { useEffect } from "react"
import { useTransform, motion, useSpring } from "framer-motion"
import type { AltitudeUnit } from "@velocity/shared"
import { metersToFeet } from "@velocity/shared"
import { useExportMode } from "../../contexts/ExportModeContext"

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
  const isExport = useExportMode()
  const rawValue = unit === "ft" ? metersToFeet(altitude) : altitude

  const springAlt = useSpring(0, { stiffness: 60, damping: 20 })
  const altText = useTransform(springAlt, (v) => Math.round(v).toString())

  useEffect(() => { isExport ? springAlt.jump(rawValue) : springAlt.set(rawValue) }, [rawValue, isExport])

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
        backdropFilter: isExport ? undefined : "blur(12px)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 14px",
        boxSizing: "border-box",
      }}
    >
      <svg width={22} height={22} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path
          d="M3 20L12 4L21 20H3Z"
          fill="none"
          stroke={accentColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path d="M8 20L12 12L16 20" fill={accentColor} opacity={0.3} />
      </svg>

      <div style={{ minWidth: 0 }}>
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
              fontSize: Math.min(22, height * 0.42),
              fontWeight: 700,
              color: textColor,
              fontVariantNumeric: "tabular-nums",
              fontFamily: "system-ui, monospace",
              lineHeight: 1,
            }}
          >
            {altText}
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
