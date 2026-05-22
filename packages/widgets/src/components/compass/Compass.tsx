import { useEffect } from "react"
import { motion, useSpring } from "framer-motion"
import { formatHeading } from "@velocity/shared"
import { useExportMode } from "../../contexts/ExportModeContext"

interface CompassProps {
  heading?: number
  accentColor?: string
  theme?: "dark" | "light" | "glass" | "minimal"
  size?: number
}

export function Compass({
  heading = 0,
  accentColor = "#00ff88",
  theme = "dark",
  size = 120,
}: CompassProps) {
  const isExport = useExportMode()
  const springHeading = useSpring(0, { stiffness: 80, damping: 15 })

  useEffect(() => {
    if (isExport) {
      springHeading.jump(heading)
    } else {
      // Shortest-path rotation: avoid spinning through 360° at wrap boundaries
      const current = springHeading.get()
      let delta = heading - current
      while (delta > 180) delta -= 360
      while (delta < -180) delta += 360
      springHeading.set(current + delta)
    }
  }, [heading, isExport])

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

  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: isExport ? undefined : "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} style={{ position: "absolute" }}>
        {/* Cardinal marks */}
        {["N", "E", "S", "W"].map((dir, i) => {
          const angle = i * 90
          const rad = ((angle - 90) * Math.PI) / 180
          const x = 60 + 48 * Math.cos(rad)
          const y = 60 + 48 * Math.sin(rad)
          return (
            <text
              key={dir}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={dir === "N" ? accentColor : mutedColor}
              fontSize={dir === "N" ? 11 : 9}
              fontWeight={dir === "N" ? 700 : 400}
              fontFamily="system-ui, sans-serif"
            >
              {dir}
            </text>
          )
        })}

        {/* Tick marks */}
        {Array.from({ length: 36 }, (_, i) => {
          const angle = i * 10
          const rad = ((angle - 90) * Math.PI) / 180
          const isMajor = i % 3 === 0
          const inner = isMajor ? 34 : 36
          const outer = 40
          return (
            <line
              key={i}
              x1={60 + inner * Math.cos(rad)}
              y1={60 + inner * Math.sin(rad)}
              x2={60 + outer * Math.cos(rad)}
              y2={60 + outer * Math.sin(rad)}
              stroke={mutedColor}
              strokeWidth={isMajor ? 1.5 : 0.75}
            />
          )
        })}

        {/* Rotating needle — spring updated via useEffect */}
        <motion.g style={{ transformOrigin: "60px 60px", rotate: springHeading }}>
          <polygon
            points="60,20 56,60 64,60"
            fill={accentColor}
            style={{ filter: `drop-shadow(0 0 4px ${accentColor})` }}
          />
          <polygon points="60,100 56,60 64,60" fill={mutedColor} />
        </motion.g>

        <circle cx="60" cy="60" r={4} fill={accentColor} />
      </svg>

      {/* Heading label */}
      <div
        style={{
          position: "absolute",
          bottom: size * 0.15,
          fontSize: size * 0.13,
          color: textColor,
          fontWeight: 600,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {formatHeading(heading)}
      </div>
    </div>
  )
}
