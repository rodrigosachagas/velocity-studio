import type { SpeedometerProps, SpeedometerVariant } from "./types"
import { ArcSpeedometer } from "./variants/Arc"
import { DigitalSpeedometer } from "./variants/Digital"
import { BarsSpeedometer } from "./variants/Bars"
import { RingSpeedometer } from "./variants/Ring"
import { HUDSpeedometer } from "./variants/HUD"
import { NeonSpeedometer } from "./variants/Neon"
import { RadialSpeedometer } from "./variants/Radial"
import { TapeSpeedometer } from "./variants/Tape"
import { SplitSpeedometer } from "./variants/Split"

export type { SpeedometerProps, SpeedometerVariant }

const VARIANT_MAP: Record<SpeedometerVariant, React.ComponentType<SpeedometerProps>> = {
  arc: ArcSpeedometer,
  digital: DigitalSpeedometer,
  bars: BarsSpeedometer,
  ring: RingSpeedometer,
  hud: HUDSpeedometer,
  neon: NeonSpeedometer,
  radial: RadialSpeedometer,
  tape: TapeSpeedometer,
  split: SplitSpeedometer,
}

export const SPEEDOMETER_VARIANTS: { id: SpeedometerVariant; label: string; description: string }[] = [
  { id: "arc",     label: "Arc",     description: "Classic arc gauge with animated needle" },
  { id: "digital", label: "Digital", description: "LED segmented display with bar indicator" },
  { id: "bars",    label: "Bars",    description: "Stacked bar graph, color-coded by speed zone" },
  { id: "ring",    label: "Ring",    description: "Minimal full-circle ring progress" },
  { id: "hud",     label: "HUD",     description: "Fighter jet–style horizontal HUD gauge" },
  { id: "neon",    label: "Neon",    description: "Cyberpunk neon arc with gradient glow" },
  { id: "radial",  label: "Radial",  description: "Full car-dashboard with labeled tick marks" },
  { id: "tape",    label: "Tape",    description: "Scrolling vertical tape like rally/aviation" },
  { id: "split",   label: "Split",   description: "Dual semicircle EV-style infotainment gauge" },
]

export function Speedometer(props: SpeedometerProps) {
  const variant = props.variant ?? "arc"
  const Component = VARIANT_MAP[variant]
  return <Component {...props} />
}

// Re-export each variant for direct use in Remotion compositions
export { ArcSpeedometer, DigitalSpeedometer, BarsSpeedometer, RingSpeedometer }
export { HUDSpeedometer, NeonSpeedometer, RadialSpeedometer, TapeSpeedometer, SplitSpeedometer }
