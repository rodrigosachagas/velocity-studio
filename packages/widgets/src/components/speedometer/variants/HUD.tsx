import { useEffect } from "react"
import { motion, useSpring } from "framer-motion"
import { metersPerSecondTo } from "@velocity/shared"
import { useExportMode } from "../../../contexts/ExportModeContext"
import type { SpeedometerProps } from "../types"

export function HUDSpeedometer({
  speed = 0,
  unit = "kmh",
  maxSpeed = 200,
  accentColor = "#00ff88",
  secondaryColor,
  theme = "dark",
  width = 260,
  height = 72,
  showUnit = true,
  showLabel = true,
  showMax = true,
  label = "SPD",
  tickCount = 20,
}: SpeedometerProps) {
  const isExport = useExportMode()
  const converted = metersPerSecondTo(speed, unit)
  const springSpeed = useSpring(0, { stiffness: 140, damping: 22 })
  useEffect(() => { isExport ? springSpeed.jump(converted) : springSpeed.set(converted) }, [converted, isExport])
  const progress = Math.min(converted / maxSpeed, 1)

  const bg = theme === "glass" ? "rgba(0,0,0,0.5)" :
    theme === "light" ? "rgba(250,255,250,0.97)" :
    theme === "minimal" ? "transparent" : "rgba(0,8,4,0.9)"
  const textColor = theme === "light" ? "#0a1f0a" : "#fff"
  const dimColor = theme === "light" ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.1)"
  const mutedColor = theme === "light" ? "rgba(0,0,0,0.4)" : `${accentColor}70`

  return (
    <div style={{
      width, height,
      background: bg,
      border: `1px solid ${theme === "minimal" ? "transparent" : `${accentColor}25`}`,
      borderRadius: 6,
      backdropFilter: theme === "glass" ? "blur(20px)" : undefined,
      display: "flex", flexDirection: "column",
      padding: "8px 12px 6px",
      gap: 4,
      boxShadow: theme !== "minimal" ? `0 0 0 1px ${accentColor}10, inset 0 0 40px ${accentColor}05` : undefined,
      fontFamily: "ui-monospace, 'Cascadia Code', monospace",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Corner accent lines */}
      {theme !== "minimal" && theme !== "light" && <>
        <div style={{ position: "absolute", top: 0, left: 0, width: 12, height: 1, background: accentColor }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: 1, height: 12, background: accentColor }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 12, height: 1, background: accentColor }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 1, height: 12, background: accentColor }} />
      </>}

      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {showLabel && <span style={{ fontSize: 9, color: mutedColor, letterSpacing: "0.2em" }}>{label}</span>}
        {showMax && <span style={{ fontSize: 9, color: dimColor, letterSpacing: "0.06em" }}>MAX {maxSpeed} {unit.toUpperCase()}</span>}
      </div>

      {/* Main display row */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
        {/* Big number */}
        <div style={{ position: "relative", minWidth: 72 }}>
          <div style={{
            fontSize: 32, fontWeight: 700, color: dimColor, lineHeight: 1,
            letterSpacing: "-0.03em", fontFeatureSettings: "'tnum'",
          }}>000</div>
          <motion.div style={{
            position: "absolute", inset: 0, fontSize: 32, fontWeight: 700,
            color: textColor, lineHeight: 1, letterSpacing: "-0.03em",
            fontFeatureSettings: "'tnum'",
            textShadow: `0 0 16px ${accentColor}50`,
          }}>
            {String(Math.round(converted)).padStart(3, "0")}
          </motion.div>
        </div>

        {showUnit && (
          <div style={{ fontSize: 11, color: mutedColor, letterSpacing: "0.1em", marginTop: 8 }}>
            {unit.toUpperCase()}
          </div>
        )}

        {/* Progress ticks bar */}
        <div style={{ flex: 1, display: "flex", gap: 2, alignItems: "center", position: "relative" }}>
          {Array.from({ length: tickCount }, (_, i) => {
            const pct = i / tickCount
            const isActive = pct < progress
            const isMajor = i % 5 === 0
            const barColor = pct > 0.8 ? (secondaryColor ?? "#ff4444") : pct > 0.6 ? "#ffaa00" : accentColor
            return (
              <div key={i} style={{
                width: 3, height: isMajor ? 18 : 12, borderRadius: 1,
                background: isActive ? barColor : dimColor,
                boxShadow: isActive && isMajor ? `0 0 6px ${barColor}` : undefined,
                transition: "background 0.06s",
              }} />
            )
          })}
          {/* Needle: left:% positions relative to parent width */}
          <div style={{
            position: "absolute", left: `${progress * 100}%`, transform: "translateX(-50%)",
            width: 2, height: 22, background: accentColor, borderRadius: 1,
            boxShadow: `0 0 8px ${accentColor}`, transition: "left 0.1s linear",
            pointerEvents: "none",
          }} />
        </div>
      </div>
    </div>
  )
}
