import { z } from "zod"
import { VideoMetadataSchema } from "./video"
import { TelemetryTrackSchema } from "./telemetry"
import { WidgetConfigSchema } from "./widget"
import { TimelineStateSchema } from "./timeline"

export const ExportSettingsSchema = z.object({
  resolution: z.enum(["1080p", "4K", "720p", "1080p-vertical", "4K-vertical"]),
  fps: z.number().default(30),
  quality: z.enum(["draft", "normal", "high", "lossless"]).default("high"),
  format: z.enum(["mp4", "mov", "webm"]).default("mp4"),
  codec: z.enum(["h264", "h265", "prores", "vp9"]).default("h264"),
  outputPath: z.string().optional(),
})

export type ExportSettings = z.infer<typeof ExportSettingsSchema>

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().default("1.0.0"),
  createdAt: z.string(),
  updatedAt: z.string(),
  video: VideoMetadataSchema.optional(),
  telemetry: TelemetryTrackSchema.optional(),
  widgets: z.array(WidgetConfigSchema),
  timeline: TimelineStateSchema,
  exportSettings: ExportSettingsSchema.optional(),
  templateId: z.string().optional(),
  startFinishLine: z.object({ lat: z.number(), lon: z.number() }).optional(),
})

export type Project = z.infer<typeof ProjectSchema>
