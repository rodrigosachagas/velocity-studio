import { create } from "zustand"

export type AppView = "welcome" | "editor" | "export"
export type PanelSection = "layers" | "inspector" | "templates" | "widgets"

interface AppStore {
  view: AppView
  activePanel: PanelSection
  isRendering: boolean
  renderProgress: number
  renderError: string | null
  showGrid: boolean
  showGuides: boolean
  zoom: number

  setView: (view: AppView) => void
  setActivePanel: (panel: PanelSection) => void
  setRendering: (rendering: boolean) => void
  setRenderProgress: (progress: number) => void
  setRenderError: (error: string | null) => void
  toggleGrid: () => void
  toggleGuides: () => void
  setZoom: (zoom: number) => void
}

export const useAppStore = create<AppStore>((set) => ({
  view: "welcome",
  activePanel: "widgets",
  isRendering: false,
  renderProgress: 0,
  renderError: null,
  showGrid: false,
  showGuides: true,
  zoom: 1,

  setView: (view) => set({ view }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setRendering: (isRendering) => set({ isRendering }),
  setRenderProgress: (renderProgress) => set({ renderProgress }),
  setRenderError: (renderError) => set({ renderError }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),
  setZoom: (zoom) => set({ zoom }),
}))
