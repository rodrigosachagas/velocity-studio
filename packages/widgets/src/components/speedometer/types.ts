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
