import type { ComponentType } from "react"
import type { WidgetType, WidgetConfig } from "@velocity/shared"

export interface WidgetMeta {
  type: WidgetType
  label: string
  description: string
  defaultSize: { width: number; height: number }
  defaultConfig: Partial<WidgetConfig>
  icon: string
  category: "telemetry" | "navigation" | "timing" | "media"
}

export interface WidgetRenderer {
  meta: WidgetMeta
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<any>
}

const registry = new Map<WidgetType, WidgetRenderer>()

export function registerWidget(renderer: WidgetRenderer): void {
  registry.set(renderer.meta.type, renderer)
}

export function getWidget(type: WidgetType): WidgetRenderer | undefined {
  return registry.get(type)
}

export function getAllWidgets(): WidgetRenderer[] {
  return Array.from(registry.values())
}

export function getWidgetsByCategory(category: WidgetMeta["category"]): WidgetRenderer[] {
  return getAllWidgets().filter((w) => w.meta.category === category)
}
