import { motion, useSpring } from "framer-motion"
import { metersPerSecondTo } from "@velocity/shared"
import type { SpeedometerProps } from "../types"

export function TapeSpeedometer({
  speed = 0,
  unit = "kmh",
  maxSpeed = 200,
  accentColor = "#00ff88",
  theme = "dark",
  width = 72,
  height = 200,
  showUnit = true,
}: SpeedometerProps) {
  const converted = metersPerSecondTo(speed, unit)
  const springSpeed = useSpring(converted, { stiffness: 60, damping: 18 })
  const progress = Math.min(converted / maxSpeed, 1)

  const bg = theme === "glass" ? "rgba(0,0,0,0.7)" :
    theme === "light" ? "rgba(245,248,255,0.97)" :
    theme === "minimal" ? "transparent" : "rgba(8,10,14,0.94)"
  const textColor = theme === "light" ? "#111" : "#fff"
  const mutedColor = theme === "light" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.25)"
  const dimColor = theme === "light" ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.05)"

  // Number of visible tape steps
  const totalSteps = 20
  const stepSize = maxSpeed / totalSteps

  // The tape scrolls: center = current speed
  const centerValue = converted
  const visibleRange = maxSpeed * 0.4 // show ±20% of max around current

  // Compute which numbers appear on the tape
  const tapeItems = Array.from({ length: Math.ceil(maxSpeed / stepSize) + 2 }, (_, i) => i * stepSize)

  return (
    <div style={{
      width, height,
      background: bg,
      border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 10,
      backdropFilter: theme === "glass" ? "blur(16px)" : undefined,
      display: "flex", flexDirection: "column",
      alignItems: "center",
      overflow: "hidden",
      position: "relative",
      boxShadow: theme !== "minimal" ? "0 8px 24px rgba(0,0,0,0.5)" : undefined,
    }}>
      {/* Gradient mask top & bottom */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "35%",
        background: `linear-gradient(to bottom, ${bg}, transparent)`,
        zIndex: 2, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "35%",
        background: `linear-gradient(to top, ${bg}, transparent)`,
        zIndex: 2, pointerEvents: "none",
      }} />

      {/* Center indicator line */}
      <div style={{
        position: "absolute", left: 8, right: 8, top: "50%",
        height: 1, background: accentColor, zIndex: 3, transform: "translateY(-50%)",
        boxShadow: `0 0 6px ${accentColor}`,
      }} />
      <div style={{
        position: "absolute", left: 0, top: "50%",
        width: 6, height: 12, background: accentColor, zIndex: 3,
        transform: "translateY(-50%)",
        clipPath: "polygon(0 50%, 100% 0, 100% 100%)",
      }} />

      {/* Scrolling tape */}
      <motion.div style={{
        position: "absolute",
        top: "50%",
        y: useSpring(
          -((converted / maxSpeed) * (height * (totalSteps / 4))),
          { stiffness: 60, damping: 18 }
        ),
        transformOrigin: "top",
        display: "flex", flexDirection: "column-reverse",
        alignItems: "flex-end",
        width: "100%",
        paddingRight: 8,
      }}>
        {tapeItems.map((val) => {
          const isMajor = val % (stepSize * 2) === 0
          const diff = val - centerValue
          const opacity = Math.max(0, 1 - Math.abs(diff) / visibleRange)
          return (
            <div key={val} style={{
              height: height / totalSteps * 2,
              width: "100%",
              display: "flex", alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: 10,
              gap: 4,
              opacity: Math.pow(opacity, 0.5),
            }}>
              {/* Tick */}
              <div style={{
                width: isMajor ? 16 : 8, height: isMajor ? 1.5 : 1,
                background: Math.round(val) === Math.round(centerValue) ? accentColor : mutedColor,
              }} />
              {/* Label */}
              {isMajor && (
                <span style={{
                  fontSize: 10, color: Math.round(val) === Math.round(centerValue) ? textColor : mutedColor,
                  fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, monospace",
                  minWidth: 26, textAlign: "right",
                }}>
                  {Math.round(val)}
                </span>
              )}
            </div>
          )
        })}
      </motion.div>

      {/* Unit label at top */}
      {showUnit && (
        <div style={{
          position: "absolute", top: 8, fontSize: 9,
          color: mutedColor, letterSpacing: "0.1em",
          textTransform: "uppercase", fontFamily: "system-ui", zIndex: 4,
        }}>{unit}</div>
      )}

      {/* Current speed at bottom */}
      <div style={{
        position: "absolute", bottom: 8, textAlign: "center", zIndex: 4,
      }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: textColor,
          fontVariantNumeric: "tabular-nums", fontFamily: "system-ui",
          textShadow: `0 0 12px ${accentColor}50`,
        }}>{Math.round(converted)}</div>
      </div>
    </div>
  )
}
