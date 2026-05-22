import { create } from "zustand"

export type AppView = "welcome" | "editor" | "export"
export type PanelSection = "layers" | "inspector" | "templates" | "widgets" | "telemetry"

interface AppStore {
  view: AppView
  activePanel: PanelSection
  isRendering: boolean
  renderProgress: number
  renderError: string | null
  showGrid: boolean
  showGuides: boolean
  zoom: number
  /** Current video playback position in seconds — updated directly by VideoPreview via RAF */
  videoCurrentTime: number
  /** Measured CSS pixel dimensions of the canvas preview frame (the inner scaled div) */
  canvasSize: { width: number; height: number } | null
  /** Whether the user is in "click to set start/finish line" mode */
  isPickingStartFinish: boolean

  setView: (view: AppView) => void
  setActivePanel: (panel: PanelSection) => void
  setRendering: (rendering: boolean) => void
  setRenderProgress: (progress: number) => void
  setRenderError: (error: string | null) => void
  toggleGrid: () => void
  toggleGuides: () => void
  setZoom: (zoom: number) => void
  setVideoCurrentTime: (t: number) => void
  setCanvasSize: (size: { width: number; height: number }) => void
  setPickingStartFinish: (v: boolean) => void
}

export const useAppStore = create<AppStore>((set) => ({
  view: "editor",
  activePanel: "widgets",
  isRendering: false,
  renderProgress: 0,
  renderError: null,
  showGrid: false,
  showGuides: true,
  zoom: 1,
  videoCurrentTime: 0,
  canvasSize: null,
  isPickingStartFinish: false,

  setView: (view) => set({ view }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setRendering: (isRendering) => set({ isRendering }),
  setRenderProgress: (renderProgress) => set({ renderProgress }),
  setRenderError: (renderError) => set({ renderError }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),
  setZoom: (zoom) => set({ zoom }),
  setVideoCurrentTime: (videoCurrentTime) => set({ videoCurrentTime }),
  setCanvasSize: (canvasSize) => set({ canvasSize }),
  setPickingStartFinish: (isPickingStartFinish) => set({ isPickingStartFinish }),
}))
