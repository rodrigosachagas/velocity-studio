import { create } from "zustand"
import { subscribeWithSelector, devtools } from "zustand/middleware"
import type { Project, VideoFile, TelemetryTrack, WidgetConfig, Template } from "@velocity/shared"
import { nanoid } from "@velocity/shared"

interface ProjectStore {
  project: Project | null
  isDirty: boolean
  selectedWidgetIds: string[]

  createProject: (name?: string) => void
  loadProject: (project: Project) => void
  saveProject: () => void

  setVideo: (video: VideoFile) => void
  clearVideo: () => void

  setTelemetry: (track: TelemetryTrack) => void
  clearTelemetry: () => void

  addWidget: (config: Omit<WidgetConfig, "id">) => WidgetConfig
  updateWidget: (id: string, updates: Partial<WidgetConfig>) => void
  removeWidget: (id: string) => void
  duplicateWidget: (id: string) => WidgetConfig | null
  reorderWidgets: (ids: string[]) => void

  selectWidget: (id: string, multi?: boolean) => void
  deselectAll: () => void

  applyTemplate: (template: Template) => void

  setTimelineDuration: (duration: number) => void
}

const defaultTimeline = () => ({
  duration: 0,
  currentTime: 0,
  playbackRate: 1,
  isPlaying: false,
  zoomLevel: 1,
  scrollOffset: 0,
  layers: [],
  snapEnabled: true,
  snapThreshold: 0.1,
})

export const useProjectStore = create<ProjectStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      project: null,
      isDirty: false,
      selectedWidgetIds: [],

      createProject: (name = "Untitled Project") => {
        const project: Project = {
          id: nanoid("proj_"),
          name,
          version: "1.0.0",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          widgets: [],
          timeline: defaultTimeline(),
        }
        set({ project, isDirty: false, selectedWidgetIds: [] })
      },

      loadProject: (project) => set({ project, isDirty: false, selectedWidgetIds: [] }),

      saveProject: () => {
        const { project } = get()
        if (!project) return
        const updated = { ...project, updatedAt: new Date().toISOString() }
        set({ project: updated, isDirty: false })
        localStorage.setItem(`velocity_project_${project.id}`, JSON.stringify(updated))
      },

      setVideo: (video) => {
        set((s) => ({
          project: s.project
            ? {
                ...s.project,
                video: video.metadata,
                timeline: { ...s.project.timeline, duration: video.metadata.duration },
              }
            : null,
          isDirty: true,
        }))
      },

      clearVideo: () =>
        set((s) => ({
          project: s.project ? { ...s.project, video: undefined } : null,
          isDirty: true,
        })),

      setTelemetry: (track) =>
        set((s) => ({
          project: s.project ? { ...s.project, telemetry: track } : null,
          isDirty: true,
        })),

      clearTelemetry: () =>
        set((s) => ({
          project: s.project ? { ...s.project, telemetry: undefined } : null,
          isDirty: true,
        })),

      addWidget: (config) => {
        const widget: WidgetConfig = { id: nanoid("widget_"), ...config }
        set((s) => ({
          project: s.project
            ? { ...s.project, widgets: [...s.project.widgets, widget] }
            : null,
          isDirty: true,
          selectedWidgetIds: [widget.id],
        }))
        return widget
      },

      updateWidget: (id, updates) =>
        set((s) => ({
          project: s.project
            ? {
                ...s.project,
                widgets: s.project.widgets.map((w) =>
                  w.id === id ? { ...w, ...updates } : w
                ),
              }
            : null,
          isDirty: true,
        })),

      removeWidget: (id) =>
        set((s) => ({
          project: s.project
            ? { ...s.project, widgets: s.project.widgets.filter((w) => w.id !== id) }
            : null,
          isDirty: true,
          selectedWidgetIds: s.selectedWidgetIds.filter((wid) => wid !== id),
        })),

      duplicateWidget: (id) => {
        const { project } = get()
        const widget = project?.widgets.find((w) => w.id === id)
        if (!widget) return null
        const dup: WidgetConfig = {
          ...widget,
          id: nanoid("widget_"),
          x: widget.x + 20,
          y: widget.y + 20,
        }
        set((s) => ({
          project: s.project
            ? { ...s.project, widgets: [...s.project.widgets, dup] }
            : null,
          isDirty: true,
          selectedWidgetIds: [dup.id],
        }))
        return dup
      },

      reorderWidgets: (ids) =>
        set((s) => {
          if (!s.project) return {}
          const widgetMap = new Map(s.project.widgets.map((w) => [w.id, w]))
          const reordered = ids.map((id) => widgetMap.get(id)).filter(Boolean) as WidgetConfig[]
          return { project: { ...s.project, widgets: reordered }, isDirty: true }
        }),

      selectWidget: (id, multi = false) =>
        set((s) => ({
          selectedWidgetIds: multi
            ? s.selectedWidgetIds.includes(id)
              ? s.selectedWidgetIds.filter((i) => i !== id)
              : [...s.selectedWidgetIds, id]
            : [id],
        })),

      deselectAll: () => set({ selectedWidgetIds: [] }),

      applyTemplate: (template) =>
        set((s) => ({
          project: s.project
            ? {
                ...s.project,
                widgets: template.widgets,
                templateId: template.id,
              }
            : null,
          isDirty: true,
          selectedWidgetIds: [],
        })),

      setTimelineDuration: (duration) =>
        set((s) => ({
          project: s.project
            ? { ...s.project, timeline: { ...s.project.timeline, duration } }
            : null,
        })),
    })),
    { name: "velocity-project" }
  )
)
