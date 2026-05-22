import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useAppStore } from "./store/useAppStore"
import { useProjectStore } from "./store/useProjectStore"
import { WelcomeScreen } from "./pages/WelcomeScreen"
import { EditorScreen } from "./pages/EditorScreen"
import { TitleBar } from "./components/ui/TitleBar"
import { registerDefaultWidgets } from "@velocity/widgets"

registerDefaultWidgets()

export function App() {
  const view = useAppStore((s) => s.view)
  const createProject = useProjectStore((s) => s.createProject)
  const project = useProjectStore((s) => s.project)

  // Auto-create a project on first load so the editor is ready immediately.
  useEffect(() => {
    if (!project) createProject()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // keyboard shortcuts
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault()
        createProject()
        useAppStore.getState().setView("editor")
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        useProjectStore.getState().saveProject()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [createProject])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface">
      <TitleBar />
      <AnimatePresence mode="wait">
        {view === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden"
          >
            <WelcomeScreen />
          </motion.div>
        )}
        {view === "editor" && (
          <motion.div
            key="editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden"
          >
            <EditorScreen />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
