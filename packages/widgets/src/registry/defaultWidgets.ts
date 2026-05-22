import { registerWidget } from "./widgetRegistry"
import { Speedometer, SPEEDOMETER_VARIANTS } from "../components/speedometer/Speedometer"
import { Compass } from "../components/compass/Compass"
import { Altitude } from "../components/altitude/Altitude"
import { GForce } from "../components/g-force/GForce"
import { Timer } from "../components/timer/Timer"
import { CircuitMap } from "../components/circuit-map/CircuitMap"
import { LapTimer, lapTimerIdealHeight } from "../components/lap-timer/LapTimer"

export function registerDefaultWidgets(): void {
  // Register each speedometer variant as a distinct widget entry
  for (const v of SPEEDOMETER_VARIANTS) {
    const isWide = v.id === "hud" || v.id === "digital"
    const isTall = v.id === "bars" || v.id === "tape"
    const isHalf = v.id === "half-moon"
    const isCircular = ["classic","thin-ring","led","dual-ring","ticks","invert","conic",
      "triple","dots","analog","numerals","notched","glow","step-blocks",
      "redline","heat","mirror","cyber"].includes(v.id)
    const defaultW = isWide ? 260 : isTall ? 80 : isCircular ? 220 : 160
    const defaultH = isWide ? 80 : isTall ? 180 : isHalf ? 150 : isCircular ? 220 : 160

    registerWidget({
      meta: {
        type: "speedometer",
        label: `Speed · ${v.label}`,
        description: v.description,
        defaultSize: { width: defaultW, height: defaultH },
        defaultConfig: {
          width: defaultW,
          height: defaultH,
          style: { theme: "dark", accentColor: "#00ff88" },
          props: { variant: v.id },
        },
        icon: "gauge",
        category: "telemetry",
        variantId: v.id,
      },
      Component: Speedometer,
    })
  }

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

  registerWidget({
    meta: {
      type: "lap-timer",
      label: "Cronômetro de Volta",
      description: "Número de voltas e tempo por volta com base na largada marcada no mapa",
      defaultSize: { width: 240, height: lapTimerIdealHeight(10, 240) },
      defaultConfig: {
        width: 240,
        height: lapTimerIdealHeight(10, 240),
        style: { theme: "dark", accentColor: "#00ff88" },
        props: { historyCount: 10 },
      },
      icon: "flag",
      category: "timing",
    },
    Component: LapTimer,
  })

  registerWidget({
    meta: {
      type: "circuit-map",
      label: "Circuit Map",
      description: "GPS track map with animated car position",
      defaultSize: { width: 220, height: 220 },
      defaultConfig: {
        width: 220,
        height: 220,
        style: { theme: "dark", accentColor: "#00ff88" },
      },
      icon: "map-pin",
      category: "navigation",
    },
    Component: CircuitMap,
  })
}
