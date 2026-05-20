import { useCallback, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useVideoImport } from "@/hooks/useVideoImport"
import { useTelemetryExtraction } from "@/hooks/useTelemetryExtraction"
import { useProjectStore } from "@/store/useProjectStore"
import { Icon } from "@/components/ui/Icon"
import { isTauri } from "@/lib/tauri"
import type { SimulationProfile } from "@velocity/telemetry"
import type { VideoSegment } from "@velocity/shared"

const SIM_PROFILES: { id: SimulationProfile; label: string; icon: string }[] = [
  { id: "road",     label: "Road",     icon: "gauge" },
  { id: "track",    label: "Track",    icon: "zap" },
  { id: "mountain", label: "Mountain", icon: "trending-up" },
  { id: "cycling",  label: "Cycling",  icon: "activity" },
  { id: "walking",  label: "Walking",  icon: "footprints" },
]

export function VideoImportPanel() {
  const { isImporting, error, progress, openFilePicker, importFromDrop, importSegments, openSegmentsPicker } = useVideoImport()
  const { isExtracting, progress: telProgress, error: telError, extract, extractFromGPX, simulate } = useTelemetryExtraction()
  const project = useProjectStore((s) => s.project)
  const removeSegment = useProjectStore((s) => s.removeSegment)
  const segmentTelemetries = useProjectStore((s) => s.segmentTelemetries)
  const video = project?.video
  const telemetry = project?.telemetry
  const segments: VideoSegment[] = [...(project?.segments ?? [])].sort((a, b) => a.order - b.order)
  const isMultiSeg = segments.length > 0
  const [isDragOver, setIsDragOver] = useState(false)
  const [showSim, setShowSim] = useState(false)
  const gpxInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      await importFromDrop(e.dataTransfer.files)
    }
  }, [importFromDrop])

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = () => setIsDragOver(false)

  const handleGPXPick = useCallback(() => gpxInputRef.current?.click(), [])
  const handleGPXChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await extractFromGPX(file)
    e.target.value = ""
  }, [extractFromGPX])

  const formatDuration = (secs: number) =>
    `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`

  // Drop handler available in both empty and video-loaded states
  const handleDropOnPanel = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => /\.(mp4|mov)$/i.test(f.name) || f.type.startsWith("video/"),
    )
    if (files.length === 0) return
    if (files.length === 1 && !isMultiSeg) {
      await importFromDrop(e.dataTransfer.files)
    } else {
      // Multiple files, or adding to existing session → segment mode (append)
      await importSegments(files, !isMultiSeg)
    }
  }, [importFromDrop, importSegments, isMultiSeg])

  if (video) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        onDrop={handleDropOnPanel}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="p-3 space-y-2"
        style={{ outline: isDragOver ? "2px dashed rgba(0,255,136,0.5)" : undefined, borderRadius: 12 }}
      >
        {/* Multi-segment list */}
        {isMultiSeg ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-0.5 mb-1">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">
                {segments.length} segmento{segments.length !== 1 ? "s" : ""}
              </span>
              <span className="text-[10px] text-white/30">
                {formatDuration(segments.reduce((s, seg) => s + seg.duration, 0))}
              </span>
            </div>
            {segments.map((seg) => {
              const hasTel = !!segmentTelemetries[seg.id]
              return (
                <div key={seg.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-200 border border-white/[0.06] group">
                  <div className="w-4 h-4 rounded bg-blue-accent/15 flex items-center justify-center shrink-0 text-[9px] font-bold text-blue-accent/60">
                    {seg.order + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-white/70 truncate">{seg.name}</div>
                    <div className="text-[9px] text-white/30">{formatDuration(seg.duration)}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {hasTel && (
                      <span className="px-1 py-0.5 rounded bg-accent/10 text-accent/60 text-[8px]">GPS</span>
                    )}
                    <button
                      onClick={() => removeSegment(seg.id)}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all"
                      title="Remover segmento"
                    >
                      <Icon name="x" size={10} />
                    </button>
                  </div>
                </div>
              )
            })}
            <button
              onClick={openSegmentsPicker}
              disabled={isImporting}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-dashed border-white/[0.1] text-white/30 hover:text-white/60 text-[10px] transition-all disabled:opacity-40"
            >
              <Icon name="plus" size={10} />
              Adicionar arquivos
            </button>
          </div>
        ) : (
          /* Single-file video info */
          <div className="space-y-1">
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
                  {formatDuration(video.duration)}
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
            <button
              onClick={openSegmentsPicker}
              disabled={isImporting}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-dashed border-white/[0.1] text-white/30 hover:text-white/60 text-[10px] transition-all disabled:opacity-40"
            >
              <Icon name="plus" size={10} />
              Adicionar mais arquivos (multi-segmento)
            </button>
          </div>
        )}

        {/* Telemetry section */}
        {!telemetry ? (
          <div className="space-y-1.5">
            {/* GPMF extraction — manual trigger only in Tauri (browser auto-extracts on import) */}
            {video.hasGPMF && isTauri() && (
              <button
                onClick={extract}
                disabled={isExtracting}
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
                    Extrair Telemetria GPMF
                  </>
                )}
              </button>
            )}

            {/* GPX import */}
            <button
              onClick={handleGPXPick}
              disabled={isExtracting}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-white/50 hover:text-white/80 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon name="map-pin" size={12} />
              Importar arquivo GPX
            </button>
            <input
              ref={gpxInputRef}
              type="file"
              accept=".gpx,application/gpx+xml"
              className="hidden"
              onChange={handleGPXChange}
            />

            {/* Simulate */}
            <button
              onClick={() => setShowSim((v) => !v)}
              disabled={isExtracting}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-white/50 hover:text-white/80 text-xs font-medium transition-all disabled:opacity-40"
            >
              <Icon name="sparkle" size={12} />
              Simular dados de telemetria
            </button>

            <AnimatePresence>
              {showSim && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-1 grid grid-cols-5 gap-1">
                    {SIM_PROFILES.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => simulate(p.id)}
                        disabled={isExtracting}
                        className="flex flex-col items-center gap-1 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 border border-white/[0.06] hover:border-accent/30 text-white/40 hover:text-white/80 transition-all disabled:opacity-40"
                      >
                        <Icon name={p.icon as never} size={12} />
                        <span className="text-[9px]">{p.label}</span>
                      </button>
                    ))}
                  </div>
                  {isExtracting && (
                    <div className="flex items-center gap-1.5 mt-2 px-1">
                      <div className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
                      <span className="text-[10px] text-white/40">{telProgress ?? "Gerando..."}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-surface-200 border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-accent/20 flex items-center justify-center shrink-0">
                <Icon name="activity" size={11} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white/80">Telemetria carregada</div>
                <div className="text-[10px] text-white/35">
                  {telemetry.frames.length.toLocaleString()} frames · {telemetry.sampleRate.toFixed(0)} fps
                  {telemetry.metadata?.profile ? ` · sim:${telemetry.metadata.profile}` : ""}
                  {telemetry.metadata?.source === "gpx" ? ` · GPX` : ""}
                </div>
              </div>
              {/* Re-import options */}
              <div className="flex gap-1">
                <button
                  onClick={handleGPXPick}
                  className="p-1 rounded hover:bg-white/[0.07] text-white/25 hover:text-white/60 transition-colors"
                  title="Trocar GPX"
                >
                  <Icon name="map-pin" size={11} />
                </button>
                <button
                  onClick={() => simulate()}
                  className="p-1 rounded hover:bg-white/[0.07] text-white/25 hover:text-white/60 transition-colors"
                  title="Re-simular"
                >
                  <Icon name="sparkle" size={11} />
                </button>
              </div>
            </div>
          </div>
        )}

        {progress && !error && (
          <div className="flex items-center gap-1.5 px-1">
            <div className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin shrink-0" />
            <span className="text-[10px] text-white/40">{progress}</span>
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
              Arraste 1 ou + arquivos · MP4 · MOV
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
