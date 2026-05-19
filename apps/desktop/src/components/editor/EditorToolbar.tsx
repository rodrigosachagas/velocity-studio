import { useAppStore } from "@/store/useAppStore"
import { useProjectStore } from "@/store/useProjectStore"
import { Icon } from "@/components/ui/Icon"

export function EditorToolbar() {
  const showGrid = useAppStore((s) => s.showGrid)
  const showGuides = useAppStore((s) => s.showGuides)
  const toggleGrid = useAppStore((s) => s.toggleGrid)
  const toggleGuides = useAppStore((s) => s.toggleGuides)
  const zoom = useAppStore((s) => s.zoom)
  const setZoom = useAppStore((s) => s.setZoom)
  const project = useProjectStore((s) => s.project)

  return (
    <div className="h-10 bg-surface-50 border-b border-white/[0.07] flex items-center px-3 gap-2 shrink-0">
      {/* File name + video status */}
      <div className="flex items-center gap-2 mr-2">
        {project?.video ? (
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <Icon name="video" size={13} />
            <span className="max-w-[120px] truncate">{project.video.name}</span>
            <span className="text-white/30">
              {project.video.fps}fps · {project.video.width}×{project.video.height}
            </span>
          </div>
        ) : (
          <span className="text-xs text-white/30">No video loaded</span>
        )}
      </div>

      <div className="h-4 w-px bg-white/[0.07] mx-1" />

      {/* Grid / guides toggles */}
      <button
        onClick={toggleGrid}
        className={`btn-ghost flex items-center gap-1.5 text-xs ${showGrid ? "text-accent" : ""}`}
        title="Toggle grid"
      >
        <Icon name="layers" size={13} />
        Grid
      </button>

      <button
        onClick={toggleGuides}
        className={`btn-ghost flex items-center gap-1.5 text-xs ${showGuides ? "text-accent" : ""}`}
        title="Toggle guides"
      >
        <Icon name="map" size={13} />
        Guides
      </button>

      <div className="h-4 w-px bg-white/[0.07] mx-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
          className="btn-ghost text-xs px-2 py-1"
        >
          −
        </button>
        <span className="text-xs text-white/50 w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(Math.min(4, zoom + 0.25))}
          className="btn-ghost text-xs px-2 py-1"
        >
          +
        </button>
      </div>

      <div className="flex-1" />

      {/* Export button */}
      <button className="flex items-center gap-1.5 btn-primary text-xs">
        <Icon name="export" size={13} />
        Export
      </button>
    </div>
  )
}
