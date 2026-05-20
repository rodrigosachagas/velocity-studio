import { createContext, useContext, type ReactNode } from "react"

const ExportModeContext = createContext(false)

export function ExportModeProvider({ children }: { children: ReactNode }) {
  return <ExportModeContext.Provider value={true}>{children}</ExportModeContext.Provider>
}

export function useExportMode() {
  return useContext(ExportModeContext)
}
