import { z } from "zod"

export const VideoSegmentSchema = z.object({
  id: z.string(),
  path: z.string(),
  name: z.string(),
  /** Sort order within the session (0-based, auto-assigned) */
  order: z.number().default(0),
  /** Start offset in the global timeline, seconds */
  startGlobalTime: z.number().default(0),
  duration: z.number(),
  fps: z.number(),
  width: z.number(),
  height: z.number(),
  codec: z.string(),
  hasGPMF: z.boolean().default(false),
  size: z.number().default(0),
})

export type VideoSegment = z.infer<typeof VideoSegmentSchema>
