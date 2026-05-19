import { z } from "zod"

export const VideoMetadataSchema = z.object({
  id: z.string(),
  path: z.string(),
  name: z.string(),
  size: z.number(),
  duration: z.number(),
  fps: z.number(),
  width: z.number(),
  height: z.number(),
  codec: z.string(),
  bitrate: z.number().optional(),
  hasGPMF: z.boolean().default(false),
  createdAt: z.string().optional(),
})

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>

export const VideoFileSchema = z.object({
  metadata: VideoMetadataSchema,
  thumbnailPath: z.string().optional(),
  proxyPath: z.string().optional(),
  /** In-memory blob URL from browser File API — not persisted to project JSON */
  blobUrl: z.string().optional(),
})

export type VideoFile = z.infer<typeof VideoFileSchema>
