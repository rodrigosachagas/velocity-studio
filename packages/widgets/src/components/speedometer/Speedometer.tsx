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
import {
  ClassicSpeedometer, ThinRingSpeedometer, LEDSpeedometer, DualRingSpeedometer,
  TicksSpeedometer, InvertSpeedometer, ConicSpeedometer, HalfMoonSpeedometer,
  TripleRingSpeedometer, DotsSpeedometer, AnalogNeedleSpeedometer, NumeralsSpeedometer,
  NotchedSpeedometer, GlowOnlySpeedometer, StepBlocksSpeedometer,
  RedlineSpeedometer, HeatGradientSpeedometer, MirroredSpeedometer, CyberpunkSpeedometer,
} from "./variants/Circular"

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
  // Circular SC01–SC20
  "classic":     ClassicSpeedometer,
  "thin-ring":   ThinRingSpeedometer,
  "led":         LEDSpeedometer,
  "dual-ring":   DualRingSpeedometer,
  "ticks":       TicksSpeedometer,
  "invert":      InvertSpeedometer,
  "conic":       ConicSpeedometer,
  "half-moon":   HalfMoonSpeedometer,
  "triple":      TripleRingSpeedometer,
  "dots":        DotsSpeedometer,
  "analog":      AnalogNeedleSpeedometer,
  "numerals":    NumeralsSpeedometer,
  "notched":     NotchedSpeedometer,
  "glow":        GlowOnlySpeedometer,
  "step-blocks": StepBlocksSpeedometer,
  "redline":     RedlineSpeedometer,
  "heat":        HeatGradientSpeedometer,
  "mirror":      MirroredSpeedometer,
  "cyber":       CyberpunkSpeedometer,
}

export const SPEEDOMETER_VARIANTS: { id: SpeedometerVariant; label: string; description: string }[] = [
  { id: "arc",         label: "Arc",          description: "Classic arc gauge with animated needle" },
  { id: "digital",     label: "Digital",      description: "LED segmented display with bar indicator" },
  { id: "bars",        label: "Bars",         description: "Stacked bar graph, color-coded by speed zone" },
  { id: "ring",        label: "Ring",         description: "Minimal full-circle ring progress" },
  { id: "hud",         label: "HUD",          description: "Fighter jet–style horizontal HUD gauge" },
  { id: "neon",        label: "Neon",         description: "Cyberpunk neon arc with gradient glow" },
  { id: "radial",      label: "Radial",       description: "Full car-dashboard with labeled tick marks" },
  { id: "tape",        label: "Tape",         description: "Scrolling vertical tape like rally/aviation" },
  { id: "split",       label: "Split",        description: "Dual semicircle EV-style infotainment gauge" },
  // SC01–SC20 circular variants
  { id: "classic",     label: "Classic",      description: "240° arc with tick marks and speed labels" },
  { id: "thin-ring",   label: "Thin Ring",    description: "Ultra-minimal single hairline ring" },
  { id: "led",         label: "LED Segments", description: "28 discrete LED bar segments with redline" },
  { id: "dual-ring",   label: "Dual Ring",    description: "Outer current speed + inner session average" },
  { id: "ticks",       label: "Tick Light",   description: "60 progressive tick marks that light up" },
  { id: "invert",      label: "Inverted",     description: "Counter-clockwise fill from top" },
  { id: "conic",       label: "Conic 360°",   description: "Full-circle conic gradient fill" },
  { id: "half-moon",   label: "Half Moon",    description: "180° lower semicircle arc" },
  { id: "triple",      label: "Triple Ring",  description: "Three concentric rings with staggered fill" },
  { id: "dots",        label: "Dot Ring",     description: "36 glowing dot indicators in a ring" },
  { id: "analog",      label: "Analog",       description: "Heavy analog needle with speed labels" },
  { id: "numerals",    label: "Numerals",     description: "Speed numerals around the arc ring" },
  { id: "notched",     label: "Notched",      description: "12 chunky arc segments with redline" },
  { id: "glow",        label: "Glow Only",    description: "Layered glow arc with no background track" },
  { id: "step-blocks", label: "Step Blocks",  description: "8 large arc blocks that fill in steps" },
  { id: "redline",     label: "Redline",      description: "Standard arc with visible redline zone" },
  { id: "heat",        label: "Heat Gradient",description: "Blue-to-red thermal gradient arc sweep" },
  { id: "mirror",      label: "Mirrored",     description: "Top + bottom dual-arc symmetrical design" },
  { id: "cyber",       label: "Cyberpunk",    description: "Hex frame with segmented inner arc" },
]

export function Speedometer(props: SpeedometerProps) {
  const variant = props.variant ?? "arc"
  const Component = VARIANT_MAP[variant]
  return <Component {...props} />
}

// Re-export each variant for direct use in Remotion compositions
export { ArcSpeedometer, DigitalSpeedometer, BarsSpeedometer, RingSpeedometer }
export { HUDSpeedometer, NeonSpeedometer, RadialSpeedometer, TapeSpeedometer, SplitSpeedometer }
