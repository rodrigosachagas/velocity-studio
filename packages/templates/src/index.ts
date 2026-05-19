export { minimalCinematic } from "./presets/minimal-cinematic"
export { goProStyle } from "./presets/gopro-style"
export { racingStyle } from "./presets/racing-style"

import type { Template } from "@velocity/shared"
import { minimalCinematic } from "./presets/minimal-cinematic"
import { goProStyle } from "./presets/gopro-style"
import { racingStyle } from "./presets/racing-style"

export const ALL_TEMPLATES: Template[] = [minimalCinematic, goProStyle, racingStyle]

export function getTemplateById(id: string): Template | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id)
}
