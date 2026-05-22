import { useMemo, useEffect, useId } from "react"
import { motion, useSpring } from "framer-motion"
import { useExportMode } from "../../contexts/ExportModeContext"
import { buildConsensusTrack } from "@velocity/shared"

interface GPSFrame {
  timestamp: number
  latitude?: number
  longitude?: number
  speed?: number
}

export interface StartFinishLine {
  lat: number
  lon: number
}

export interface CircuitMapProps {
  frames?: GPSFrame[]
  currentTime: number
  accentColor?: string
  carColor?: string
  carSize?: number
  trackWidth?: number
  trackStyle?: "gradient" | "circuit"
  showLabel?: boolean
  theme?: "dark" | "light" | "glass" | "minimal"
  width?: number
  height?: number
  startFinishLine?: StartFinishLine
  /** Editor-only: when set, clicking on the map calls this with the GPS coordinates */
  onSetStartFinish?: (lat: number, lon: number) => void
}

// ── Projection ────────────────────────────────────────────────────────────────

interface Projected {
  x: number
  y: number
  speed: number
  timestamp: number
}

interface ProjectionParams {
  minLat: number
  maxLat: number
  minLon: number
  cosLat: number
  scale: number
  offX: number
  offY: number
}

function computeProjectionParams(
  gpsFrames: GPSFrame[],
  w: number,
  h: number,
  pad: number,
): ProjectionParams | null {
  if (gpsFrames.length < 2) return null

  const lats = gpsFrames.map((f) => f.latitude!)
  const lons = gpsFrames.map((f) => f.longitude!)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)

  const latRange = maxLat - minLat || 1e-5
  const lonRange = maxLon - minLon || 1e-5

  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const adjLonRange = lonRange * cosLat

  const innerW = w - pad * 2
  const innerH = h - pad * 2
  const scale = Math.min(innerW / adjLonRange, innerH / latRange)

  const trackW = adjLonRange * scale
  const trackH = latRange * scale
  const offX = pad + (innerW - trackW) / 2
  const offY = pad + (innerH - trackH) / 2

  return { minLat, maxLat, minLon, cosLat, scale, offX, offY }
}

function projectGPS(f: GPSFrame, p: ProjectionParams, maxSpeed: number): Projected {
  return {
    x: p.offX + (f.longitude! - p.minLon) * p.cosLat * p.scale,
    y: p.offY + (p.maxLat - f.latitude!) * p.scale,
    speed: (f.speed ?? 0) / maxSpeed,
    timestamp: f.timestamp,
  }
}

function unprojectSVG(svgX: number, svgY: number, p: ProjectionParams): { lat: number; lon: number } {
  return {
    lat: p.maxLat - (svgY - p.offY) / p.scale,
    lon: (svgX - p.offX) / (p.cosLat * p.scale) + p.minLon,
  }
}

function sfToSVG(sf: StartFinishLine, p: ProjectionParams): { x: number; y: number } {
  return {
    x: p.offX + (sf.lon - p.minLon) * p.cosLat * p.scale,
    y: p.offY + (p.maxLat - sf.lat) * p.scale,
  }
}

function speedColor(t: number, alpha = 1): string {
  const r = Math.round(t < 0.5 ? t * 2 * 128 : 128 + (t - 0.5) * 2 * 127)
  const g = Math.round(t < 0.5 ? 128 + t * 2 * 127 : 255 - (t - 0.5) * 2 * 255)
  const b = Math.round(t < 0.5 ? 255 - t * 2 * 255 : 0)
  return `rgba(${r},${g},${b},${alpha})`
}

function buildPathD(pts: Projected[], close = false): string {
  if (pts.length < 2) return ""
  if (pts.length === 2) {
    return `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)} L${pts[1]!.x.toFixed(1)},${pts[1]!.y.toFixed(1)}`
  }

  // Catmull-Rom → cubic Bézier: smooth curve through every GPS point
  const n = pts.length
  let d = `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`

  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[close ? (i - 1 + n) % n : Math.max(0, i - 1)]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[close ? (i + 2) % n : Math.min(n - 1, i + 2)]!

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }

  return close ? d + " Z" : d
}

// Returns indices of corner apexes (local curvature maxima above threshold).
function detectCorners(pts: Projected[]): number[] {
  if (pts.length < 12) return []
  const w = Math.max(3, Math.floor(pts.length / 60))
  const curv: number[] = new Array(pts.length).fill(0)

  for (let i = w; i < pts.length - w; i++) {
    const p0 = pts[i - w]!, p1 = pts[i]!, p2 = pts[i + w]!
    const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x)
    const a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x)
    let d = a2 - a1
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    curv[i] = Math.abs(d)
  }

  const thresh = 0.32  // ~18°
  const minSpacing = w * 5
  const result: number[] = []

  for (let i = w + 1; i < pts.length - w - 1; i++) {
    const c = curv[i]!
    if (c > thresh && c >= (curv[i - 1] ?? 0) && c >= (curv[i + 1] ?? 0)) {
      if (result.length === 0 || i - result[result.length - 1]! > minSpacing) {
        result.push(i)
      }
    }
  }
  return result
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CircuitMap({
  frames,
  currentTime,
  accentColor = "#00ff88",
  carColor,
  carSize = 1,
  trackWidth = 2,
  trackStyle = "gradient",
  showLabel = true,
  theme = "dark",
  width = 220,
  height = 220,
  startFinishLine,
  onSetStartFinish,
}: CircuitMapProps) {
  const isExport = useExportMode()
  const dotColor = carColor ?? accentColor
  const isPicking = !!onSetStartFinish && !isExport
  const checkerId = useId()

  const bg =
    theme === "glass"
      ? "rgba(255,255,255,0.07)"
      : theme === "light"
        ? "rgba(255,255,255,0.92)"
        : theme === "minimal"
          ? "transparent"
          : "rgba(0,0,0,0.85)"

  const mutedColor =
    theme === "light" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.25)"

  const pad = 16

  const gpsFrames = useMemo(() => {
    if (!frames || frames.length === 0) return []
    const valid = frames.filter(
      (f) => f.latitude !== undefined && f.longitude !== undefined,
    )
    if (valid.length <= 3000) return valid
    const step = Math.ceil(valid.length / 3000)
    return valid.filter((_, i) => i % step === 0)
  }, [frames])

  const projParams = useMemo(
    () => computeProjectionParams(gpsFrames, width, height, pad),
    [gpsFrames, width, height],
  )

  const projected = useMemo(() => {
    if (!projParams || gpsFrames.length < 2) return []
    const maxSpeed = Math.max(...gpsFrames.map((f) => f.speed ?? 0), 1)
    return gpsFrames.map((f) => projectGPS(f, projParams, maxSpeed))
  }, [gpsFrames, projParams])

  // For circuit style: build a consensus track from all complete laps.
  // Arc-length resampling + median across laps eliminates GPS noise and gives
  // a much more accurate representation of the actual circuit geometry.
  const consensusResult = useMemo(() => {
    if (trackStyle !== "circuit" || !startFinishLine || gpsFrames.length < 2) return null
    return buildConsensusTrack(gpsFrames, startFinishLine)
  }, [trackStyle, startFinishLine, gpsFrames])

  const circuitLapProjected = useMemo(() => {
    if (!consensusResult || !projParams) return null
    return consensusResult.points.map((pt) => ({
      x: projParams.offX + (pt.lon - projParams.minLon) * projParams.cosLat * projParams.scale,
      y: projParams.offY + (projParams.maxLat - pt.lat) * projParams.scale,
      speed: 0,
      timestamp: 0,
    }))
  }, [consensusResult, projParams])

  const trackPath = useMemo(() => {
    if (projected.length < 2) return null

    if (trackStyle === "gradient") {
      return (
        <>
          {projected.slice(0, -1).map((p, i) => {
            const q = projected[i + 1]!
            return (
              <line
                key={i}
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
                stroke={speedColor((p.speed + q.speed) / 2, 0.85)}
                strokeWidth={trackWidth}
                strokeLinecap="round"
              />
            )
          })}
        </>
      )
    }

    // ── Circuit style ─────────────────────────────────────────────────────────
    const pts = circuitLapProjected ?? projected
    const d = buildPathD(pts, true)   // Z closes the loop
    const strokeW = Math.max(5, trackWidth * 5)
    const curbW = strokeW + 5
    const dashLen = strokeW * 0.55

    const corners = detectCorners(pts)
    const spread = Math.max(3, Math.floor(pts.length / 28))  // shorter curb regions

    const cornerDs = corners.map((apex) => {
      const start = Math.max(0, apex - spread)
      const end = Math.min(pts.length - 1, apex + spread)
      return buildPathD(pts.slice(start, end + 1))
    })

    return (
      <g>
        {/* Outer shadow / border */}
        <path d={d} fill="none" stroke="rgba(0,0,0,0.88)"
          strokeWidth={strokeW + 5} strokeLinejoin="round" strokeLinecap="round" />

        {/* Corner curbs — red layer */}
        {cornerDs.map((cd, i) => (
          <path key={`cr-${i}`} d={cd} fill="none" stroke="#cc1111"
            strokeWidth={curbW} strokeDasharray={`${dashLen} ${dashLen}`}
            strokeLinecap="butt" opacity={0.92} />
        ))}
        {/* Corner curbs — white offset layer (creates alternating red/white stripes) */}
        {cornerDs.map((cd, i) => (
          <path key={`cw-${i}`} d={cd} fill="none" stroke="#e8e8e8"
            strokeWidth={curbW} strokeDasharray={`${dashLen} ${dashLen}`}
            strokeDashoffset={`${dashLen}`} strokeLinecap="butt" opacity={0.92} />
        ))}

        {/* Asphalt surface — covers the center of the curb stripes */}
        <path d={d} fill="none" stroke="rgba(42,46,60,0.98)"
          strokeWidth={strokeW} strokeLinejoin="round" strokeLinecap="round" />

        {/* Surface highlight — subtle lighter centre band for depth */}
        <path d={d} fill="none" stroke="rgba(78,86,108,0.28)"
          strokeWidth={strokeW * 0.4} strokeLinejoin="round" strokeLinecap="round" />

        {/* Racing line — thin accent stripe with glow */}
        <path d={d} fill="none" stroke={accentColor}
          strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round"
          opacity={0.55}
          style={{ filter: `drop-shadow(0 0 3px ${accentColor}99)` }} />

        {/* Label: number of laps used in consensus */}
        {consensusResult && (
          <text
            x={pad} y={height - pad}
            fontSize={7} fill={accentColor} opacity={0.5}
            fontFamily="system-ui, sans-serif" letterSpacing="0.08em">
            {consensusResult.lapCount === 1
              ? "1 VOLTA"
              : `${consensusResult.lapCount} VOLTAS`}
          </text>
        )}
      </g>
    )
  }, [projected, circuitLapProjected, trackStyle, accentColor, trackWidth, height, pad])

  // Binary search for current position
  const positionData = useMemo(() => {
    if (projected.length < 2) return null

    const tsMs = currentTime * 1000
    let lo = 0
    let hi = projected.length - 1
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1
      if (projected[mid]!.timestamp <= tsMs) lo = mid
      else hi = mid
    }
    const a = projected[lo]!
    const b = projected[hi]!
    const t =
      b.timestamp > a.timestamp
        ? Math.max(0, Math.min(1, (tsMs - a.timestamp) / (b.timestamp - a.timestamp)))
        : 0

    return {
      cx: a.x + (b.x - a.x) * t,
      cy: a.y + (b.y - a.y) * t,
    }
  }, [projected, currentTime])

  const springCx = useSpring(0, { stiffness: 120, damping: 18 })
  const springCy = useSpring(0, { stiffness: 120, damping: 18 })

  useEffect(() => {
    if (positionData) {
      isExport ? springCx.jump(positionData.cx) : springCx.set(positionData.cx)
      isExport ? springCy.jump(positionData.cy) : springCy.set(positionData.cy)
    }
  }, [positionData, isExport])

  const dotR = 3.5 * carSize
  const ringR = 8 * carSize

  const isEmpty = projected.length < 2

  const sfSVG = useMemo(
    () => (startFinishLine && projParams ? sfToSVG(startFinishLine, projParams) : null),
    [startFinishLine, projParams],
  )

  const handleSVGClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPicking || !projParams) return
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = (e.clientX - rect.left) * (width / rect.width)
    const svgY = (e.clientY - rect.top) * (height / rect.height)
    const { lat, lon } = unprojectSVG(svgX, svgY, projParams)
    onSetStartFinish!(lat, lon)
  }

  return (
    <div
      style={{
        width,
        height,
        background: bg,
        borderRadius: 12,
        border: isPicking
          ? `1.5px dashed ${accentColor}99`
          : "1px solid rgba(255,255,255,0.07)",
        backdropFilter: isExport ? undefined : "blur(12px)",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        cursor: isPicking ? "crosshair" : undefined,
      }}
    >
      {/* Pick mode banner */}
      {isPicking && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          background: `${accentColor}22`,
          borderBottom: `1px solid ${accentColor}44`,
          textAlign: "center",
          fontSize: 9,
          color: accentColor,
          letterSpacing: "0.1em",
          padding: "3px 0",
          fontFamily: "system-ui, sans-serif",
          pointerEvents: "none",
        }}>
          CLIQUE PARA MARCAR A LARGADA
        </div>
      )}

      {isEmpty ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <svg width={24} height={24} viewBox="0 0 24 24">
            <circle cx={12} cy={10} r={4} fill="none" stroke={mutedColor} strokeWidth={1.5} />
            <path
              d="M12 2C8 2 5 5.5 5 10c0 6 7 12 7 12s7-6 7-12c0-4.5-3-8-7-8z"
              fill="none"
              stroke={mutedColor}
              strokeWidth={1.5}
            />
          </svg>
          <span
            style={{
              fontSize: 10,
              color: mutedColor,
              fontFamily: "system-ui, sans-serif",
              textAlign: "center",
              padding: "0 12px",
            }}
          >
            Sem dados GPS
          </span>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          style={{ position: "absolute", inset: 0 }}
          onClick={handleSVGClick}
        >
          {trackPath}

          {/* Start marker (first GPS point) — only in gradient mode */}
          {trackStyle === "gradient" && projected[0] && (
            <circle cx={projected[0].x} cy={projected[0].y} r={3} fill={mutedColor} />
          )}

          {/* Start/Finish line marker — checkered flag */}
          {sfSVG && (() => {
            const { x, y } = sfSVG
            const pid = `sf-ck-${checkerId.replace(/:/g, "")}`
            return (
              <g>
                <defs>
                  <pattern id={pid} x="0" y="0" width="6" height="6"
                    patternUnits="userSpaceOnUse">
                    <rect x="0" y="0" width="3" height="3" fill="#fff" />
                    <rect x="3" y="3" width="3" height="3" fill="#fff" />
                    <rect x="3" y="0" width="3" height="3" fill="#222" />
                    <rect x="0" y="3" width="3" height="3" fill="#222" />
                  </pattern>
                </defs>
                {/* Flag pole */}
                <line x1={x} y1={y} x2={x} y2={y - 14}
                  stroke="#fff" strokeWidth={1.5} opacity={0.9} />
                {/* Flag rectangle */}
                <rect x={x + 1} y={y - 14} width={12} height={8}
                  fill={`url(#${pid})`} opacity={0.92} />
                {/* Dot at exact S/F position */}
                <circle cx={x} cy={y} r={2} fill="#fff" opacity={0.95} />
              </g>
            )
          })()}

          {/* Car dot with pulsing ring */}
          {positionData && (
            <motion.g style={{ x: springCx, y: springCy }}>
              {isExport ? (
                <circle cx={0} cy={0} r={ringR} fill="none" stroke={dotColor} strokeWidth={1.5} opacity={0.3} />
              ) : (
                <motion.circle
                  cx={0}
                  cy={0}
                  r={ringR}
                  fill="none"
                  stroke={dotColor}
                  strokeWidth={1.5}
                  opacity={0.4}
                  animate={{
                    r: [ringR * 0.75, ringR * 1.35, ringR * 0.75],
                    opacity: [0.5, 0.08, 0.5],
                  }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <circle cx={0} cy={0} r={dotR} fill={dotColor} />
              <circle cx={0} cy={0} r={dotR * 0.4} fill="rgba(255,255,255,0.6)" />
            </motion.g>
          )}
        </svg>
      )}

      {showLabel && (
        <div
          style={{
            position: "absolute",
            bottom: 6,
            right: 8,
            fontSize: 8,
            color: mutedColor,
            fontFamily: "system-ui, sans-serif",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          GPS Track
        </div>
      )}
    </div>
  )
}
