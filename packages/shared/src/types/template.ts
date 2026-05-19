import { z } from "zod"
import { WidgetConfigSchema } from "./widget"
import { ExportSettingsSchema } from "./project"

export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  thumbnail: z.string().optional(),
  tags: z.array(z.string()).default([]),
  category: z.enum(["minimal", "gopro", "racing", "dji", "cycling", "custom"]),
  widgets: z.array(WidgetConfigSchema),
  exportSettings: ExportSettingsSchema.optional(),
  style: z
    .object({
      primaryColor: z.string(),
      secondaryColor: z.string(),
      fontFamily: z.string(),
      theme: z.enum(["dark", "light"]),
    })
    .optional(),
})

export type Template = z.infer<typeof TemplateSchema>
