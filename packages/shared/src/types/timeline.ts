import { z } from "zod"

export const TimelineLayerTypeSchema = z.enum([
  "video",
  "telemetry",
  "widget",
  "audio",
  "effect",
])

export type TimelineLayerType = z.infer<typeof TimelineLayerTypeSchema>

export const TimelineClipSchema = z.object({
  id: z.string(),
  layerId: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  offsetTime: z.number().default(0),
  sourceId: z.string(),
})

export type TimelineClip = z.infer<typeof TimelineClipSchema>

export const TimelineLayerSchema = z.object({
  id: z.string(),
  type: TimelineLayerTypeSchema,
  name: z.string(),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  muted: z.boolean().default(false),
  clips: z.array(TimelineClipSchema),
})

export type TimelineLayer = z.infer<typeof TimelineLayerSchema>

export const TimelineStateSchema = z.object({
  duration: z.number(),
  currentTime: z.number(),
  playbackRate: z.number().default(1),
  isPlaying: z.boolean().default(false),
  zoomLevel: z.number().default(1),
  scrollOffset: z.number().default(0),
  layers: z.array(TimelineLayerSchema),
  inPoint: z.number().optional(),
  outPoint: z.number().optional(),
  snapEnabled: z.boolean().default(true),
  snapThreshold: z.number().default(0.1),
})

export type TimelineState = z.infer<typeof TimelineStateSchema>
