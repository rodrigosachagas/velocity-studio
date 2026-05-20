import { useDraggable } from "@dnd-kit/core"
import { motion, AnimatePresence } from "framer-motion"
import { useProjectStore } from "@/store/useProjectStore"
import { useAppStore } from "@/store/useAppStore"
import { getWidget } from "@velocity/widgets"
import type { WidgetConfig } from "@velocity/shared"
import { interpolateTelemetryAt } from "@velocity/shared"
import { ResizeHandle } from "./ResizeHandle"
import { Icon } from "@/components/ui/Icon"

export function WidgetCanvas() {
  const project = useProjectStore((s) => s.project)
  const selectedIds = useProjectStore((s) => s.selectedWidgetIds)
  const selectWidget = useProjectStore((s) => s.selectWidget)
  const removeWidget = useProjectStore((s) => s.removeWidget)
  const duplicateWidget = useProjectStore((s) => s.duplicateWidget)
  const setStartFinishLine = useProjectStore((s) => s.setStartFinishLine)
  const currentTime = useAppStore((s) => s.videoCurrentTime)
  const canvasSize = useAppStore((s) => s.canvasSize)
  const isPickingStartFinish = useAppStore((s) => s.isPickingStartFinish)
  const setPickingStartFinish = useAppStore((s) => s.setPickingStartFinish)
  const telemetry = project?.telemetry
  const startFinishLine = project?.startFinishLine
  const inPoint = project?.timeline.inPoint
  const outPoint = project?.timeline.outPoint

  if (!project) return null

  const videoW = project.video?.width ?? 1
  const videoH = project.video?.height ?? 1
  const scaleX = canvasSize ? canvasSize.width / videoW : 1
  const scaleY = canvasSize ? canvasSize.height / videoH : 1

  const handleSetStartFinish = (lat: number, lon: number) => {
    setStartFinishLine(lat, lon)
    setPickingStartFinish(false)
  }

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
              onDelete={() => removeWidget(widget.id)}
              onDuplicate={() => duplicateWidget(widget.id)}
              currentTime={currentTime}
              telemetry={telemetry}
              scaleX={scaleX}
              scaleY={scaleY}
              startFinishLine={startFinishLine}
              inPoint={inPoint}
              outPoint={outPoint}
              onSetStartFinish={
                isPickingStartFinish && widget.type === "circuit-map"
                  ? handleSetStartFinish
                  : undefined
              }
              disableDrag={isPickingStartFinish && widget.type === "circuit-map"}
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
  onDelete: () => void
  onDuplicate: () => void
  currentTime: number
  scaleX: number
  scaleY: number
  startFinishLine?: { lat: number; lon: number }
  onSetStartFinish?: (lat: number, lon: number) => void
  disableDrag?: boolean
  inPoint?: number
  outPoint?: number
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
  onDelete,
  onDuplicate,
  currentTime,
  telemetry,
  scaleX,
  scaleY,
  startFinishLine,
  onSetStartFinish,
  disableDrag = false,
  inPoint,
  outPoint,
}: DraggableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: widget.id,
    disabled: widget.locked || disableDrag,
  })

  const variantId = typeof widget.props?.variant === "string" ? widget.props.variant : undefined
  const renderer = getWidget(widget.type, variantId)
  if (!renderer) return null

  const { Component } = renderer

  const tx = transform?.x ?? 0
  const ty = transform?.y ?? 0
  const displayX = widget.x * scaleX + tx
  const displayY = widget.y * scaleY + ty
  const displayW = widget.width * scaleX
  const displayH = widget.height * scaleY

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: widget.opacity, scale: widget.scale }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      style={{
        position: "absolute",
        left: displayX,
        top: displayY,
        width: displayW,
        height: displayH,
        rotate: `${widget.rotation}deg`,
        zIndex: isDragging ? 9999 : widget.zIndex,
        pointerEvents: "all",
        cursor: disableDrag ? "crosshair" : widget.locked ? "default" : isDragging ? "grabbing" : "grab",
        outline: isSelected ? "1.5px solid rgba(0,255,136,0.8)" : "none",
        outlineOffset: "2px",
        borderRadius: 4,
      }}
      onClick={onSelect}
      {...listeners}
      {...attributes}
    >
      <Component
        {...extractWidgetProps(widget, currentTime, telemetry, startFinishLine, inPoint, outPoint)}
        width={displayW}
        height={displayH}
        size={Math.min(displayW, displayH)}
        onSetStartFinish={onSetStartFinish}
      />

      {isSelected && (
        <div
          style={{ position: "absolute", top: 4, right: 4, zIndex: 20, display: "flex", gap: 3 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate() }}
            title="Duplicar"
            className="w-5 h-5 flex items-center justify-center rounded bg-black/80 border border-white/15 text-white/55 hover:bg-white/10 hover:text-white/90 transition-colors cursor-pointer"
          >
            <Icon name="layers" size={10} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Excluir"
            className="w-5 h-5 flex items-center justify-center rounded bg-black/80 border border-white/15 text-white/55 hover:bg-red-500/30 hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer"
          >
            <Icon name="trash" size={10} />
          </button>
        </div>
      )}

      {isSelected && !widget.locked && (
        <ResizeHandle widgetId={widget.id} widget={widget} scaleX={scaleX} scaleY={scaleY} />
      )}
    </motion.div>
  )
}

function extractWidgetProps(
  widget: WidgetConfig,
  currentTime: number,
  telemetry: { frames: { timestamp: number; speed?: number; altitude?: number; latitude?: number; longitude?: number; heading?: number; gForce?: number; acceleration?: { x: number; y: number; z: number } }[] } | undefined,
  startFinishLine?: { lat: number; lon: number },
  inPoint?: number,
  outPoint?: number,
) {
  const { style, props = {} } = widget
  const theme = style?.theme ?? "dark"
  const accentColor = style?.accentColor ?? "#00ff88"

  // Filter telemetry frames to the active trim window so lap detection and
  // map traces only consider what the user chose to keep in the export.
  const allFrames = telemetry?.frames
  const trimmedFrames = allFrames && (inPoint != null || outPoint != null)
    ? allFrames.filter((f) => {
        const tMs = f.timestamp
        const start = (inPoint ?? 0) * 1000
        const end = (outPoint ?? Infinity) * 1000
        return tMs >= start && tMs <= end
      })
    : allFrames

  const frame = trimmedFrames
    ? interpolateTelemetryAt(trimmedFrames, currentTime * 1000)
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
    frames: trimmedFrames,
    currentTime,
    startFinishLine,
    ...props,
  }
}
