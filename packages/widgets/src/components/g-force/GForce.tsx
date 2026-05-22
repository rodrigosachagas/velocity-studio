import { useEffect } from "react"
import { useTransform, motion, useSpring } from "framer-motion"
import { useExportMode } from "../../contexts/ExportModeContext"

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

  const maxG = 2
  // All distances in CSS pixels (SVG has no viewBox — 1 unit = 1px)
  const CX = size / 2
  const CY = size / 2
  const R = size * 0.35     // ring radius = 35% of size
  const dotR = size * 0.045 // dot radius

  const clamp = (v: number) => Math.max(-R, Math.min(R, v))

  // GoPro ACCL (front-mounted): x = lateral, z = longitudinal (lens fwd)
  const targetX = acceleration ? clamp((acceleration.x  / 9.81) / maxG * R) : 0
  const targetY = acceleration ? clamp((-acceleration.z / 9.81) / maxG * R) : 0

  const isExport = useExportMode()
  const springDotX = useSpring(0, { stiffness: 80, damping: 14 })
  const springDotY = useSpring(0, { stiffness: 80, damping: 14 })
  const springG = useSpring(0, { stiffness: 100, damping: 15 })
  const gText = useTransform(springG, (v) => v.toFixed(2) + "g")

  useEffect(() => { isExport ? springDotX.jump(targetX) : springDotX.set(targetX) }, [targetX, isExport])
  useEffect(() => { isExport ? springDotY.jump(targetY) : springDotY.set(targetY) }, [targetY, isExport])
  useEffect(() => { isExport ? springG.jump(gForce) : springG.set(gForce) }, [gForce, isExport])

  const gColor = gForce > 2 ? "#ff2200" : gForce > 1 ? "#ff8800" : accentColor

  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: isExport ? undefined : "blur(12px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/*
        No viewBox — SVG uses natural pixel coordinates so CSS transforms
        on motion.g are 1-to-1 with SVG units at any rendered size.
      */}
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        {/* 1g ring */}
        <circle cx={CX} cy={CY} r={R / 2} fill="none" stroke={mutedColor} strokeWidth={0.5 * (size / 120)} opacity={0.4} />
        {/* 2g ring */}
        <circle cx={CX} cy={CY} r={R}     fill="none" stroke={mutedColor} strokeWidth={0.5 * (size / 120)} opacity={0.4} />

        {/* Crosshairs */}
        <line x1={CX - R - 4} y1={CY} x2={CX + R + 4} y2={CY} stroke={mutedColor} strokeWidth={0.5 * (size / 120)} opacity={0.4} />
        <line x1={CX} y1={CY - R - 4} x2={CX} y2={CY + R + 4} stroke={mutedColor} strokeWidth={0.5 * (size / 120)} opacity={0.4} />

        {/* Axis labels */}
        <text x={CX + 2} y={CY - R - 5} fill={mutedColor} fontSize={7 * (size / 120)} fontFamily="system-ui">F</text>
        <text x={CX + 2} y={CY + R + 11 * (size / 120)} fill={mutedColor} fontSize={7 * (size / 120)} fontFamily="system-ui">B</text>
        <text x={CX - R - 9 * (size / 120)} y={CY + 3} fill={mutedColor} fontSize={7 * (size / 120)} fontFamily="system-ui">L</text>
        <text x={CX + R + 3 * (size / 120)} y={CY + 3} fill={mutedColor} fontSize={7 * (size / 120)} fontFamily="system-ui">R</text>

        {/*
          Dot: motion.g is positioned at (CX, CY) via a plain SVG translate,
          then offset by spring x/y (CSS pixels = SVG pixels since no viewBox).
        */}
        <g transform={`translate(${CX} ${CY})`}>
          <motion.g style={{ x: springDotX, y: springDotY }}>
            <circle
              cx={0}
              cy={0}
              r={dotR}
              fill={gColor}
              style={{ filter: `drop-shadow(0 0 ${dotR}px ${gColor})` }}
            />
          </motion.g>
        </g>
      </svg>

      {/* G-value — MotionValue child auto-subscribes, no re-render needed */}
      <motion.div
        style={{
          position: "absolute",
          bottom: size * 0.1,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: size * 0.15,
          fontWeight: 700,
          color: textColor,
          fontVariantNumeric: "tabular-nums",
          fontFamily: "system-ui, monospace",
          lineHeight: 1,
        }}
      >
        {gText}
      </motion.div>
    </div>
  )
}
