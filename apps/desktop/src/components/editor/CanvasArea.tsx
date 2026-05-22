import { useRef, useCallback, useEffect } from "react"
import { useVideoImport } from "@/hooks/useVideoImport"
import { motion, AnimatePresence } from "framer-motion"
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToParentElement } from "@dnd-kit/modifiers"
import { useProjectStore } from "@/store/useProjectStore"
import { useAppStore } from "@/store/useAppStore"
import { WidgetCanvas } from "./WidgetCanvas"
import { VideoPreview } from "./VideoPreview"
import { Icon } from "@/components/ui/Icon"

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasFrameRef = useRef<HTMLDivElement>(null)
  const project = useProjectStore((s) => s.project)
  const deselectAll = useProjectStore((s) => s.deselectAll)
  const updateWidget = useProjectStore((s) => s.updateWidget)
  const zoom = useAppStore((s) => s.zoom)
  const showGrid = useAppStore((s) => s.showGrid)
  const showGuides = useAppStore((s) => s.showGuides)
  const setCanvasSize = useAppStore((s) => s.setCanvasSize)

  // Measure the canvas frame div and publish its CSS pixel dimensions.
  // Widget positions are stored in video pixel space — this ratio is used to
  // convert between canvas display pixels and video pixels everywhere.
  useEffect(() => {
    const el = canvasFrameRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setCanvasSize({ width, height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [setCanvasSize])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event
      const widgetId = active.id as string
      const widget = project?.widgets.find((w) => w.id === widgetId)
      if (!widget) return

      // delta is in screen pixels; convert to video pixel space so that stored
      // positions match the actual video frame regardless of canvas display size.
      const canvasW = canvasFrameRef.current?.offsetWidth ?? 1
      const canvasH = canvasFrameRef.current?.offsetHeight ?? 1
      const videoW = project?.video?.width ?? canvasW
      const videoH = project?.video?.height ?? canvasH
      const scaleX = videoW / canvasW
      const scaleY = videoH / canvasH

      updateWidget(widgetId, {
        x: Math.round(widget.x + (delta.x / zoom) * scaleX),
        y: Math.round(widget.y + (delta.y / zoom) * scaleY),
      })
    },
    [project?.widgets, project?.video, updateWidget, zoom]
  )

  const aspectRatio = project?.video
    ? project.video.width / project.video.height
    : 16 / 9

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden bg-[#0d0d0d] flex items-center justify-center relative"
      onClick={deselectAll}
    >
      {project ? (
        <DndContext
          sensors={sensors}
          modifiers={[restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <motion.div
            ref={canvasFrameRef}
            className="relative overflow-hidden rounded-lg shadow-elevated"
            style={{
              aspectRatio,
              height: "calc(100% - 48px)",
              maxHeight: "calc((100vw - 576px) / (16/9))",
              transform: `scale(${zoom})`,
              transformOrigin: "center",
            }}
            animate={{ scale: zoom }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <VideoPreview />

            {/* Grid: fine mesh + major lines every 10% */}
            {showGrid && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  zIndex: 1,
                  backgroundImage: [
                    "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
                    "linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                    "linear-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)",
                    "linear-gradient(90deg, rgba(255,255,255,0.10) 1px, transparent 1px)",
                  ].join(", "),
                  backgroundSize: "5% 5%, 5% 5%, 10% 10%, 10% 10%",
                }}
              />
            )}

            {/* Guides: rule of thirds + center + safe zones */}
            {showGuides && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 2 }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {/* Rule of thirds */}
                <line x1="33.33" y1="0" x2="33.33" y2="100" stroke="rgba(80,160,255,0.35)" strokeWidth="0.2" />
                <line x1="66.67" y1="0" x2="66.67" y2="100" stroke="rgba(80,160,255,0.35)" strokeWidth="0.2" />
                <line x1="0" y1="33.33" x2="100" y2="33.33" stroke="rgba(80,160,255,0.35)" strokeWidth="0.2" />
                <line x1="0" y1="66.67" x2="100" y2="66.67" stroke="rgba(80,160,255,0.35)" strokeWidth="0.2" />
                {/* Center crosshair */}
                <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.12)" strokeWidth="0.15" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.12)" strokeWidth="0.15" />
                {/* Title safe – 80% (10% inset) */}
                <rect x="10" y="10" width="80" height="80" fill="none" stroke="rgba(255,200,60,0.35)" strokeWidth="0.3" strokeDasharray="1.5 1" />
                {/* Action safe – 90% (5% inset) */}
                <rect x="5" y="5" width="90" height="90" fill="none" stroke="rgba(255,120,40,0.25)" strokeWidth="0.25" strokeDasharray="1 1.5" />
              </svg>
            )}

            <WidgetCanvas />
          </motion.div>
        </DndContext>
      ) : (
        <DropZone />
      )}
    </div>
  )
}

function DropZone() {
  const { openFilePicker, importFromDrop, isImporting } = useVideoImport()

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) await importFromDrop(e.dataTransfer.files)
  }, [importFromDrop])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-4 p-12 rounded-2xl border-2 border-dashed border-white/[0.1] hover:border-accent/40 transition-colors cursor-pointer group"
      onClick={openFilePicker}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="w-14 h-14 rounded-2xl bg-white/[0.05] flex items-center justify-center group-hover:bg-accent/10 transition-colors">
        {isImporting
          ? <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          : <Icon name="upload" size={24} className="text-white/30 group-hover:text-accent transition-colors" />
        }
      </div>
      <div className="text-center">
        <div className="text-white/60 font-medium text-sm">
          {isImporting ? "Importando..." : "Arraste seu vídeo aqui"}
        </div>
        <div className="text-white/30 text-xs mt-1">ou clique para escolher · MP4 · MOV</div>
      </div>
    </motion.div>
  )
}
