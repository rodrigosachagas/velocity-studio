import { useRef, useCallback } from "react"
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
import { useTimelineStore } from "@velocity/timeline"
import { WidgetCanvas } from "./WidgetCanvas"
import { VideoPreview } from "./VideoPreview"
import { Icon } from "@/components/ui/Icon"

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null)
  const project = useProjectStore((s) => s.project)
  const deselectAll = useProjectStore((s) => s.deselectAll)
  const updateWidget = useProjectStore((s) => s.updateWidget)
  const zoom = useAppStore((s) => s.zoom)
  const showGrid = useAppStore((s) => s.showGrid)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event
      const widgetId = active.id as string
      const widget = project?.widgets.find((w) => w.id === widgetId)
      if (!widget) return

      updateWidget(widgetId, {
        x: widget.x + delta.x / zoom,
        y: widget.y + delta.y / zoom,
      })
    },
    [project?.widgets, updateWidget, zoom]
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
      {/* Grid overlay */}
      {showGrid && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      )}

      {project ? (
        <DndContext
          sensors={sensors}
          modifiers={[restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <motion.div
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
