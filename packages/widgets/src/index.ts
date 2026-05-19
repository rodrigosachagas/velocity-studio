export { Speedometer } from "./components/speedometer/Speedometer"
export { Compass } from "./components/compass/Compass"
export { Altitude } from "./components/altitude/Altitude"
export { GForce } from "./components/g-force/GForce"
export { Timer } from "./components/timer/Timer"

export { registerWidget, getWidget, getAllWidgets, getWidgetsByCategory } from "./registry/widgetRegistry"
export type { WidgetMeta, WidgetRenderer } from "./registry/widgetRegistry"
export { registerDefaultWidgets } from "./registry/defaultWidgets"

export { useWidgetTelemetry } from "./hooks/useWidgetTelemetry"
