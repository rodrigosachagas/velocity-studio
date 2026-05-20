import { forwardRef } from "react"
import { ExportModeProvider, getWidget } from "@velocity/widgets"
import { interpolateTelemetryAt } from "@velocity/shared"
import type { WidgetConfig, TelemetryTrack } from "@velocity/shared"

interface ExportOverlayProps {
  widgets: WidgetConfig[]
  telemetry: TelemetryTrack | undefined
  currentTime: number
  videoWidth: number
  videoHeight: number
  startFinishLine?: { lat: number; lon: number }
}

export const ExportOverlay = forwardRef<HTMLDivElement, ExportOverlayProps>(
  ({ widgets, telemetry, currentTime, videoWidth, videoHeight, startFinishLine }, ref) => {
    const frame = telemetry
      ? interpolateTelemetryAt(telemetry.frames, currentTime * 1000)
      : null

    return (
      <ExportModeProvider>
        <div
          ref={ref}
          style={{
            // Kept in the fixed-position flow so html-to-image can capture it correctly.
            // z-index 0 keeps it behind the modal backdrop (z-50) while the modal is open.
            position: "fixed",
            top: 0,
            left: 0,
            width: videoWidth,
            height: videoHeight,
            zIndex: 0,
            background: "transparent",
            pointerEvents: "none",
          }}
        >
          {widgets
            .filter((w) => w.visible)
            .map((widget) => {
              const variantId =
                typeof widget.props?.variant === "string"
                  ? widget.props.variant
                  : undefined
              const renderer = getWidget(widget.type, variantId)
              if (!renderer) return null
              const { Component } = renderer

              const { style, props = {} } = widget
              const widgetProps = {
                theme: style?.theme ?? "dark",
                accentColor: style?.accentColor ?? "#00ff88",
                speed: frame?.speed,
                altitude: frame?.altitude,
                latitude: frame?.latitude,
                longitude: frame?.longitude,
                heading: frame?.heading,
                gForce: frame?.gForce,
                acceleration: frame?.acceleration,
                frames: telemetry?.frames,
                currentTime,
                startFinishLine,
                ...props,
              }

              return (
                <div
                  key={widget.id}
                  style={{
                    position: "absolute",
                    left: widget.x,
                    top: widget.y,
                    width: widget.width,
                    height: widget.height,
                    transform: `rotate(${widget.rotation}deg)`,
                    opacity: widget.opacity,
                  }}
                >
                  <Component
                    {...widgetProps}
                    width={widget.width}
                    height={widget.height}
                    size={Math.min(widget.width, widget.height)}
                  />
                </div>
              )
            })}
        </div>
      </ExportModeProvider>
    )
  }
)
