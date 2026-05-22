# Velocity Studio

Desktop app for creating professional GoPro telemetry overlays — speed, GPS map, G-force, altitude, lap timing and more — exported directly over your video footage.

Built with Tauri v2, React 19, TypeScript and Framer Motion.

![Velocity Studio](https://img.shields.io/badge/version-0.1.0-blue) ![Platform](https://img.shields.io/badge/platform-macOS-lightgrey) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

### Telemetry Widgets
| Widget | Description |
|--------|-------------|
| **Speedometer** | 17+ variants: classic arc, digital, HUD, LED bars, tape, analog, redline, glow, notched, step-blocks, numerals, neon, split, and more |
| **Circuit Map** | GPS track with animated car dot; gradient (speed heatmap) or circuit style (consensus track from all laps, zebra curb markers, checkered S/F flag) |
| **Lap Timer** | Lap number, elapsed time, last/best lap, configurable history list (0–30 laps) with delta to best |
| **G-Force** | 2D ball indicator with lateral + longitudinal axes (GoPro ACCL mapping) |
| **Compass** | Animated heading needle with shortest-path rotation |
| **Altitude** | Current altitude with unit toggle (m / ft) |
| **Timer** | Video elapsed timecode |

### Editor
- Drag-and-drop widget placement on a scaled video canvas
- Resize handles, rotation, opacity, lock/visibility per widget
- Right-panel inspector with widget-specific controls (colors, sizes, styles, variants)
- Inline delete/duplicate on selected widget
- Grid and guide toggles with zoom control
- Theme support per widget: dark, light, glass, minimal

### Multi-Segment GoPro Support
- Automatically detects and joins split files (GH011233 → GH021233 → …)
- FFmpeg concat demuxer: seamless multi-file encoding without re-encoding
- Trim in/out points work across segment boundaries

### Lap Timing System
- Click-to-set start/finish line on the GPS circuit map
- **Direction-aware crossing detection** — only counts crossings in the same direction as the first lap (prevents reverse-direction false positives)
- Consensus track: arc-length resampling + median across all laps gives accurate circuit geometry
- Per-lap history with Δ to best lap

### Export
- **Image2pipe streaming** — FFmpeg starts immediately and encodes concurrently while JS renders frames; no frames ever accumulate on disk
- **Zero disk writes for frame data** — PNG bytes go JS → base64 IPC → Rust memory → FFmpeg stdin; only the final video file touches storage
- **Hardware acceleration** — H.264 uses `h264_videotoolbox` on Apple Silicon (10-20× faster than software); automatic fallback to `libx264`
- Codecs: H.264 (hardware), H.265 (libx265), ProRes (prores_ks)
- Configurable CRF quality presets (social / high / max)
- Output FPS selector (native, 24, 30, 60)
- Test export mode (renders 5% of video for quick preview)
- Screen wake lock during export (prevents RAF suspension on screen sleep)
- Per-frame error recovery: if a single frame fails capture, the previous frame is reused so the export always completes

---

## Tech Stack

```
velocity-studio/
├── apps/
│   └── desktop/              # Tauri v2 app (React frontend + Rust backend)
│       ├── src/              # React: editor, widgets canvas, export modal
│       └── src-tauri/        # Rust: video probe, GPMF telemetry, FFmpeg export pipeline
└── packages/
    ├── shared/               # Types, units, interpolation, lap computation, segments
    ├── telemetry/            # GPMF/GPS extractors and normalizers
    ├── widgets/              # All React widget components (export-mode aware)
    ├── templates/            # Preset widget layout definitions
    └── timeline/             # Timeline utilities
```

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Zustand, dnd-kit  
**Backend:** Rust, Tauri v2, FFmpeg (CLI), tokio async runtime  
**Build:** pnpm workspaces, Turborepo

---

## Requirements

- Node.js ≥ 20
- pnpm ≥ 9
- Rust (stable) — [rustup.rs](https://rustup.rs)
- FFmpeg — must be available in `PATH`
- macOS 13+ (Apple Silicon recommended for hardware-accelerated H.264)

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Run in development (opens Tauri window with hot reload)
pnpm desktop

# Build for production
pnpm build
```

On first run, import a GoPro MP4 file — GPMF telemetry (GPS, accelerometer, gyroscope) is extracted automatically. Multi-segment recordings are detected automatically if the split files are in the same directory.

---

## GoPro Compatibility

Tested with GoPro Hero 9, 10, 11, 12 footage containing GPMF telemetry streams (GPS5, ACCL, GYRO, CORI). GPS must be enabled during recording. Files do not need to be joined before import — Velocity Studio handles multi-segment recordings natively.

---

## Export Architecture

Frames are captured with `html-to-image` → `toCanvas` at the video's native resolution, converted to PNG, base64-encoded, and streamed directly to a Rust command that pipes them to FFmpeg's stdin via `image2pipe`. This eliminates all temporary file I/O for frame data.

```
JS (toCanvas) → PNG bytes → btoa() → invoke("pipe_frame_base64") → Rust → FFmpeg stdin
```

FFmpeg encodes concurrently while frames are still being rendered, so the total export time approaches `max(render_time, encode_time)` rather than their sum.

---

## Roadmap

- [x] Multi-file sequential GoPro support
- [x] Direction-aware lap detection
- [x] Lap history widget
- [x] Hardware H.264 encoding (VideoToolbox)
- [x] Zero-disk-write export pipeline
- [ ] Additional widget types (throttle, brake, RPM, lean angle)
- [ ] Custom widget presets / save layouts
- [ ] Windows support
- [ ] GPX file import

---

## License

MIT
