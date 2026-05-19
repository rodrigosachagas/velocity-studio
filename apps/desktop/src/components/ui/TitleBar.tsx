import { useProjectStore } from "@/store/useProjectStore"
import { useAppStore } from "@/store/useAppStore"
import { motion } from "framer-motion"

export function TitleBar() {
  const project = useProjectStore((s) => s.project)
  const isDirty = useProjectStore((s) => s.isDirty)
  const view = useAppStore((s) => s.view)

  return (
    <div
      className="flex items-center justify-between h-10 px-4 bg-surface-50 border-b border-white/[0.06] shrink-0"
      data-tauri-drag-region
    >
      {/* Left — window controls placeholder */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors cursor-pointer" />
        </div>
      </div>

      {/* Center — project name */}
      <div className="flex items-center gap-2">
        <motion.div
          className="flex items-center gap-1.5 text-sm font-medium text-white/70"
          animate={{ opacity: 1 }}
        >
          <span className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase">
            Velocity
          </span>
          {view === "editor" && project && (
            <>
              <span className="text-white/20 mx-1">—</span>
              <span className="text-white/60">{project.name}</span>
              {isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent/70 ml-0.5" />
              )}
            </>
          )}
        </motion.div>
      </div>

      {/* Right — actions */}
      <div className="w-20 flex justify-end">
        {view === "editor" && (
          <button
            onClick={() => useProjectStore.getState().saveProject()}
            className="btn-ghost text-xs"
          >
            Save
          </button>
        )}
      </div>
    </div>
  )
}
