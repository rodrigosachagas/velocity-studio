import { useCallback, useRef } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import type { WidgetConfig } from "@velocity/shared"

type HandlePosition = "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w"

const HANDLE_CURSORS: Record<HandlePosition, string> = {
  nw: "nw-resize",
  n: "n-resize",
  ne: "ne-resize",
  e: "e-resize",
  se: "se-resize",
  s: "s-resize",
  sw: "sw-resize",
  w: "w-resize",
}

interface ResizeHandleProps {
  widgetId: string
  widget: WidgetConfig
}

export function ResizeHandle({ widgetId, widget }: ResizeHandleProps) {
  const updateWidget = useProjectStore((s) => s.updateWidget)
  const startRef = useRef<{ mouseX: number; mouseY: number; width: number; height: number; x: number; y: number } | null>(null)

  const onMouseDown = useCallback(
    (e: React.MouseEvent, position: HandlePosition) => {
      e.preventDefault()
      e.stopPropagation()

      startRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        width: widget.width,
        height: widget.height,
        x: widget.x,
        y: widget.y,
      }

      const onMouseMove = (ev: MouseEvent) => {
        if (!startRef.current) return
        const dx = ev.clientX - startRef.current.mouseX
        const dy = ev.clientY - startRef.current.mouseY

        const minSize = 40

        const updates: Partial<WidgetConfig> = {}

        if (position.includes("e")) updates.width = Math.max(minSize, startRef.current.width + dx)
        if (position.includes("s")) updates.height = Math.max(minSize, startRef.current.height + dy)
        if (position.includes("w")) {
          updates.width = Math.max(minSize, startRef.current.width - dx)
          updates.x = startRef.current.x + startRef.current.width - (updates.width ?? widget.width)
        }
        if (position.includes("n")) {
          updates.height = Math.max(minSize, startRef.current.height - dy)
          updates.y = startRef.current.y + startRef.current.height - (updates.height ?? widget.height)
        }

        updateWidget(widgetId, updates)
      }

      const onMouseUp = () => {
        startRef.current = null
        window.removeEventListener("mousemove", onMouseMove)
        window.removeEventListener("mouseup", onMouseUp)
      }

      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
    },
    [widget, widgetId, updateWidget]
  )

  const handles: HandlePosition[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

  return (
    <>
      {handles.map((pos) => {
        const isCorner = pos.length === 2
        const style: React.CSSProperties = {
          position: "absolute",
          width: isCorner ? 8 : 6,
          height: isCorner ? 8 : 6,
          background: "#00ff88",
          border: "1.5px solid rgba(0,0,0,0.5)",
          borderRadius: 2,
          cursor: HANDLE_CURSORS[pos],
          zIndex: 10000,
          ...(pos.includes("n") ? { top: -4 } : pos.includes("s") ? { bottom: -4 } : { top: "50%", transform: "translateY(-50%)" }),
          ...(pos.includes("w") ? { left: -4 } : pos.includes("e") ? { right: -4 } : { left: "50%", transform: pos.includes("n") || pos.includes("s") ? "translateX(-50%)" : "translateY(-50%)" }),
        }

        return (
          <div
            key={pos}
            style={style}
            onMouseDown={(e) => onMouseDown(e, pos)}
          />
        )
      })}
    </>
  )
}
