import { useEffect } from "react"
import { useProjectStore } from "@/store/useProjectStore"

/**
 * Auto-saves the project to localStorage 2 seconds after any change.
 * Runs once for the lifetime of the app — call it at the root.
 */
export function useAutoSave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = useProjectStore.subscribe(
      (state) => state.isDirty,
      (isDirty) => {
        if (!isDirty) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          useProjectStore.getState().saveProject()
        }, 2_000)
      }
    )

    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [])
}
