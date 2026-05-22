import { useMemo } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { lapTimerIdealHeight } from "@velocity/widgets"
import { computeLaps } from "@velocity/shared"
import type { WidgetConfig } from "@velocity/shared"

interface LapTimerInspectorProps {
  widget: WidgetConfig
}

export function LapTimerInspector({ widget }: LapTimerInspectorProps) {
  const updateWidget = useProjectStore((s) => s.updateWidget)
  const telemetry = useProjectStore((s) => s.project?.telemetry)
  const startFinishLine = useProjectStore((s) => s.project?.startFinishLine)
  const props = (widget.props ?? {}) as Record<string, unknown>
  const historyCount = (props.historyCount as number) ?? 0

  const detectedLaps = useMemo(() => {
    if (!telemetry?.frames || !startFinishLine) return null
    const session = computeLaps(telemetry.frames, startFinishLine)
    return session.laps.length
  }, [telemetry?.frames, startFinishLine])

  const set = (key: string, value: unknown) =>
    updateWidget(widget.id, { props: { ...props, [key]: value } })

  const setHistoryCount = (count: number) => {
    updateWidget(widget.id, {
      props: { ...props, historyCount: count },
      height: lapTimerIdealHeight(count, widget.width),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="label mb-2">Histórico de voltas</div>
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={30} step={1}
            value={historyCount}
            onChange={(e) => setHistoryCount(parseInt(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="text-[10px] text-white/40 w-8 text-right font-mono">
            {historyCount === 0 ? "off" : `${historyCount}`}
          </span>
        </div>
        <div className="flex gap-1 mt-1.5">
          {[0, 5, 10, 15, 20, 30].map((v) => (
            <button
              key={v}
              onClick={() => setHistoryCount(v)}
              className={`flex-1 py-0.5 rounded text-[10px] transition-colors ${
                historyCount === v
                  ? "bg-accent/20 text-accent"
                  : "bg-surface-200 text-white/35 hover:text-white/70"
              }`}
            >
              {v === 0 ? "off" : v}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-white/25 mt-1.5 leading-relaxed">
          O widget redimensiona automaticamente ao alterar o valor.
        </p>
      </div>

      {/* Lap detection info */}
      <div className="mt-2 rounded-md bg-black/30 border border-white/[0.06] px-3 py-2 space-y-1.5">
        <div className="text-[9px] text-white/30 uppercase tracking-wider">Detecção GPS</div>
        {detectedLaps === null ? (
          <p className="text-[10px] text-white/30">
            {!startFinishLine ? "Marque a largada no Circuit Map para detectar voltas." : "Sem dados de telemetria."}
          </p>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/50">Voltas detectadas</span>
            <span className="text-[11px] font-mono font-semibold text-accent">{detectedLaps}</span>
          </div>
        )}
      </div>
    </div>
  )
}
