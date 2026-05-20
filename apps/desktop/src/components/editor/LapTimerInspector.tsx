import { useProjectStore } from "@/store/useProjectStore"
import type { WidgetConfig } from "@velocity/shared"

interface LapTimerInspectorProps {
  widget: WidgetConfig
}

export function LapTimerInspector({ widget }: LapTimerInspectorProps) {
  const updateWidget = useProjectStore((s) => s.updateWidget)
  const props = (widget.props ?? {}) as Record<string, unknown>
  const historyCount = (props.historyCount as number) ?? 0

  const set = (key: string, value: unknown) =>
    updateWidget(widget.id, { props: { ...props, [key]: value } })

  return (
    <div className="space-y-4">
      <div>
        <div className="label mb-2">Histórico de voltas</div>
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={10} step={1}
            value={historyCount}
            onChange={(e) => set("historyCount", parseInt(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="text-[10px] text-white/40 w-8 text-right font-mono">
            {historyCount === 0 ? "off" : `${historyCount}`}
          </span>
        </div>
        <div className="flex gap-1 mt-1.5">
          {[0, 1, 3, 5, 8, 10].map((v) => (
            <button
              key={v}
              onClick={() => set("historyCount", v)}
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
          Exibe as últimas N voltas completas abaixo do cronômetro. Aumente a altura do widget para ver mais linhas.
        </p>
      </div>
    </div>
  )
}
