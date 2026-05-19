import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppStore, type PanelSection } from "@/store/useAppStore"
import { useProjectStore } from "@/store/useProjectStore"
import { getAllWidgets } from "@velocity/widgets"
import { ALL_TEMPLATES } from "@velocity/templates"
import { Icon } from "@/components/ui/Icon"
import { VideoImportPanel } from "./VideoImportPanel"

const PANEL_TABS: { id: PanelSection; label: string; icon: string }[] = [
  { id: "widgets", label: "Widgets", icon: "layers" },
  { id: "layers", label: "Layers", icon: "eye" },
  { id: "templates", label: "Templates", icon: "template" },
]

export function LeftPanel() {
  const activePanel = useAppStore((s) => s.activePanel)
  const setActivePanel = useAppStore((s) => s.setActivePanel)

  return (
    <div className="flex flex-col h-full">
      {/* Video import */}
      <VideoImportPanel />
      <div className="h-px bg-white/[0.07]" />

      {/* Tabs */}
      <div className="flex border-b border-white/[0.07]">
        {PANEL_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
              activePanel === tab.id
                ? "text-accent border-b border-accent"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activePanel === "widgets" && <WidgetsPanelContent key="widgets" />}
          {activePanel === "layers" && <LayersPanelContent key="layers" />}
          {activePanel === "templates" && <TemplatesPanelContent key="templates" />}
        </AnimatePresence>
      </div>
    </div>
  )
}

function WidgetsPanelContent() {
  const addWidget = useProjectStore((s) => s.addWidget)
  const allWidgets = getAllWidgets()

  const categories = ["telemetry", "navigation", "timing", "media"] as const
  const [expanded, setExpanded] = useState<string>("telemetry")

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className="p-2"
    >
      {categories.map((cat) => {
        const widgets = allWidgets.filter((w) => w.meta.category === cat)
        if (widgets.length === 0) return null

        return (
          <div key={cat} className="mb-1">
            <button
              onClick={() => setExpanded(expanded === cat ? "" : cat)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-widest hover:text-white/60 transition-colors"
            >
              {cat}
              <Icon
                name="chevron_right"
                size={12}
                className={`transition-transform ${expanded === cat ? "rotate-90" : ""}`}
              />
            </button>
            <AnimatePresence>
              {expanded === cat && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden grid grid-cols-2 gap-1.5 px-1 pb-2"
                >
                  {widgets.map((w) => (
                    <button
                      key={w.meta.type}
                      onClick={() =>
                        addWidget({
                          type: w.meta.type,
                          x: 40,
                          y: 40,
                          width: w.meta.defaultSize.width,
                          height: w.meta.defaultSize.height,
                          rotation: 0,
                          scale: 1,
                          opacity: 1,
                          zIndex: 10,
                          visible: true,
                          locked: false,
                          animationIn: "fade",
                          animationOut: "fade",
                          ...w.meta.defaultConfig,
                        })
                      }
                      className="group flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-surface-100 hover:bg-surface-200 border border-white/[0.06] hover:border-white/[0.12] transition-all text-center"
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                        <Icon name={w.meta.icon} size={14} className="text-accent/80" />
                      </div>
                      <span className="text-[10px] font-medium text-white/60 group-hover:text-white/90 transition-colors leading-tight">
                        {w.meta.label}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </motion.div>
  )
}

function LayersPanelContent() {
  const project = useProjectStore((s) => s.project)
  const selectedIds = useProjectStore((s) => s.selectedWidgetIds)
  const selectWidget = useProjectStore((s) => s.selectWidget)
  const updateWidget = useProjectStore((s) => s.updateWidget)
  const removeWidget = useProjectStore((s) => s.removeWidget)

  const widgets = [...(project?.widgets ?? [])].reverse()

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className="p-2"
    >
      {widgets.length === 0 ? (
        <div className="text-center py-8 text-white/25 text-xs">
          No widgets yet.
          <br />
          Add from the Widgets tab.
        </div>
      ) : (
        <div className="space-y-0.5">
          {widgets.map((widget) => (
            <div
              key={widget.id}
              className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                selectedIds.includes(widget.id)
                  ? "bg-accent/10 text-accent"
                  : "hover:bg-white/[0.04] text-white/60"
              }`}
              onClick={() => selectWidget(widget.id)}
            >
              <Icon name="layers" size={12} className="shrink-0" />
              <span className="flex-1 text-xs truncate">
                {widget.label ?? widget.type}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    updateWidget(widget.id, { visible: !widget.visible })
                  }}
                  className="p-0.5 hover:text-white transition-colors"
                >
                  <Icon name={widget.visible ? "eye" : "eye-off"} size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeWidget(widget.id)
                  }}
                  className="p-0.5 hover:text-red-400 transition-colors"
                >
                  <Icon name="trash" size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function TemplatesPanelContent() {
  const applyTemplate = useProjectStore((s) => s.applyTemplate)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className="p-2 space-y-1.5"
    >
      {ALL_TEMPLATES.map((template) => (
        <button
          key={template.id}
          onClick={() => applyTemplate(template)}
          className="w-full text-left p-3 rounded-xl bg-surface-100 hover:bg-surface-200 border border-white/[0.06] hover:border-white/[0.12] transition-all group"
        >
          <div className="font-medium text-white/80 text-xs group-hover:text-white transition-colors">
            {template.name}
          </div>
          <div className="text-[10px] text-white/35 mt-0.5 leading-relaxed">
            {template.description}
          </div>
          <div className="flex gap-1 mt-2">
            {template.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 rounded-full bg-white/[0.05] text-[9px] text-white/30">
                {tag}
              </span>
            ))}
          </div>
        </button>
      ))}
    </motion.div>
  )
}
