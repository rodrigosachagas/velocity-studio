import { useEffect } from "react"
import { motion, useSpring } from "framer-motion"
import { metersPerSecondTo } from "@velocity/shared"
import { useExportMode } from "../../../contexts/ExportModeContext"
import type { SpeedometerProps } from "../types"

export function DigitalSpeedometer({
  speed = 0,
  unit = "kmh",
  maxSpeed = 200,
  accentColor = "#00ff88",
  theme = "dark",
  width = 180,
  height = 100,
  showUnit = true,
  showLabel = true,
  label = "SPEED",
}: SpeedometerProps) {
  const isExport = useExportMode()
  const converted = metersPerSecondTo(speed, unit)
  const springSpeed = useSpring(0, { stiffness: 80, damping: 18 })
  useEffect(() => { isExport ? springSpeed.jump(converted) : springSpeed.set(converted) }, [converted, isExport])
  const progress = Math.min(converted / maxSpeed, 1)

  const bg =
    theme === "glass" ? "rgba(0,0,0,0.7)" :
    theme === "light" ? "rgba(240,245,255,0.97)" :
    theme === "minimal" ? "transparent" :
    "rgba(8,10,12,0.96)"
  const textColor = theme === "light" ? "#0a1628" : accentColor
  const mutedColor = theme === "light" ? "rgba(10,22,40,0.4)" : `${accentColor}40`
  const dimColor = theme === "light" ? "rgba(10,22,40,0.12)" : `${accentColor}15`

  // 7-segment-inspired segments count (3 digits)
  const segments = 10
  const filled = Math.round(progress * segments)

  return (
    <div style={{
      width, height,
      background: bg,
      border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.1)" : `${accentColor}20`}`,
      borderRadius: 12,
      backdropFilter: theme === "glass" ? "blur(20px)" : undefined,
      display: "flex", flexDirection: "column",
      padding: "10px 14px",
      gap: 6,
      boxShadow: theme !== "minimal" ? `0 0 0 1px ${accentColor}15, 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)` : undefined,
      fontFamily: "ui-monospace, 'Cascadia Code', monospace",
    }}>
      {/* Header */}
      {showLabel && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 9, letterSpacing: "0.18em", color: mutedColor, fontWeight: 600 }}>
            {label}
          </span>
          {showUnit && (
            <span style={{ fontSize: 9, letterSpacing: "0.1em", color: mutedColor }}>
              {unit.toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Main number */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
        {/* Ghost digits */}
        <div style={{ position: "relative", flex: 1 }}>
          <div style={{
            fontSize: height * 0.46, fontWeight: 700, color: dimColor,
            letterSpacing: "-0.02em", lineHeight: 1, userSelect: "none",
            fontFeatureSettings: "'tnum'",
          }}>888</div>
          <motion.div style={{
            position: "absolute", inset: 0,
            fontSize: height * 0.46, fontWeight: 700, color: textColor,
            letterSpacing: "-0.02em", lineHeight: 1,
            fontFeatureSettings: "'tnum'",
            textShadow: `0 0 20px ${accentColor}60`,
          }}>
            {String(Math.round(converted)).padStart(3, " ")}
          </motion.div>
        </div>
      </div>

      {/* Segment bar */}
      <div style={{ display: "flex", gap: 2.5 }}>
        {Array.from({ length: segments }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 1.5,
            background: i < filled ? accentColor : dimColor,
            boxShadow: i < filled ? `0 0 6px ${accentColor}80` : undefined,
            transition: "background 0.1s, box-shadow 0.1s",
          }} />
        ))}
      </div>
    </div>
  )
}
