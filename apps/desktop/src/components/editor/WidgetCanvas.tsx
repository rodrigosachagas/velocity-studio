import { useDraggable } from "@dnd-kit/core"
import { motion, AnimatePresence } from "framer-motion"
import { useProjectStore } from "@/store/useProjectStore"
import { useTimelineStore } from "@velocity/timeline"
import { getWidget } from "@velocity/widgets"
import type { WidgetConfig } from "@velocity/shared"
import { ResizeHandle } from "./ResizeHandle"

export function WidgetCanvas() {
  const project = useProjectStore((s) => s.project)
  const selectedIds = useProjectStore((s) => s.selectedWidgetIds)
  const selectWidget = useProjectStore((s) => s.selectWidget)
  const currentTime = useTimelineStore((s) => s.currentTime)
  const telemetry = project?.telemetry

  if (!project) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <AnimatePresence>
        {project.widgets.map((widget) =>
          widget.visible ? (
            <DraggableWidget
              key={widget.id}
              widget={widget}
              isSelected={selectedIds.includes(widget.id)}
              onSelect={(e) => {
                e.stopPropagation()
                selectWidget(widget.id, e.shiftKey)
              }}
              currentTime={currentTime}
              telemetry={telemetry}
            />
          ) : null
        )}
      </AnimatePresence>
    </div>
  )
}

interface DraggableWidgetProps {
  widget: WidgetConfig
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  currentTime: number
  telemetry: ReturnType<typeof useProjectStore.getState>["project"] extends infer P
    ? P extends { telemetry?: infer T }
      ? T
      : undefined
    : undefined
}

function DraggableWidget({
  widget,
  isSelected,
  onSelect,
  currentTime,
  telemetry,
}: DraggableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: widget.id,
    disabled: widget.locked,
  })

  const variantId = typeof widget.props?.variant === "string" ? widget.props.variant : undefined
  const renderer = getWidget(widget.type, variantId)
  if (!renderer) return null

  const { Component } = renderer

  const tx = transform?.x ?? 0
  const ty = transform?.y ?? 0

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: widget.opacity, scale: widget.scale }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      style={{
        position: "absolute",
        left: widget.x + tx,
        top: widget.y + ty,
        width: widget.width,
        height: widget.height,
        rotate: `${widget.rotation}deg`,
        zIndex: isDragging ? 9999 : widget.zIndex,
        pointerEvents: "all",
        cursor: widget.locked ? "default" : isDragging ? "grabbing" : "grab",
        outline: isSelected ? "1.5px solid rgba(0,255,136,0.8)" : "none",
        outlineOffset: "2px",
        borderRadius: 4,
      }}
      onClick={onSelect}
      {...listeners}
      {...attributes}
    >
      <Component
        {...extractWidgetProps(widget, currentTime, telemetry)}
        width={widget.width}
        height={widget.height}
      />

      {isSelected && !widget.locked && (
        <ResizeHandle widgetId={widget.id} widget={widget} />
      )}
    </motion.div>
  )
}

function extractWidgetProps(
  widget: WidgetConfig,
  currentTime: number,
  telemetry: { frames: { timestamp: number; speed?: number; altitude?: number; latitude?: number; longitude?: number; heading?: number; gForce?: number; acceleration?: { x: number; y: number; z: number } }[] } | undefined
) {
  const { style, props = {} } = widget
  const theme = style?.theme ?? "dark"
  const accentColor = style?.accentColor ?? "#00ff88"

  // interpolate from telemetry
  const frame = telemetry
    ? telemetry.frames.reduce(
        (closest, f) =>
          Math.abs(f.timestamp / 1000 - currentTime) <
          Math.abs((closest?.timestamp ?? Infinity) / 1000 - currentTime)
            ? f
            : closest,
        null as (typeof telemetry.frames)[0] | null
      )
    : null

  return {
    theme,
    accentColor,
    speed: frame?.speed,
    altitude: frame?.altitude,
    latitude: frame?.latitude,
    longitude: frame?.longitude,
    heading: frame?.heading,
    gForce: frame?.gForce,
    acceleration: frame?.acceleration,
    currentTime,
    ...props,
  }
}
