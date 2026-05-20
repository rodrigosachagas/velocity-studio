import { useProjectStore } from "@/store/useProjectStore"
import { Icon } from "@/components/ui/Icon"
import { SpeedometerInspector } from "./SpeedometerInspector"
import { CircuitMapInspector } from "./CircuitMapInspector"
import { LapTimerInspector } from "./LapTimerInspector"
import type { WidgetConfig } from "@velocity/shared"

export function RightPanel() {
  const selectedIds = useProjectStore((s) => s.selectedWidgetIds)
  const project = useProjectStore((s) => s.project)
  const updateWidget = useProjectStore((s) => s.updateWidget)
  const duplicateWidget = useProjectStore((s) => s.duplicateWidget)
  const removeWidget = useProjectStore((s) => s.removeWidget)

  const selectedWidget =
    selectedIds.length === 1
      ? project?.widgets.find((w) => w.id === selectedIds[0])
      : null

  if (!selectedWidget) {
    return (
      <div className="flex flex-col h-full p-3">
        <div className="label mb-4">Inspector</div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/25 text-xs text-center leading-relaxed">
            Select a widget
            <br />
            to edit its properties
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-white/[0.07] flex items-center justify-between">
        <div>
          <div className="label">Inspector</div>
          <div className="text-xs font-medium text-white/70 mt-0.5 capitalize">
            {selectedWidget.type}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => duplicateWidget(selectedWidget.id)}
            className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/40 hover:text-white/80 transition-colors"
            title="Duplicate"
          >
            <Icon name="layers" size={12} />
          </button>
          <button
            onClick={() => removeWidget(selectedWidget.id)}
            className="p-1.5 rounded-md hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Icon name="trash" size={12} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-4">
        {selectedWidget.type === "speedometer" && (
          <>
            <SpeedometerInspector widget={selectedWidget} />
            <div className="h-px bg-white/[0.06]" />
          </>
        )}
        {selectedWidget.type === "circuit-map" && (
          <>
            <CircuitMapInspector widget={selectedWidget} />
            <div className="h-px bg-white/[0.06]" />
          </>
        )}
        {selectedWidget.type === "lap-timer" && (
          <>
            <LapTimerInspector widget={selectedWidget} />
            <div className="h-px bg-white/[0.06]" />
          </>
        )}
        <PositionSection widget={selectedWidget} onUpdate={updateWidget} />
        <SizeSection widget={selectedWidget} onUpdate={updateWidget} />
        <AppearanceSection widget={selectedWidget} onUpdate={updateWidget} />
        {selectedWidget.type !== "speedometer" && selectedWidget.type !== "circuit-map" && (
          <StyleSection widget={selectedWidget} onUpdate={updateWidget} />
        )}
      </div>
    </div>
  )
}

function PositionSection({
  widget,
  onUpdate,
}: {
  widget: WidgetConfig
  onUpdate: (id: string, u: Partial<WidgetConfig>) => void
}) {
  return (
    <Section title="Position">
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="X"
          value={Math.round(widget.x)}
          onChange={(v) => onUpdate(widget.id, { x: v })}
        />
        <NumberField
          label="Y"
          value={Math.round(widget.y)}
          onChange={(v) => onUpdate(widget.id, { y: v })}
        />
      </div>
    </Section>
  )
}

function SizeSection({
  widget,
  onUpdate,
}: {
  widget: WidgetConfig
  onUpdate: (id: string, u: Partial<WidgetConfig>) => void
}) {
  return (
    <Section title="Size">
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="W"
          value={Math.round(widget.width)}
          onChange={(v) => onUpdate(widget.id, { width: Math.max(20, v) })}
        />
        <NumberField
          label="H"
          value={Math.round(widget.height)}
          onChange={(v) => onUpdate(widget.id, { height: Math.max(20, v) })}
        />
      </div>
      <NumberField
        label="Rotation"
        value={Math.round(widget.rotation)}
        onChange={(v) => onUpdate(widget.id, { rotation: v })}
        unit="°"
      />
    </Section>
  )
}

function AppearanceSection({
  widget,
  onUpdate,
}: {
  widget: WidgetConfig
  onUpdate: (id: string, u: Partial<WidgetConfig>) => void
}) {
  return (
    <Section title="Appearance">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="label">Opacity</span>
          <span className="text-xs text-white/50 font-mono">{Math.round(widget.opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={widget.opacity}
          onChange={(e) => onUpdate(widget.id, { opacity: parseFloat(e.target.value) })}
          className="w-full accent-accent"
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="label">Visible</span>
        <Toggle
          value={widget.visible}
          onChange={(v) => onUpdate(widget.id, { visible: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="label">Locked</span>
        <Toggle
          value={widget.locked}
          onChange={(v) => onUpdate(widget.id, { locked: v })}
        />
      </div>
    </Section>
  )
}

function StyleSection({
  widget,
  onUpdate,
}: {
  widget: WidgetConfig
  onUpdate: (id: string, u: Partial<WidgetConfig>) => void
}) {
  const themes = ["dark", "light", "glass", "minimal"] as const

  return (
    <Section title="Style">
      <div className="space-y-2">
        <div className="label">Theme</div>
        <div className="flex gap-1">
          {themes.map((t) => (
            <button
              key={t}
              onClick={() => onUpdate(widget.id, { style: { ...widget.style, theme: t } as NonNullable<WidgetConfig["style"]> })}
              className={`flex-1 py-1 rounded text-[10px] capitalize transition-colors ${
                widget.style?.theme === t
                  ? "bg-accent/20 text-accent border border-accent/40"
                  : "bg-white/[0.04] text-white/40 hover:text-white/70 border border-transparent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 mt-2">
        <div className="label">Accent Color</div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={widget.style?.accentColor ?? "#00ff88"}
            onChange={(e) =>
              onUpdate(widget.id, { style: { theme: "dark", ...widget.style, accentColor: e.target.value } })
            }
            className="w-8 h-8 rounded cursor-pointer border border-white/10 bg-transparent"
          />
          <input
            type="text"
            value={widget.style?.accentColor ?? "#00ff88"}
            onChange={(e) =>
              onUpdate(widget.id, { style: { theme: "dark", ...widget.style, accentColor: e.target.value } })
            }
            className="flex-1 bg-surface-200 border border-white/[0.08] rounded px-2 py-1 text-xs text-white/70 font-mono focus:outline-none focus:border-accent/40"
          />
        </div>
      </div>
    </Section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  unit?: string
}) {
  return (
    <div className="flex items-center gap-1.5 bg-surface-200 border border-white/[0.08] rounded-md px-2 py-1 focus-within:border-accent/30">
      <span className="text-[10px] text-white/35 font-medium w-4 shrink-0">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="flex-1 bg-transparent text-xs text-white/80 font-mono text-right focus:outline-none min-w-0"
      />
      {unit && <span className="text-[10px] text-white/30">{unit}</span>}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-8 h-4 rounded-full transition-colors relative ${value ? "bg-accent" : "bg-white/10"}`}
    >
      <div
        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`}
      />
    </button>
  )
}
