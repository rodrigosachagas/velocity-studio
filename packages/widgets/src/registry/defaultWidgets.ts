import { registerWidget } from "./widgetRegistry"
import { Speedometer } from "../components/speedometer/Speedometer"
import { Compass } from "../components/compass/Compass"
import { Altitude } from "../components/altitude/Altitude"
import { GForce } from "../components/g-force/GForce"
import { Timer } from "../components/timer/Timer"

export function registerDefaultWidgets(): void {
  registerWidget({
    meta: {
      type: "speedometer",
      label: "Speedometer",
      description: "Circular speedometer with animated needle",
      defaultSize: { width: 160, height: 160 },
      defaultConfig: {
        width: 160,
        height: 160,
        style: { theme: "dark", accentColor: "#00ff88" },
      },
      icon: "gauge",
      category: "telemetry",
    },
    Component: Speedometer,
  })

  registerWidget({
    meta: {
      type: "compass",
      label: "Compass",
      description: "Heading compass with animated needle",
      defaultSize: { width: 120, height: 120 },
      defaultConfig: {
        width: 120,
        height: 120,
        style: { theme: "dark", accentColor: "#00ff88" },
      },
      icon: "compass",
      category: "navigation",
    },
    Component: Compass,
  })

  registerWidget({
    meta: {
      type: "altitude",
      label: "Altitude",
      description: "Current altitude display",
      defaultSize: { width: 140, height: 60 },
      defaultConfig: {
        width: 140,
        height: 60,
        style: { theme: "dark", accentColor: "#4488ff" },
      },
      icon: "mountain",
      category: "telemetry",
    },
    Component: Altitude,
  })

  registerWidget({
    meta: {
      type: "g-force",
      label: "G-Force",
      description: "G-force ball with lateral and longitudinal display",
      defaultSize: { width: 120, height: 120 },
      defaultConfig: {
        width: 120,
        height: 120,
        style: { theme: "dark", accentColor: "#ff4444" },
      },
      icon: "activity",
      category: "telemetry",
    },
    Component: GForce,
  })

  registerWidget({
    meta: {
      type: "timer",
      label: "Timer",
      description: "Current time elapsed display",
      defaultSize: { width: 180, height: 48 },
      defaultConfig: {
        width: 180,
        height: 48,
        style: { theme: "dark", accentColor: "#00ff88" },
      },
      icon: "clock",
      category: "timing",
    },
    Component: Timer,
  })
}
