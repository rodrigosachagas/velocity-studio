import type { SpeedUnit } from "@velocity/shared"

export type SpeedometerVariant =
  | "arc"
  | "digital"
  | "bars"
  | "ring"
  | "hud"
  | "neon"
  | "radial"
  | "tape"
  | "split"
  // Circular variants SC01–SC20
  | "classic"
  | "thin-ring"
  | "led"
  | "dual-ring"
  | "ticks"
  | "invert"
  | "conic"
  | "half-moon"
  | "triple"
  | "dots"
  | "analog"
  | "numerals"
  | "notched"
  | "glow"
  | "step-blocks"
  | "redline"
  | "heat"
  | "mirror"
  | "cyber"

export interface SpeedometerProps {
  speed?: number
  unit?: SpeedUnit
  maxSpeed?: number
  accentColor?: string
  secondaryColor?: string
  backgroundColor?: string
  theme?: "dark" | "light" | "glass" | "minimal"
  variant?: SpeedometerVariant
  size?: number
  width?: number
  height?: number
  showLabel?: boolean
  showMax?: boolean
  showUnit?: boolean
  label?: string
  fontSize?: number
  tickCount?: number
}
