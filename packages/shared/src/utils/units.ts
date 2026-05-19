export type SpeedUnit = "kmh" | "mph" | "ms" | "knots"
export type AltitudeUnit = "m" | "ft"
export type DistanceUnit = "km" | "mi"

export function metersPerSecondTo(value: number, unit: SpeedUnit): number {
  switch (unit) {
    case "kmh":
      return value * 3.6
    case "mph":
      return value * 2.23694
    case "ms":
      return value
    case "knots":
      return value * 1.94384
  }
}

export function metersToFeet(m: number): number {
  return m * 3.28084
}

export function formatSpeed(value: number, unit: SpeedUnit): string {
  return `${metersPerSecondTo(value, unit).toFixed(1)} ${unit}`
}

export function formatAltitude(value: number, unit: AltitudeUnit): string {
  const v = unit === "ft" ? metersToFeet(value) : value
  return `${v.toFixed(0)} ${unit}`
}

export function formatHeading(degrees: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  const idx = Math.round(degrees / 45) % 8
  return dirs[idx] ?? "N"
}

export function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(ms).padStart(2, "0")}`
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`
}
