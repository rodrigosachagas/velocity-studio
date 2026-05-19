/** Returns true when running inside the Tauri WebView runtime */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

/** Read video metadata from an HTML5 video element (browser fallback) */
export function probeVideoElement(file: File): Promise<{
  duration: number
  width: number
  height: number
  fps: number
  codec: string
  has_gpmf: boolean
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 30, // HTML5 API doesn't expose FPS — default to 30
        codec: file.type,
        has_gpmf: false,
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to read video metadata"))
    }

    video.src = url
  })
}

/** Open a native file picker in browser mode */
export function openBrowserFilePicker(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept

    // Cleanup + resolve after selection or cancel
    const cleanup = () => {
      input.remove()
      window.removeEventListener("focus", onWindowFocus)
    }

    let resolved = false

    // Detect cancel: focus returns to window ~300ms after picker closes
    const onWindowFocus = () => {
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve(null)
        }
      }, 300)
    }

    input.onchange = () => {
      resolved = true
      cleanup()
      resolve(input.files?.[0] ?? null)
    }

    window.addEventListener("focus", onWindowFocus, { once: true })
    document.body.appendChild(input)
    input.click()
  })
}
