import { useProjectStore } from "@/store/useProjectStore"
import { SPEEDOMETER_VARIANTS } from "@velocity/widgets"
import type { WidgetConfig } from "@velocity/shared"
import type { SpeedometerVariant } from "@velocity/widgets"

interface SpeedometerInspectorProps {
  widget: WidgetConfig
}

export function SpeedometerInspector({ widget }: SpeedometerInspectorProps) {
  const updateWidget = useProjectStore((s) => s.updateWidget)

  const props = (widget.props ?? {}) as Record<string, unknown>
  const currentVariant = (props.variant as SpeedometerVariant) ?? "arc"
  const maxSpeed = (props.maxSpeed as number) ?? 200
  const unit = (props.unit as string) ?? "kmh"
  const showUnit = (props.showUnit as boolean) ?? true
  const showMax = (props.showMax as boolean) ?? false
  const showLabel = (props.showLabel as boolean) ?? true
  const label = (props.label as string) ?? ""
  const secondaryColor = (props.secondaryColor as string) ?? ""
  const tickCount = (props.tickCount as number) ?? 20

  const set = (key: string, value: unknown) =>
    updateWidget(widget.id, { props: { ...props, [key]: value } })

  return (
    <div className="space-y-4">
      {/* Variant picker */}
      <div>
        <div className="label mb-2">Estilo do velocímetro</div>
        <div className="grid grid-cols-3 gap-1.5">
          {SPEEDOMETER_VARIANTS.map((v) => (
            <button
              key={v.id}
              onClick={() => set("variant", v.id)}
              title={v.description}
              className={`px-1.5 py-2 rounded-lg text-[10px] font-medium transition-all ${
                currentVariant === v.id
                  ? "bg-accent/20 text-accent border border-accent/40"
                  : "bg-surface-200 text-white/45 border border-transparent hover:text-white/80 hover:bg-surface-300"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* Speed settings */}
      <div>
        <div className="label mb-2">Velocidade</div>
        <div className="space-y-2">
          {/* Max speed */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 w-20 shrink-0">Máximo</span>
            <input
              type="number"
              value={maxSpeed}
              min={50} max={500} step={10}
              onChange={(e) => set("maxSpeed", parseInt(e.target.value) || 200)}
              className="flex-1 bg-surface-200 border border-white/[0.08] rounded px-2 py-1 text-xs text-white/80 font-mono focus:outline-none focus:border-accent/40 text-right"
            />
            <span className="text-[10px] text-white/30">{unit}</span>
          </div>

          {/* Preset max speeds */}
          <div className="flex gap-1.5 flex-wrap">
            {[80, 120, 160, 200, 260, 320].map((v) => (
              <button key={v}
                onClick={() => set("maxSpeed", v)}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  maxSpeed === v ? "bg-accent/20 text-accent" : "bg-surface-200 text-white/35 hover:text-white/70"
                }`}
              >{v}</button>
            ))}
          </div>

          {/* Unit */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 w-20 shrink-0">Unidade</span>
            <div className="flex gap-1 flex-1">
              {(["kmh", "mph", "ms", "knots"] as const).map((u) => (
                <button key={u}
                  onClick={() => set("unit", u)}
                  className={`flex-1 py-1 rounded text-[10px] transition-colors ${
                    unit === u ? "bg-accent/20 text-accent border border-accent/30" : "bg-surface-200 text-white/40 hover:text-white/70"
                  }`}
                >{u}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Divider />

      {/* Color settings */}
      <div>
        <div className="label mb-2">Cores</div>
        <div className="space-y-2">
          <ColorRow
            label="Principal"
            value={widget.style?.accentColor ?? "#00ff88"}
            onChange={(v) => updateWidget(widget.id, { style: { theme: "dark", ...widget.style, accentColor: v } })}
          />
          <ColorRow
            label="Secundária"
            value={secondaryColor || "#ff4444"}
            onChange={(v) => set("secondaryColor", v)}
          />

          {/* Preset palettes */}
          <div className="flex gap-1.5 flex-wrap mt-1">
            {SPEEDOMETER_PALETTES.map((pal) => (
              <button key={pal.name}
                title={pal.name}
                onClick={() => {
                  updateWidget(widget.id, { style: { theme: "dark", ...widget.style, accentColor: pal.primary } })
                  set("secondaryColor", pal.secondary)
                }}
                className="flex gap-0.5 p-1 rounded-md hover:bg-white/[0.06] transition-colors"
              >
                <div style={{ width: 12, height: 12, borderRadius: 3, background: pal.primary }} />
                <div style={{ width: 12, height: 12, borderRadius: 3, background: pal.secondary }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <Divider />

      {/* Display options */}
      <div>
        <div className="label mb-2">Exibição</div>
        <div className="space-y-2">
          <ToggleRow label="Mostrar unidade" value={showUnit} onChange={(v) => set("showUnit", v)} />
          <ToggleRow label="Mostrar máximo" value={showMax} onChange={(v) => set("showMax", v)} />
          <ToggleRow label="Mostrar label" value={showLabel} onChange={(v) => set("showLabel", v)} />
          {showLabel && (
            <div className="flex items-center gap-2 pl-4">
              <span className="text-[10px] text-white/40 w-16 shrink-0">Texto</span>
              <input
                type="text"
                value={label}
                placeholder="SPD"
                onChange={(e) => set("label", e.target.value)}
                className="flex-1 bg-surface-200 border border-white/[0.08] rounded px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-accent/40"
              />
            </div>
          )}
          {(currentVariant === "radial" || currentVariant === "bars" || currentVariant === "hud") && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 w-20 shrink-0">Marcações</span>
              <input
                type="range" min={5} max={40} step={1} value={tickCount}
                onChange={(e) => set("tickCount", parseInt(e.target.value))}
                className="flex-1 accent-accent"
              />
              <span className="text-[10px] text-white/40 w-6 text-right font-mono">{tickCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const SPEEDOMETER_PALETTES = [
  { name: "GoPro Green",   primary: "#00ff88", secondary: "#ff4444" },
  { name: "Electric Blue", primary: "#1EAEFD", secondary: "#ff8800" },
  { name: "Racing Red",    primary: "#ff3300", secondary: "#ffcc00" },
  { name: "Neon Purple",   primary: "#cc44ff", secondary: "#44ffcc" },
  { name: "Gold",          primary: "#ffcc00", secondary: "#ff6600" },
  { name: "Ice",           primary: "#88ddff", secondary: "#ffffff" },
  { name: "Coral",         primary: "#ff6655", secondary: "#ffaa44" },
  { name: "Cyber",         primary: "#00ffff", secondary: "#ff00aa" },
]

function Divider() {
  return <div className="h-px bg-white/[0.06]" />
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-20 shrink-0">{label}</span>
      <input type="color" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded-md cursor-pointer border border-white/[0.08] bg-transparent"
      />
      <input type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-surface-200 border border-white/[0.08] rounded px-2 py-1 text-xs text-white/60 font-mono focus:outline-none focus:border-accent/40"
      />
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-white/40">{label}</span>
      <button onClick={() => onChange(!value)}
        className={`w-8 h-4 rounded-full transition-colors relative ${value ? "bg-accent" : "bg-white/10"}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </div>
  )
}
