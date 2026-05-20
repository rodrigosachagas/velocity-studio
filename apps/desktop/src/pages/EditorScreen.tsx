import { useEffect, useRef, useState } from "react"
import { useTimelineStore } from "@velocity/timeline"
import { useProjectStore } from "@/store/useProjectStore"
import { LeftPanel } from "@/components/editor/LeftPanel"
import { RightPanel } from "@/components/editor/RightPanel"
import { CanvasArea } from "@/components/editor/CanvasArea"
import { TimelinePanel } from "@/components/timeline/TimelinePanel"
import { EditorToolbar } from "@/components/editor/EditorToolbar"
import { ExportModal } from "@/components/export/ExportModal"

export function EditorScreen() {
  const project = useProjectStore((s) => s.project)
  const initEngine = useTimelineStore((s) => s.initEngine)
  const prevDurationRef = useRef<number>(0)
  const [showExport, setShowExport] = useState(false)

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

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-64 shrink-0 border-r border-white/[0.07] overflow-hidden flex flex-col">
          <LeftPanel />
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <CanvasArea />
        </div>

        {/* Right inspector */}
        <div className="w-64 shrink-0 border-l border-white/[0.07] overflow-hidden flex flex-col">
          <RightPanel />
        </div>
      </div>

      {/* Timeline */}
      <div className="h-48 shrink-0 border-t border-white/[0.07]">
        <TimelinePanel />
      </div>
    </div>
  )
}
