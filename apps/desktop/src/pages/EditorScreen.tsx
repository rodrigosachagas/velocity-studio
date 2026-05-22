import { useEffect, useRef, useState, useCallback } from "react"
import { useTimelineStore } from "@velocity/timeline"
import { useProjectStore } from "@/store/useProjectStore"
import { LeftPanel } from "@/components/editor/LeftPanel"
import { RightPanel } from "@/components/editor/RightPanel"
import { CanvasArea } from "@/components/editor/CanvasArea"
import { TimelinePanel } from "@/components/timeline/TimelinePanel"
import { EditorToolbar } from "@/components/editor/EditorToolbar"
import { ExportModal } from "@/components/export/ExportModal"

const PANEL_LEFT_DEFAULT = 256
const PANEL_RIGHT_DEFAULT = 256
const TIMELINE_DEFAULT = 192
const PANEL_MIN = 160
const PANEL_MAX = 520
const TIMELINE_MIN = 72
const TIMELINE_MAX = 440

function useDragResize(
  setValue: React.Dispatch<React.SetStateAction<number>>,
  min: number,
  max: number,
  axis: "x" | "y",
  invert = false,
) {
  return useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      let prev = axis === "x" ? e.clientX : e.clientY

      const onMove = (ev: MouseEvent) => {
        const curr = axis === "x" ? ev.clientX : ev.clientY
        const delta = invert ? prev - curr : curr - prev
        prev = curr
        setValue((v) => Math.max(min, Math.min(max, v + delta)))
      }
      const onUp = () => {
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize"
      document.body.style.userSelect = "none"
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [setValue, min, max, axis, invert],
  )
}

interface DividerProps {
  direction: "vertical" | "horizontal"
  onMouseDown: (e: React.MouseEvent) => void
  onDoubleClick: () => void
}

function Divider({ direction, onMouseDown, onDoubleClick }: DividerProps) {
  const isV = direction === "vertical"
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className={`group shrink-0 flex items-center justify-center bg-transparent hover:bg-accent/10 transition-colors ${
        isV
          ? "h-1 cursor-row-resize border-t border-white/[0.07]"
          : "w-1 cursor-col-resize border-r border-white/[0.07]"
      }`}
      title="Arraste para redimensionar · duplo clique para resetar"
    >
      {isV ? (
        <div className="w-8 h-px bg-white/10 group-hover:bg-accent/40 transition-colors rounded-full" />
      ) : (
        <div className="h-8 w-px bg-white/10 group-hover:bg-accent/40 transition-colors rounded-full" />
      )}
    </div>
  )
}

export function EditorScreen() {
  const project = useProjectStore((s) => s.project)
  const initEngine = useTimelineStore((s) => s.initEngine)
  const prevDurationRef = useRef<number>(0)
  const [showExport, setShowExport] = useState(false)

  const [leftWidth, setLeftWidth] = useState(PANEL_LEFT_DEFAULT)
  const [rightWidth, setRightWidth] = useState(PANEL_RIGHT_DEFAULT)
  const [timelineHeight, setTimelineHeight] = useState(TIMELINE_DEFAULT)

  const dragLeft = useDragResize(setLeftWidth, PANEL_MIN, PANEL_MAX, "x")
  const dragRight = useDragResize(setRightWidth, PANEL_MIN, PANEL_MAX, "x", true)
  const dragTimeline = useDragResize(setTimelineHeight, TIMELINE_MIN, TIMELINE_MAX, "y", true)

  useEffect(() => {
    const duration = project?.timeline.duration ?? 0
    if (duration !== prevDurationRef.current) {
      prevDurationRef.current = duration
      initEngine({ duration }, 30)
    }
  }, [project?.timeline.duration, initEngine])

  if (!project) return null

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar onExport={() => setShowExport(true)} />
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left sidebar */}
        <div
          style={{ width: leftWidth }}
          className="shrink-0 overflow-hidden flex flex-col"
        >
          <LeftPanel />
        </div>

        <Divider
          direction="horizontal"
          onMouseDown={dragLeft}
          onDoubleClick={() => setLeftWidth(PANEL_LEFT_DEFAULT)}
        />

        {/* Canvas area */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <CanvasArea />
        </div>

        <Divider
          direction="horizontal"
          onMouseDown={dragRight}
          onDoubleClick={() => setRightWidth(PANEL_RIGHT_DEFAULT)}
        />

        {/* Right inspector */}
        <div
          style={{ width: rightWidth }}
          className="shrink-0 overflow-hidden flex flex-col"
        >
          <RightPanel />
        </div>
      </div>

      <Divider
        direction="vertical"
        onMouseDown={dragTimeline}
        onDoubleClick={() => setTimelineHeight(TIMELINE_DEFAULT)}
      />

      {/* Timeline */}
      <div style={{ height: timelineHeight }} className="shrink-0">
        <TimelinePanel />
      </div>
    </div>
  )
}
