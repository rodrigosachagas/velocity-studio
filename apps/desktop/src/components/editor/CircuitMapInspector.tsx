import { useProjectStore } from "@/store/useProjectStore"
import { useAppStore } from "@/store/useAppStore"
import type { WidgetConfig } from "@velocity/shared"

const MAP_PALETTES = [
  { name: "GoPro",   track: "#00ff88", car: "#ffffff" },
  { name: "Neon",    track: "#00ffff", car: "#ff00aa" },
  { name: "Racing",  track: "#ff3300", car: "#ffcc00" },
  { name: "Ice",     track: "#88ddff", car: "#ffffff" },
  { name: "Purple",  track: "#cc44ff", car: "#44ffcc" },
  { name: "Gold",    track: "#ffcc00", car: "#ff6600" },
]

interface CircuitMapInspectorProps {
  widget: WidgetConfig
}

export function CircuitMapInspector({ widget }: CircuitMapInspectorProps) {
  const updateWidget = useProjectStore((s) => s.updateWidget)
  const startFinishLine = useProjectStore((s) => s.project?.startFinishLine)
  const clearStartFinishLine = useProjectStore((s) => s.clearStartFinishLine)
  const isPickingStartFinish = useAppStore((s) => s.isPickingStartFinish)
  const setPickingStartFinish = useAppStore((s) => s.setPickingStartFinish)

  const props = (widget.props ?? {}) as Record<string, unknown>
  const carColor   = props.carColor   as string | undefined
  const carSize    = (props.carSize   as number) ?? 1
  const trackWidth = (props.trackWidth as number) ?? 2
  const trackStyle = (props.trackStyle as "gradient" | "circuit") ?? "gradient"
  const showLabel  = (props.showLabel  as boolean) ?? true
  const trackColor = widget.style?.accentColor ?? "#00ff88"

  const set = (key: string, value: unknown) =>
    updateWidget(widget.id, { props: { ...props, [key]: value } })

  const setTrackColor = (v: string) =>
    updateWidget(widget.id, { style: { theme: "dark", ...widget.style, accentColor: v } })

  return (
    <div className="space-y-4">

      {/* Track style */}
      <div>
        <div className="label mb-2">Estilo do traçado</div>
        <div className="grid grid-cols-2 gap-1.5">
          <StyleButton
            active={trackStyle === "gradient"}
            onClick={() => set("trackStyle", "gradient")}
            label="Velocidade"
            description="Heatmap por velocidade"
            preview={
              <svg width={48} height={20} viewBox="0 0 48 20">
                {[0,0.2,0.4,0.6,0.8].map((t, i) => (
                  <line key={i} x1={i * 10 + 2} y1={10} x2={i * 10 + 10} y2={10}
                    stroke={`hsl(${120 - t * 120},100%,50%)`} strokeWidth={3} strokeLinecap="round" />
                ))}
              </svg>
            }
          />
          <StyleButton
            active={trackStyle === "circuit"}
            onClick={() => set("trackStyle", "circuit")}
            label="Circuito"
            description="Visual de pista de corrida"
            preview={
              <svg width={48} height={20} viewBox="0 0 48 20">
                <path d="M4,10 C10,4 38,4 44,10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={7} strokeLinecap="round" />
                <path d="M4,10 C10,4 38,4 44,10" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} strokeLinecap="round" />
                <path d="M4,10 C10,4 38,4 44,10" fill="none" stroke="#00ff88" strokeWidth={1}
                  strokeLinecap="round" strokeDasharray="4 5" strokeOpacity={0.6} />
              </svg>
            }
          />
        </div>
      </div>

      <Divider />

      {/* Color palettes */}
      <div>
        <div className="label mb-2">Paletas rápidas</div>
        <div className="flex gap-1.5 flex-wrap">
          {MAP_PALETTES.map((p) => (
            <button
              key={p.name}
              title={p.name}
              onClick={() => { setTrackColor(p.track); set("carColor", p.car) }}
              className="flex gap-0.5 p-1 rounded-md hover:bg-white/[0.06] transition-colors"
            >
              <div style={{ width: 12, height: 12, borderRadius: 3, background: p.track }} />
              <div style={{ width: 12, height: 12, borderRadius: 3, background: p.car }} />
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* Colors */}
      <div>
        <div className="label mb-2">Cores</div>
        <div className="space-y-2">
          <ColorRow label="Traçado" value={trackColor} onChange={setTrackColor} />
          <ColorRow
            label="Carro"
            value={carColor ?? trackColor}
            onChange={(v) => set("carColor", v)}
          />
        </div>
      </div>

      <Divider />

      {/* Car size */}
      <div>
        <div className="label mb-2">Tamanho do carro</div>
        <div className="flex items-center gap-2">
          <input
            type="range" min={0.5} max={5} step={0.1}
            value={carSize}
            onChange={(e) => set("carSize", parseFloat(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="text-[10px] text-white/40 w-8 text-right font-mono">
            {carSize.toFixed(1)}×
          </span>
        </div>
        <div className="flex gap-1 mt-1.5">
          {[0.7, 1, 1.5, 2, 3, 5].map((v) => (
            <button
              key={v}
              onClick={() => set("carSize", v)}
              className={`flex-1 py-0.5 rounded text-[10px] transition-colors ${
                Math.abs(carSize - v) < 0.05
                  ? "bg-accent/20 text-accent"
                  : "bg-surface-200 text-white/35 hover:text-white/70"
              }`}
            >
              {v}×
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* Track width */}
      <div>
        <div className="label mb-2">Espessura do traçado</div>
        <div className="flex items-center gap-2">
          <input
            type="range" min={1} max={6} step={0.5}
            value={trackWidth}
            onChange={(e) => set("trackWidth", parseFloat(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="text-[10px] text-white/40 w-8 text-right font-mono">
            {trackWidth}px
          </span>
        </div>
      </div>

      <Divider />

      {/* Display toggles */}
      <div>
        <div className="label mb-2">Exibição</div>
        <div className="space-y-2">
          <ToggleRow
            label="Label GPS Track"
            value={showLabel}
            onChange={(v) => set("showLabel", v)}
          />
        </div>
      </div>

      <Divider />

      {/* Start/Finish line */}
      <div>
        <div className="label mb-2">Ponto de Largada (S/F)</div>

        {startFinishLine ? (
          <div className="space-y-2">
            <div className="bg-surface-200 rounded-lg p-2 text-[10px] font-mono text-white/50 space-y-0.5">
              <div>Lat: {startFinishLine.lat.toFixed(6)}</div>
              <div>Lon: {startFinishLine.lon.toFixed(6)}</div>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPickingStartFinish(true)}
                className="flex-1 py-1 rounded text-[10px] bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
              >
                Remarcar
              </button>
              <button
                onClick={() => clearStartFinishLine()}
                className="flex-1 py-1 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                Remover
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-white/30 leading-relaxed">
              Marque o ponto de largada no mapa para contagem de voltas e cronometragem automática.
            </p>
            <button
              onClick={() => setPickingStartFinish(true)}
              disabled={isPickingStartFinish}
              className={`w-full py-1.5 rounded-md text-[11px] font-medium border transition-all ${
                isPickingStartFinish
                  ? "bg-accent/20 text-accent border-accent/50 cursor-default"
                  : "bg-surface-200 text-white/60 border-white/10 hover:bg-accent/10 hover:text-accent hover:border-accent/30"
              }`}
            >
              {isPickingStartFinish ? "Clique no mapa..." : "Marcar no mapa"}
            </button>
            {isPickingStartFinish && (
              <button
                onClick={() => setPickingStartFinish(false)}
                className="w-full py-1 rounded text-[10px] text-white/30 hover:text-white/60 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

function StyleButton({
  active,
  onClick,
  label,
  description,
  preview,
}: {
  active: boolean
  onClick: () => void
  label: string
  description: string
  preview: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
        active
          ? "bg-accent/10 border-accent/40 text-accent"
          : "bg-surface-200 border-transparent text-white/40 hover:text-white/70 hover:border-white/10"
      }`}
    >
      {preview}
      <span className="text-[10px] font-medium">{label}</span>
      <span className="text-[9px] opacity-60 leading-tight text-center">{description}</span>
    </button>
  )
}

function Divider() {
  return <div className="h-px bg-white/[0.06]" />
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-16 shrink-0">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded-md cursor-pointer border border-white/[0.08] bg-transparent"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-surface-200 border border-white/[0.08] rounded px-2 py-1 text-xs text-white/60 font-mono focus:outline-none focus:border-accent/40"
      />
    </div>
  )
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-white/40">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-8 h-4 rounded-full transition-colors relative ${value ? "bg-accent" : "bg-white/10"}`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  )
}
