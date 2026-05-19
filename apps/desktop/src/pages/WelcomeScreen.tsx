import { motion } from "framer-motion"
import { useAppStore } from "@/store/useAppStore"
import { useProjectStore } from "@/store/useProjectStore"
import { ALL_TEMPLATES } from "@velocity/templates"
import { Icon } from "@/components/ui/Icon"

export function WelcomeScreen() {
  const setView = useAppStore((s) => s.setView)
  const createProject = useProjectStore((s) => s.createProject)
  const applyTemplate = useProjectStore((s) => s.applyTemplate)

  const handleNewProject = () => {
    createProject()
    setView("editor")
  }

  const handleTemplate = (templateId: string) => {
    const template = ALL_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    createProject(template.name)
    applyTemplate(template)
    setView("editor")
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-surface overflow-auto py-12">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <div className="text-[11px] font-bold tracking-[0.4em] text-accent uppercase mb-2">
          Velocity Studio
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Cinematic Telemetry Overlays
        </h1>
        <p className="text-white/40 mt-3 text-sm max-w-md mx-auto leading-relaxed">
          Import your GoPro or action camera footage, extract telemetry, and build
          stunning real-time overlays.
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex gap-3 mb-14"
      >
        <button
          onClick={handleNewProject}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent/90 active:scale-95 transition-all"
        >
          <Icon name="plus" size={16} />
          New Project
        </button>
        <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.06] text-white/70 font-medium text-sm hover:bg-white/[0.1] hover:text-white active:scale-95 transition-all border border-white/[0.08]">
          <Icon name="folder" size={16} />
          Open Project
        </button>
      </motion.div>

      {/* Templates */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full max-w-3xl px-6"
      >
        <div className="label mb-4">Start from a template</div>
        <div className="grid grid-cols-3 gap-3">
          {ALL_TEMPLATES.map((template, i) => (
            <motion.button
              key={template.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.07 }}
              onClick={() => handleTemplate(template.id)}
              className="group relative p-4 rounded-xl bg-surface-100 border border-white/[0.07] hover:border-white/[0.15] hover:bg-surface-200 transition-all text-left"
            >
              {/* Color accent */}
              <div
                className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center"
                style={{
                  backgroundColor: template.style?.primaryColor
                    ? `${template.style.primaryColor}22`
                    : "rgba(0,255,136,0.1)",
                }}
              >
                <Icon
                  name={
                    template.category === "racing"
                      ? "gauge"
                      : template.category === "gopro"
                        ? "video"
                        : "sparkle"
                  }
                  size={16}
                  className="opacity-80"
                />
              </div>

              <div className="font-semibold text-white/90 text-sm mb-1">{template.name}</div>
              <div className="text-xs text-white/40 leading-relaxed">{template.description}</div>

              <div className="flex flex-wrap gap-1 mt-3">
                {template.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.06] text-white/40"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 text-center"
      >
        <p className="text-white/20 text-xs">
          Press{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] font-mono text-[10px] text-white/40">
            ⌘N
          </kbd>{" "}
          to create a new project
        </p>
      </motion.div>
    </div>
  )
}
