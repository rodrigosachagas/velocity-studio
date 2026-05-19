import { motion, useSpring, useTransform } from "framer-motion"
import { metersPerSecondTo } from "@velocity/shared"
import type { SpeedometerProps } from "../types"

export function RadialSpeedometer({
  speed = 0,
  unit = "kmh",
  maxSpeed = 200,
  accentColor = "#1EAEFD",
  theme = "dark",
  size = 180,
  showUnit = true,
  showLabel = true,
  tickCount = 24,
  label,
}: SpeedometerProps) {
  const converted = metersPerSecondTo(speed, unit)
  const springSpeed = useSpring(converted, { stiffness: 80, damping: 22 })
  const needleAngle = useTransform(springSpeed, [0, maxSpeed], [-120, 120])

  const bg = theme === "glass" ? "rgba(10,20,40,0.75)" :
    theme === "light" ? "rgba(245,248,255,0.97)" :
    theme === "minimal" ? "transparent" : "rgba(8,12,20,0.97)"
  const textColor = theme === "light" ? "#0a1628" : "#fff"
  const mutedColor = theme === "light" ? "rgba(10,22,40,0.4)" : "rgba(255,255,255,0.3)"
  const dimColor = theme === "light" ? "rgba(10,22,40,0.1)" : "rgba(255,255,255,0.06)"

  const CX = 100, CY = 100
  const r = 78

  // Major ticks at every (tickCount/8) step show speed labels
  const labelEvery = Math.ceil(tickCount / 8)

  return (
    <div style={{
      width: size, height: size,
      background: bg,
      borderRadius: "50%",
      border: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
      backdropFilter: theme === "glass" ? "blur(20px)" : undefined,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
      boxShadow: theme !== "minimal" ? "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" : undefined,
    }}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute" }}>
        {/* Colored arc zones */}
        {[
          { from: 0, to: 0.6, color: accentColor, opacity: 0.15 },
          { from: 0.6, to: 0.8, color: "#ffaa00", opacity: 0.15 },
          { from: 0.8, to: 1.0, color: "#ff3333", opacity: 0.15 },
        ].map(({ from, to, color, opacity }, zIdx) => {
          const startAngle = -120 + from * 240
          const endAngle = -120 + to * 240
          const arcLength = 2 * Math.PI * r
          const fraction = ((endAngle - startAngle) / 360) * arcLength
          const offset = arcLength - fraction
          const rotationStart = startAngle + 90
          return (
            <circle key={zIdx} cx={CX} cy={CY} r={r} fill="none"
              stroke={color} strokeWidth={10} strokeOpacity={opacity}
              strokeDasharray={`${fraction} ${arcLength}`}
              strokeDashoffset={offset}
              transform={`rotate(${rotationStart} ${CX} ${CY})`} />
          )
        })}

        {/* Tick marks */}
        {Array.from({ length: tickCount + 1 }, (_, i) => {
          const angle = -120 + (i / tickCount) * 240
          const rad = ((angle) * Math.PI) / 180
          const isMajor = i % labelEvery === 0
          const inner = isMajor ? 62 : 70
          const outer = 78
          const lx = CX + 54 * Math.cos(rad)
          const ly = CY + 54 * Math.sin(rad)
          const speedVal = Math.round((i / tickCount) * maxSpeed)
          return (
            <g key={i}>
              <line
                x1={CX + inner * Math.cos(rad)} y1={CY + inner * Math.sin(rad)}
                x2={CX + outer * Math.cos(rad)} y2={CY + outer * Math.sin(rad)}
                stroke={isMajor ? mutedColor : dimColor}
                strokeWidth={isMajor ? 1.5 : 0.8} />
              {isMajor && speedVal > 0 && (
                <text x={lx} y={ly + 3} textAnchor="middle"
                  fill={mutedColor} fontSize="8" fontFamily="system-ui">
                  {speedVal}
                </text>
              )}
            </g>
          )
        })}

        {/* Needle */}
        <motion.g style={{ transformOrigin: `${CX}px ${CY}px`, rotate: needleAngle }}>
          {/* Shadow */}
          <line x1={CX} y1={CY + 6} x2={CX} y2={CY - 70}
            stroke="rgba(0,0,0,0.4)" strokeWidth={3} strokeLinecap="round" />
          {/* Needle body */}
          <line x1={CX} y1={CY + 6} x2={CX} y2={CY - 72}
            stroke={accentColor} strokeWidth={2} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${accentColor})` }} />
          {/* Tail */}
          <line x1={CX} y1={CY + 6} x2={CX} y2={CY + 16}
            stroke={mutedColor} strokeWidth={2} strokeLinecap="round" />
        </motion.g>

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={8} fill="rgba(20,20,30,1)"
          stroke={accentColor} strokeWidth={1.5} />
        <circle cx={CX} cy={CY} r={3} fill={accentColor} />

        {/* Label above center */}
        {showLabel && label && (
          <text x={CX} y={CY - 22} textAnchor="middle"
            fill={mutedColor} fontSize="8" fontFamily="system-ui" letterSpacing="0.14em">
            {label.toUpperCase()}
          </text>
        )}
      </svg>

      {/* Speed value below center */}
      <div style={{ position: "absolute", bottom: size * 0.22, textAlign: "center" }}>
        <div style={{
          fontSize: size * 0.16, fontWeight: 700, color: textColor,
          fontVariantNumeric: "tabular-nums", lineHeight: 1,
          fontFamily: "system-ui",
        }}>
          {Math.round(converted)}
        </div>
        {showUnit && (
          <div style={{
            fontSize: size * 0.07, color: mutedColor, textTransform: "uppercase",
            letterSpacing: "0.1em", fontFamily: "system-ui", marginTop: 1,
          }}>{unit}</div>
        )}
      </div>
    </div>
  )
}
