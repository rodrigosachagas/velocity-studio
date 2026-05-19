import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import { useVideoImport } from "@/hooks/useVideoImport"
import { useTelemetryExtraction } from "@/hooks/useTelemetryExtraction"
import { useProjectStore } from "@/store/useProjectStore"
import { Icon } from "@/components/ui/Icon"

export function VideoImportPanel() {
  const { isImporting, error, progress, openFilePicker, importFromDrop } = useVideoImport()
  const { isExtracting, progress: telProgress, error: telError, extract } = useTelemetryExtraction()
  const project = useProjectStore((s) => s.project)
  const video = project?.video
  const telemetry = project?.telemetry
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        await importFromDrop(e.dataTransfer.files)
      }
    },
    [importFromDrop]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }
  const handleDragLeave = () => setIsDragOver(false)

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
            <div className="w-6 h-6 rounded bg-blue-accent/20 flex items-center justify-center shrink-0">
              <Icon name="video" size={12} className="text-blue-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white/80 truncate">{video.name}</div>
              <div className="text-[10px] text-white/35">
                {video.fps.toFixed(0)}fps · {video.width}×{video.height}
                {video.codec ? ` · ${video.codec.split("/").pop()?.toUpperCase()}` : ""}
              </div>
            </div>
            {/* Replace button */}
            <button
              onClick={openFilePicker}
              className="p-1 rounded hover:bg-white/[0.07] text-white/30 hover:text-white/70 transition-colors shrink-0"
              title="Trocar vídeo"
            >
              <Icon name="upload" size={12} />
            </button>
          </div>

          <div className="flex gap-1 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-white/35">
              {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, "0")}
            </span>
            {video.size > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-white/35">
                {(video.size / 1024 / 1024).toFixed(0)} MB
              </span>
            )}
            {video.hasGPMF && (
              <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent/70">GPMF</span>
            )}
          </div>
        </div>

        {/* Telemetry extraction */}
        {!telemetry ? (
          <button
            onClick={extract}
            disabled={isExtracting || !video.hasGPMF}
            title={!video.hasGPMF ? "Este vídeo não tem dados GPMF (apenas vídeos GoPro)" : ""}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent/10 hover:bg-accent/15 border border-accent/20 text-accent text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isExtracting ? (
              <>
                <div className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
                {telProgress ?? "Extraindo..."}
              </>
            ) : (
              <>
                <Icon name="activity" size={12} />
                {video.hasGPMF ? "Extrair Telemetria" : "Sem dados GPS"}
              </>
            )}
          </button>
        ) : (
          <div className="p-2.5 rounded-xl bg-surface-200 border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-accent/20 flex items-center justify-center shrink-0">
                <Icon name="activity" size={11} className="text-accent" />
              </div>
              <div>
                <div className="text-xs font-medium text-white/80">Telemetria carregada</div>
                <div className="text-[10px] text-white/35">
                  {telemetry.frames.length.toLocaleString()} frames · {telemetry.sampleRate.toFixed(0)} fps
                </div>
              </div>
            </div>
          </div>
        )}

        {(error || telError) && (
          <div className="text-[10px] text-red-400/90 px-1 leading-relaxed">{error ?? telError}</div>
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
      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFilePicker}
        animate={{ borderColor: isDragOver ? "rgba(0,255,136,0.5)" : "rgba(255,255,255,0.1)" }}
        className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed cursor-pointer group transition-colors"
        style={{ borderColor: isDragOver ? "rgba(0,255,136,0.5)" : undefined }}
      >
        <motion.div
          animate={{ scale: isDragOver ? 1.1 : 1, background: isDragOver ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.04)" }}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
        >
          {isImporting ? (
            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          ) : (
            <Icon
              name="upload"
              size={16}
              className={`transition-colors ${isDragOver ? "text-accent" : "text-white/30 group-hover:text-accent"}`}
            />
          )}
        </motion.div>

        <div className="text-center">
          <div className={`text-xs font-medium transition-colors ${isDragOver ? "text-accent" : "text-white/50 group-hover:text-white/80"}`}>
            {isImporting ? (progress ?? "Importando...") : isDragOver ? "Soltar aqui" : "Importar Vídeo"}
          </div>
          {!isImporting && (
            <div className="text-[10px] text-white/25 mt-0.5">
              Arraste · MP4 · MOV
            </div>
          )}
        </div>
      </motion.div>

      {error && (
        <div className="mt-2 px-2 text-[10px] text-red-400/90 leading-relaxed">{error}</div>
      )}
    </motion.div>
  )
}
