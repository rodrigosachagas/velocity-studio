import { z } from "zod"

export const TelemetryFrameSchema = z.object({
  timestamp: z.number(),
  speed: z.number().optional(),
  altitude: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  heading: z.number().optional(),
  gForce: z.number().optional(),
  acceleration: z
    .object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    })
    .optional(),
  gyroscope: z
    .object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    })
    .optional(),
  leanAngle: z.number().optional(),
})

export type TelemetryFrame = z.infer<typeof TelemetryFrameSchema>

export const TelemetryTrackSchema = z.object({
  id: z.string(),
  sourceFile: z.string(),
  frames: z.array(TelemetryFrameSchema),
  sampleRate: z.number(),
  duration: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type TelemetryTrack = z.infer<typeof TelemetryTrackSchema>
