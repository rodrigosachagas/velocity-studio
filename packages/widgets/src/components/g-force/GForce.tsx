import { motion, useSpring } from "framer-motion"

interface GForceProps {
  gForce?: number
  acceleration?: { x: number; y: number; z: number }
  accentColor?: string
  theme?: "dark" | "light" | "glass" | "minimal"
  size?: number
}

export function GForce({
  gForce = 0,
  acceleration,
  accentColor = "#ff4444",
  theme = "dark",
  size = 120,
}: GForceProps) {
  const bg =
    theme === "glass"
      ? "rgba(255,255,255,0.1)"
      : theme === "light"
        ? "rgba(255,255,255,0.92)"
        : theme === "minimal"
          ? "transparent"
          : "rgba(0,0,0,0.85)"

  const textColor = theme === "light" ? "#111" : "#fff"
  const mutedColor = theme === "light" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"

  const springG = useSpring(gForce, { stiffness: 100, damping: 15 })
  const maxG = 3

  const dotX = acceleration ? (acceleration.x / (maxG * 9.81)) * 45 : 0
  const dotY = acceleration ? (acceleration.y / (maxG * 9.81)) * 45 : 0
  const springX = useSpring(dotX, { stiffness: 80, damping: 12 })
  const springY = useSpring(dotY, { stiffness: 80, damping: 12 })

  const gColor = gForce > 2 ? "#ff2200" : gForce > 1 ? "#ff8800" : accentColor

  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} style={{ position: "absolute" }}>
        {/* Rings */}
        {[20, 30, 40].map((r) => (
          <circle
            key={r}
            cx={60}
            cy={60}
            r={r}
            fill="none"
            stroke={mutedColor}
            strokeWidth={0.5}
            opacity={0.4}
          />
        ))}
        {/* Crosshairs */}
        <line x1={20} y1={60} x2={100} y2={60} stroke={mutedColor} strokeWidth={0.5} opacity={0.4} />
        <line x1={60} y1={20} x2={60} y2={100} stroke={mutedColor} strokeWidth={0.5} opacity={0.4} />

        {/* G-dot */}
        <motion.circle
          cx={60}
          cy={60}
          r={5}
          fill={gColor}
          style={{
            x: springX,
            y: springY,
            filter: `drop-shadow(0 0 4px ${gColor})`,
          }}
        />
      </svg>

      {/* G value */}
      <div style={{ position: "absolute", bottom: size * 0.12, textAlign: "center" }}>
        <div
          style={{
            fontSize: size * 0.16,
            fontWeight: 700,
            color: textColor,
            fontVariantNumeric: "tabular-nums",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
          }}
        >
          {springG.get().toFixed(1)}g
        </div>
      </div>
    </div>
  )
}
