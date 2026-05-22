import { useCallback, useRef } from "react"
import { useProjectStore } from "@/store/useProjectStore"
import { useAppStore } from "@/store/useAppStore"
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
  scaleX: number
  scaleY: number
}

export function ResizeHandle({ widgetId, widget, scaleX, scaleY }: ResizeHandleProps) {
  const updateWidget = useProjectStore((s) => s.updateWidget)
  const zoom = useAppStore((s) => s.zoom)

  // Refs so the event handler closure always reads the latest values
  // without recreating callbacks on every render.
  const zoomRef = useRef(zoom)
  const scaleXRef = useRef(scaleX)
  const scaleYRef = useRef(scaleY)
  const widgetRef = useRef(widget)
  zoomRef.current = zoom
  scaleXRef.current = scaleX
  scaleYRef.current = scaleY
  widgetRef.current = widget

  const startRef = useRef<{
    pointerX: number
    pointerY: number
    width: number
    height: number
    x: number
    y: number
  } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent, position: HandlePosition) => {
      e.preventDefault()
      // Stop propagation so dnd-kit's pointerdown listener on the parent
      // motion.div is not triggered — prevents drag activating during resize.
      e.stopPropagation()

      const w = widgetRef.current
      startRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        width: w.width,
        height: w.height,
        x: w.x,
        y: w.y,
      }

      const onPointerMove = (ev: PointerEvent) => {
        if (!startRef.current) return
        const sx = scaleXRef.current
        const sy = scaleYRef.current
        const z = zoomRef.current

        // Pointer delta is in screen pixels.
        // ÷ zoom  → canvas CSS pixels (undoing the CSS scale on the canvas div)
        // ÷ scaleX → video pixels (canvas display pixels per video pixel)
        const dx = (ev.clientX - startRef.current.pointerX) / z / sx
        const dy = (ev.clientY - startRef.current.pointerY) / z / sy

        const minW = 40 / sx
        const minH = 40 / sy

        const updates: Partial<WidgetConfig> = {}

        if (position.includes("e")) {
          updates.width = Math.max(minW, startRef.current.width + dx)
        }
        if (position.includes("s")) {
          updates.height = Math.max(minH, startRef.current.height + dy)
        }
        if (position.includes("w")) {
          updates.width = Math.max(minW, startRef.current.width - dx)
          updates.x = startRef.current.x + startRef.current.width - updates.width
        }
        if (position.includes("n")) {
          updates.height = Math.max(minH, startRef.current.height - dy)
          updates.y = startRef.current.y + startRef.current.height - updates.height
        }

        updateWidget(widgetId, updates)
      }

      const onPointerUp = () => {
        startRef.current = null
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", onPointerUp)
      }

      window.addEventListener("pointermove", onPointerMove)
      window.addEventListener("pointerup", onPointerUp)
    },
    [widgetId, updateWidget],
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
          ...(pos.includes("n")
            ? { top: -4 }
            : pos.includes("s")
              ? { bottom: -4 }
              : { top: "50%", transform: "translateY(-50%)" }),
          ...(pos.includes("w")
            ? { left: -4 }
            : pos.includes("e")
              ? { right: -4 }
              : {
                  left: "50%",
                  transform:
                    pos.includes("n") || pos.includes("s")
                      ? "translateX(-50%)"
                      : "translateY(-50%)",
                }),
        }

        return (
          <div
            key={pos}
            style={style}
            onPointerDown={(e) => onPointerDown(e, pos)}
          />
        )
      })}
    </>
  )
}
