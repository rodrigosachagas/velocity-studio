import { z } from "zod"

export const WidgetTypeSchema = z.enum([
  "speedometer",
  "altitude",
  "compass",
  "timer",
  "map",
  "route-trace",
  "circuit-map",
  "g-force",
  "lean-angle",
  "lap-timer",
  "heart-rate",
  "custom",
])

export type WidgetType = z.infer<typeof WidgetTypeSchema>

export const AnimationPresetSchema = z.enum([
  "none",
  "fade",
  "slide-up",
  "slide-down",
  "scale",
  "bounce",
])

export type AnimationPreset = z.infer<typeof AnimationPresetSchema>

export const WidgetConfigSchema = z.object({
  id: z.string(),
  type: WidgetTypeSchema,
  label: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().default(0),
  scale: z.number().default(1),
  opacity: z.number().min(0).max(1).default(1),
  zIndex: z.number().default(1),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  animationIn: AnimationPresetSchema.default("none"),
  animationOut: AnimationPresetSchema.default("none"),
  style: z
    .object({
      accentColor: z.string().optional(),
      backgroundColor: z.string().optional(),
      textColor: z.string().optional(),
      borderRadius: z.number().optional(),
      fontFamily: z.string().optional(),
      fontSize: z.number().optional(),
      theme: z.enum(["dark", "light", "glass", "minimal"]).default("dark"),
    })
    .optional(),
  props: z.record(z.string(), z.unknown()).optional(),
})

export type WidgetConfig = z.infer<typeof WidgetConfigSchema>
