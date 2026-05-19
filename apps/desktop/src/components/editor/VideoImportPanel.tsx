import { useCallback } from "react"
import { motion } from "framer-motion"
import { useVideoImport } from "@/hooks/useVideoImport"
import { useTelemetryExtraction } from "@/hooks/useTelemetryExtraction"
import { useProjectStore } from "@/store/useProjectStore"
import { Icon } from "@/components/ui/Icon"

export function VideoImportPanel() {
  const { isImporting, error, progress, openFilePicker, importVideo } = useVideoImport()
  const { isExtracting, progress: telProgress, error: telError, extract } = useTelemetryExtraction()
  const project = useProjectStore((s) => s.project)
  const video = project?.video
  const telemetry = project?.telemetry

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer.files)
      const videoFile = files.find((f) =>
        /\.(mp4|mov)$/i.test(f.name)
      )
      if (videoFile) {
        // In Tauri, files have a path property
        const path = (videoFile as File & { path?: string }).path
        if (path) await importVideo(path)
      }
    },
    [importVideo]
  )

  if (video) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-3 space-y-2"
      >
        {/* Video loaded */}
        <div className="p-3 rounded-xl bg-surface-200 border border-white/[0.08]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded bg-blue-accent/20 flex items-center justify-center">
              <Icon name="video" size={12} className="text-blue-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white/80 truncate">{video.name}</div>
              <div className="text-[10px] text-white/35">
                {video.fps}fps · {video.width}×{video.height} · {video.codec.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="flex gap-1 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-white/35">
              {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, "0")}
            </span>
            {video.hasGPMF && (
              <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent/70">
                GPMF
              </span>
            )}
          </div>
        </div>

        {/* Telemetry extraction */}
        {!telemetry ? (
          <button
            onClick={extract}
            disabled={isExtracting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent/10 hover:bg-accent/15 border border-accent/20 text-accent text-xs font-medium transition-all disabled:opacity-50"
          >
            {isExtracting ? (
              <>
                <div className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
                {telProgress ?? "Extracting..."}
              </>
            ) : (
              <>
                <Icon name="activity" size={12} />
                Extract Telemetry
              </>
            )}
          </button>
        ) : (
          <div className="p-3 rounded-xl bg-surface-200 border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center">
                <Icon name="activity" size={12} className="text-accent" />
              </div>
              <div>
                <div className="text-xs font-medium text-white/80">Telemetry Loaded</div>
                <div className="text-[10px] text-white/35">
                  {telemetry.frames.length} frames · {telemetry.sampleRate.toFixed(0)} fps
                </div>
              </div>
            </div>
          </div>
        )}

        {(error || telError) && (
          <div className="text-[10px] text-red-400 px-2">{error ?? telError}</div>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3"
    >
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={openFilePicker}
        className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-accent/30 cursor-pointer group transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] group-hover:bg-accent/10 flex items-center justify-center transition-colors">
          {isImporting ? (
            <div className="w-4 h-4 border border-accent/40 border-t-accent rounded-full animate-spin" />
          ) : (
            <Icon name="upload" size={16} className="text-white/30 group-hover:text-accent transition-colors" />
          )}
        </div>
        <div className="text-center">
          <div className="text-xs font-medium text-white/50 group-hover:text-white/80 transition-colors">
            {isImporting ? (progress ?? "Importing...") : "Import Video"}
          </div>
          {!isImporting && (
            <div className="text-[10px] text-white/25 mt-0.5">MP4 · MOV</div>
          )}
        </div>
      </div>
      {error && <div className="text-[10px] text-red-400 mt-2 px-1">{error}</div>}
    </motion.div>
  )
}
