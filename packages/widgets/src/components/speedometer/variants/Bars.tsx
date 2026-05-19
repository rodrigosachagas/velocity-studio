import { motion, useSpring } from "framer-motion"
import { metersPerSecondTo } from "@velocity/shared"
import type { SpeedometerProps } from "../types"

export function BarsSpeedometer({
  speed = 0,
  unit = "kmh",
  maxSpeed = 200,
  accentColor = "#00ff88",
  secondaryColor,
  theme = "dark",
  width = 80,
  height = 160,
  showUnit = true,
  showLabel = false,
  tickCount = 20,
}: SpeedometerProps) {
  const converted = metersPerSecondTo(speed, unit)
  const springSpeed = useSpring(converted, { stiffness: 100, damping: 18 })
  const progress = Math.min(converted / maxSpeed, 1)
  const filledBars = Math.round(progress * tickCount)

  const bg =
    theme === "glass" ? "rgba(255,255,255,0.06)" :
    theme === "light" ? "rgba(255,255,255,0.97)" :
    theme === "minimal" ? "transparent" :
    "rgba(10,10,10,0.92)"
  const textColor = theme === "light" ? "#111" : "#fff"
  const mutedColor = theme === "light" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.12)"

  // Color gradient: green → yellow → red based on speed
  const barColor = (i: number): string => {
    const pct = i / tickCount
    if (pct > 0.8) return secondaryColor ?? "#ff3333"
    if (pct > 0.6) return "#ffaa00"
    return accentColor
  }

  return (
    <div style={{
      width, height,
      background: bg,
      border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 14,
      backdropFilter: theme === "glass" ? "blur(14px)" : undefined,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "space-between",
      padding: "12px 10px 10px",
      boxShadow: theme !== "minimal" ? "0 8px 24px rgba(0,0,0,0.4)" : undefined,
    }}>
      {/* Bar stack (bottom to top) */}
      <div style={{
        flex: 1, width: "100%", display: "flex",
        flexDirection: "column-reverse", gap: 2.5, marginBottom: 8,
      }}>
        {Array.from({ length: tickCount }, (_, i) => {
          const isActive = i < filledBars
          const color = barColor(i)
          return (
            <motion.div
              key={i}
              animate={{ opacity: isActive ? 1 : 0.15, scaleX: isActive ? 1 : 0.7 }}
              transition={{ type: "tween", duration: 0.08 }}
              style={{
                height: 4, borderRadius: 2,
                background: isActive ? color : mutedColor,
                boxShadow: isActive ? `0 0 6px ${color}80` : undefined,
                transformOrigin: "left",
              }}
            />
          )
        })}
      </div>

      {/* Speed value */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 22, fontWeight: 700, color: textColor,
          fontVariantNumeric: "tabular-nums", lineHeight: 1,
          fontFamily: "system-ui",
        }}>{Math.round(converted)}</div>
        {showUnit && (
          <div style={{
            fontSize: 9, color: mutedColor, textTransform: "uppercase",
            letterSpacing: "0.1em", marginTop: 2, fontFamily: "system-ui",
          }}>{unit}</div>
        )}
      </div>
    </div>
  )
}
