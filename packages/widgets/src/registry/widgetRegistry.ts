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
  variantId?: string
}

export interface WidgetRenderer {
  meta: WidgetMeta
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<any>
}

// Key = type + (variantId or "")
const registry = new Map<string, WidgetRenderer>()

function registryKey(type: WidgetType, variantId?: string) {
  return variantId ? `${type}:${variantId}` : type
}

export function registerWidget(renderer: WidgetRenderer): void {
  registry.set(registryKey(renderer.meta.type, renderer.meta.variantId), renderer)
}

export function getWidget(type: WidgetType, variantId?: string): WidgetRenderer | undefined {
  return registry.get(registryKey(type, variantId)) ?? registry.get(type)
}

export function getAllWidgets(): WidgetRenderer[] {
  return Array.from(registry.values())
}

export function getWidgetsByCategory(category: WidgetMeta["category"]): WidgetRenderer[] {
  return getAllWidgets().filter((w) => w.meta.category === category)
}
