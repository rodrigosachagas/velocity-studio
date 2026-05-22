import { useRef, useState } from "react"
import { ExportOverlay } from "./ExportOverlay"
import { useExport } from "@/hooks/useExport"
import { useProjectStore } from "@/store/useProjectStore"
import type { ExportSettings } from "@/hooks/useExport"

interface ExportModalProps {
  onClose: () => void
}

export function ExportModal({ onClose }: ExportModalProps) {
  const project = useProjectStore((s) => s.project)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [overlayTime, setOverlayTime] = useState(0)
  const QUALITY_PRESETS = [
    { id: "social", label: "Redes sociais", hint: "Compacto · WhatsApp, Instagram", crf: 26 },
    { id: "high",   label: "Alta qualidade", hint: "Recomendado · YouTube, publicar", crf: 18 },
    { id: "max",    label: "Máxima",         hint: "Arquivo grande · edição, arquivo", crf: 12 },
  ] as const

  const [settings, setSettings] = useState<ExportSettings>({ codec: "h264", crf: 18 })
  const [testExport, setTestExport] = useState(false)

  const { startExport, cancel, reset, state } = useExport()

  if (!project) return null
  const video = project.video

  const sourceFps = video ? Math.round(video.fps) : 30

  const isActive = state.phase === "rendering" || state.phase === "encoding"
  const isDone = state.phase === "done"
  const isError = state.phase === "error"

  const segments = [...(project.segments ?? [])].sort((a, b) => a.order - b.order)
  const isMultiSeg = segments.length > 1

  const inPoint: number | undefined = project.timeline.inPoint
  const outPoint: number | undefined = project.timeline.outPoint
  const trimStart = inPoint ?? 0
  const trimEnd = outPoint ?? video?.duration ?? 0
  const hasTrim = inPoint != null || outPoint != null

  const handleExport = () => {
    if (!video) return
    const maxDuration = testExport ? Math.max(1, (trimEnd - trimStart) * 0.05) : undefined
    startExport(overlayRef, setOverlayTime, {
      ...settings,
      videoPath: (isMultiSeg ? segments[0]?.path : undefined) ?? video.path,
      segmentPaths: isMultiSeg ? segments.map((s) => s.path) : undefined,
      fps: video.fps,
      duration: video.duration,
      videoWidth: video.width,
      videoHeight: video.height,
      maxDuration,
      trimStart: hasTrim && trimStart > 0 ? trimStart : undefined,
      trimEnd: hasTrim && trimEnd < video.duration ? trimEnd : undefined,
    })
  }

  const handleClose = () => {
    if (isActive) return
    reset()
    onClose()
  }

  const phaseLabel = state.phase === "rendering"
    ? `Rendering frame ${state.currentFrame} of ${state.totalFrames}`
    : state.phase === "encoding"
    ? "Encoding video with FFmpeg…"
    : isDone
    ? "Export complete!"
    : ""

  return (
    <>
      {/* Hidden overlay rendered off-screen for frame capture */}
      {video && (
        <ExportOverlay
          ref={overlayRef}
          widgets={project.widgets}
          telemetry={project.telemetry}
          currentTime={overlayTime}
          videoWidth={video.width}
          videoHeight={video.height}
          startFinishLine={project.startFinishLine}
          inPoint={inPoint}
          outPoint={outPoint}
        />
      )}

      {/* Modal backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      >
        <div
          className="bg-[#111115] border border-white/10 rounded-xl w-[460px] p-6 shadow-2xl space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Export Video</h2>
            {!isActive && (
              <button
                onClick={handleClose}
                className="text-white/40 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center rounded"
              >
                ×
              </button>
            )}
          </div>

          {/* Video info */}
          {video ? (
            <div className="bg-black/30 rounded-lg p-3 text-xs space-y-1.5">
              <InfoRow label="Arquivo" value={video.name} />
              <InfoRow label="Resolução" value={`${video.width}×${video.height}`} />
              <InfoRow label="Duração" value={`${video.duration.toFixed(1)}s`} />
              <InfoRow label="FPS" value={`${sourceFps}fps`} />
              {project.telemetry && (
                <InfoRow
                  label="Telemetria"
                  value={`${project.telemetry.frames.length} frames`}
                  accent
                />
              )}
            </div>
          ) : (
            <div className="bg-black/30 rounded-lg p-3 text-xs text-white/40 text-center">
              Nenhum vídeo carregado
            </div>
          )}

          {/* Codec selector */}
          <div className="space-y-2">
            <label className="text-xs text-white/50">Codec</label>
            <div className="grid grid-cols-3 gap-2">
              {(["h264", "h265", "prores"] as const).map((c) => (
                <button
                  key={c}
                  disabled={isActive}
                  onClick={() => setSettings((s) => ({ ...s, codec: c }))}
                  className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                    settings.codec === c
                      ? "bg-accent/20 border-accent/60 text-accent"
                      : "bg-black/20 border-white/10 text-white/50 hover:border-white/20"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {c === "h264" ? "H.264" : c === "h265" ? "H.265" : "ProRes"}
                </button>
              ))}
            </div>
          </div>

          {/* FPS */}
          <div className="space-y-2">
            <label className="text-xs text-white/50">FPS de saída</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { label: `Nativo · ${sourceFps}fps`, value: undefined },
                ...(sourceFps > 30 ? [{ label: "30fps", value: 30 as number }] : []),
                { label: "24fps", value: 24 as number },
                ...(sourceFps < 60 ? [{ label: "60fps", value: 60 as number }] : []),
              ] as { label: string; value: number | undefined }[]).map(({ label, value }) => (
                <button
                  key={label}
                  disabled={isActive}
                  onClick={() => setSettings((s) => ({ ...s, outputFps: value }))}
                  className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                    settings.outputFps === value
                      ? "bg-accent/20 border-accent/60 text-accent"
                      : "bg-black/20 border-white/10 text-white/50 hover:border-white/20"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality presets */}
          <div className="space-y-2">
            <label className="text-xs text-white/50">Qualidade</label>
            <div className="grid grid-cols-3 gap-2">
              {QUALITY_PRESETS.map((preset) => {
                const active = settings.crf === preset.crf
                return (
                  <button
                    key={preset.id}
                    disabled={isActive}
                    onClick={() => setSettings((s) => ({ ...s, crf: preset.crf }))}
                    className={`py-2.5 px-3 rounded-lg text-left border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      active
                        ? "bg-accent/20 border-accent/60"
                        : "bg-black/20 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className={`text-xs font-medium ${active ? "text-accent" : "text-white/70"}`}>
                      {preset.label}
                    </div>
                    <div className="text-[10px] text-white/35 mt-0.5 leading-tight">{preset.hint}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Progress */}
          {(isActive || isDone) && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white/50">
                <span>{phaseLabel}</span>
                <span>{Math.round(state.progress * 100)}%</span>
              </div>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${state.progress * 100}%`,
                    background: isDone ? "#00ff88" : "var(--color-accent, #00ff88)",
                  }}
                />
              </div>
              {isDone && state.outputPath && (
                <div className="text-xs text-accent/80 break-all">{state.outputPath}</div>
              )}
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="space-y-2">
              <div className="text-xs text-red-400 bg-red-400/10 rounded-lg p-3 max-h-24 overflow-y-auto whitespace-pre-wrap break-all">
                {state.error}
              </div>
              {state.logs.length > 0 && (
                <details className="group">
                  <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 select-none">
                    Ver log de diagnóstico ({state.logs.length} entradas)
                  </summary>
                  <div className="mt-1.5 relative">
                    <pre className="text-[10px] text-white/40 bg-black/40 rounded-lg p-3 max-h-40 overflow-y-auto leading-relaxed">
                      {state.logs.join("\n")}
                    </pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(state.logs.join("\n"))}
                      className="absolute top-2 right-2 text-[10px] text-white/30 hover:text-white/60 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded"
                    >
                      Copiar
                    </button>
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Test export toggle */}
          {!isActive && !isDone && video && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setTestExport((v) => !v)}
                className={`w-8 h-4 rounded-full transition-colors relative ${
                  testExport ? "bg-accent/70" : "bg-white/10"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    testExport ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-xs text-white/50">
                Exportar apenas 5%
                {testExport && video && (
                  <span className="text-white/30 ml-1">
                    ({Math.max(1, video.duration * 0.05).toFixed(1)}s)
                  </span>
                )}
              </span>
            </label>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            {isDone ? (
              <button onClick={handleClose} className="flex-1 btn-primary text-sm py-2.5">
                Fechar
              </button>
            ) : isActive ? (
              <button onClick={cancel} className="flex-1 btn-ghost text-sm py-2.5">
                Cancelar
              </button>
            ) : (
              <>
                <button onClick={handleClose} className="flex-1 btn-ghost text-sm py-2.5">
                  Cancelar
                </button>
                <button
                  onClick={handleExport}
                  disabled={!video}
                  className="flex-1 btn-primary text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Exportar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className="text-white/40">{label}</span>
      <span className={accent ? "text-accent" : "text-white/70"}>{value}</span>
    </div>
  )
}
