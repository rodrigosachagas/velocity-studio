import { useMemo } from "react"
import { computeLaps, getCurrentLapState, formatLapTime } from "@velocity/shared"
import type { StartFinishLine } from "@velocity/shared"

interface TelemetryFrame {
  timestamp: number
  latitude?: number
  longitude?: number
}

interface LapTimerProps {
  frames?: TelemetryFrame[]
  currentTime?: number
  startFinishLine?: StartFinishLine
  accentColor?: string
  theme?: "dark" | "light" | "glass" | "minimal"
  width?: number
  height?: number
  historyCount?: number
}

const MONO = "ui-monospace,'Cascadia Code',monospace"
const DANGER = "#ff6666"

export function LapTimer({
  frames,
  currentTime = 0,
  startFinishLine,
  accentColor = "#00ff88",
  theme = "dark",
  width = 240,
  height = 80,
  historyCount = 0,
}: LapTimerProps) {
  const s = width / 240
  const clampedHistory = Math.min(10, Math.max(0, Math.round(historyCount)))

  const bg =
    theme === "glass" ? "rgba(0,0,0,0.45)" :
    theme === "light" ? "rgba(255,255,255,0.95)" :
    theme === "minimal" ? "transparent" : "rgba(0,8,4,0.92)"
  const fg = theme === "light" ? "#0a1f0a" : "#fff"
  const muted = theme === "light" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.35)"
  const dimColor = theme === "light" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.07)"

  const session = useMemo(() => {
    if (!frames || !startFinishLine) return null
    return computeLaps(frames, startFinishLine)
  }, [frames, startFinishLine])

  const lapState = useMemo(() => {
    if (!session) return null
    return getCurrentLapState(session, currentTime * 1000)
  }, [session, currentTime])

  const historyRows = useMemo(() => {
    if (!session || clampedHistory === 0) return []
    const currentMs = currentTime * 1000
    // Only include laps whose end crossing has already been passed in the current playback position
    const done = session.laps.filter((l) => l.endMs <= currentMs)
    if (done.length === 0) return []
    const bestMs = Math.min(...done.map((l) => l.lapTimeMs))
    return done
      .slice(-clampedHistory)
      .reverse()
      .map((l) => ({
        lapNumber: l.lapNumber,
        lapTimeMs: l.lapTimeMs,
        isBest: l.lapTimeMs === bestMs,
        deltaMs: l.lapTimeMs - bestMs,
      }))
  }, [session, clampedHistory, currentTime])

  const hasData = !!startFinishLine && !!frames && frames.length > 0

  const pad = `${Math.round(6 * s)}px ${Math.round(12 * s)}px`
  const rowH = Math.round(16 * s)

  return (
    <div style={{
      width, height,
      background: bg,
      border: `1px solid ${theme === "minimal" ? "transparent" : `${accentColor}20`}`,
      borderRadius: Math.round(8 * s),
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      padding: pad,
      gap: Math.round(4 * s),
      fontFamily: MONO,
      overflow: "hidden",
      position: "relative",
      boxSizing: "border-box",
      boxShadow: theme !== "minimal" ? `inset 0 0 ${Math.round(40 * s)}px ${accentColor}05` : undefined,
    }}>
      {/* Corner accents */}
      {theme !== "minimal" && theme !== "light" && <>
        <div style={{ position: "absolute", top: 0, left: 0, width: Math.round(10 * s), height: 1, background: accentColor }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: 1, height: Math.round(10 * s), background: accentColor }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: Math.round(10 * s), height: 1, background: accentColor }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 1, height: Math.round(10 * s), background: accentColor }} />
      </>}

      {!hasData ? (
        <div style={{ textAlign: "center", fontSize: Math.round(10 * s), color: muted, letterSpacing: "0.1em" }}>
          DEFINA A LARGADA NO MAPA
        </div>
      ) : lapState && lapState.lapNumber > 0 ? (
        <>
          {/* Main row: lap number + current elapsed */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: Math.round(6 * s) }}>
              <span style={{ fontSize: Math.round(9 * s), color: muted, letterSpacing: "0.15em" }}>VOLTA</span>
              <span style={{ fontSize: Math.round(28 * s), fontWeight: 700, color: accentColor, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {lapState.lapNumber}
              </span>
            </div>
            <div style={{ fontSize: Math.round(22 * s), fontWeight: 600, color: fg, letterSpacing: "-0.02em", textShadow: `0 0 ${Math.round(12 * s)}px ${accentColor}40` }}>
              {formatLapTime(lapState.elapsedMs)}
            </div>
          </div>

          {/* Secondary row: last lap + best lap */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${dimColor}`, paddingTop: Math.round(4 * s) }}>
            <div style={{ display: "flex", gap: Math.round(4 * s), alignItems: "baseline" }}>
              <span style={{ fontSize: Math.round(8 * s), color: muted, letterSpacing: "0.1em" }}>ÚLT</span>
              <span style={{ fontSize: Math.round(13 * s), color: lapState.lastLapTimeMs != null ? fg : muted, opacity: lapState.lastLapTimeMs != null ? 1 : 0.4 }}>
                {lapState.lastLapTimeMs != null ? formatLapTime(lapState.lastLapTimeMs) : "--:--.--"}
              </span>
            </div>
            <div style={{ display: "flex", gap: Math.round(4 * s), alignItems: "baseline" }}>
              <span style={{ fontSize: Math.round(8 * s), color: muted, letterSpacing: "0.1em" }}>MELHOR</span>
              <span style={{ fontSize: Math.round(13 * s), color: accentColor, opacity: lapState.bestLapTimeMs != null ? 1 : 0.4 }}>
                {lapState.bestLapTimeMs != null ? formatLapTime(lapState.bestLapTimeMs) : "--:--.--"}
              </span>
            </div>
          </div>

          {/* History rows */}
          {clampedHistory > 0 && historyRows.length > 0 && (
            <div style={{ borderTop: `1px solid ${dimColor}`, paddingTop: Math.round(3 * s), display: "flex", flexDirection: "column", gap: Math.round(2 * s) }}>
              {historyRows.map((row) => (
                <div key={row.lapNumber} style={{ display: "flex", alignItems: "center", height: rowH }}>
                  <span style={{ fontSize: Math.round(8 * s), color: muted, letterSpacing: "0.1em", width: Math.round(22 * s), flexShrink: 0 }}>
                    L{row.lapNumber}
                  </span>
                  <span style={{ fontSize: Math.round(11 * s), color: fg, letterSpacing: "-0.01em", flex: 1 }}>
                    {formatLapTime(row.lapTimeMs)}
                  </span>
                  <span style={{ fontSize: Math.round(9 * s), letterSpacing: "-0.01em", color: row.isBest ? accentColor : DANGER, textAlign: "right", minWidth: Math.round(44 * s) }}>
                    {row.isBest ? "★ best" : `+${formatLapTime(row.deltaMs)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: Math.round(9 * s), color: muted, letterSpacing: "0.15em", marginBottom: Math.round(4 * s) }}>
            AGUARDANDO LARGADA
          </div>
          {session && session.laps.length > 0 && (
            <div style={{ fontSize: Math.round(9 * s), color: `${accentColor}80` }}>
              {session.laps.length} volta{session.laps.length !== 1 ? "s" : ""} detectada{session.laps.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
