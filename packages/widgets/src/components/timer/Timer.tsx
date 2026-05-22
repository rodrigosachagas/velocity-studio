import { formatTimecode } from "@velocity/shared"
import { useExportMode } from "../../contexts/ExportModeContext"

interface TimerProps {
  currentTime?: number
  accentColor?: string
  theme?: "dark" | "light" | "glass" | "minimal"
  width?: number
  height?: number
  showMs?: boolean
}

export function Timer({
  currentTime = 0,
  accentColor = "#00ff88",
  theme = "dark",
  width = 180,
  height = 48,
  showMs = true,
}: TimerProps) {
  const isExport = useExportMode()
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

  const parts = formatTimecode(currentTime).split(".")
  const main = parts[0]!
  const ms = parts[1]

  return (
    <div
      style={{
        width,
        height,
        background: bg,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: isExport ? undefined : "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        padding: "0 16px",
      }}
    >
      <span
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: textColor,
          fontVariantNumeric: "tabular-nums",
          fontFamily: "ui-monospace, 'Cascadia Code', monospace",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {main}
      </span>
      {showMs && (
        <span
          style={{
            fontSize: 13,
            color: accentColor,
            fontVariantNumeric: "tabular-nums",
            fontFamily: "ui-monospace, monospace",
            lineHeight: 1,
            alignSelf: "flex-end",
            marginBottom: 3,
          }}
        >
          .{ms}
        </span>
      )}
    </div>
  )
}
