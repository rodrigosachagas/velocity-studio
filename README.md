# Velocity Studio

Desktop app for creating professional GoPro telemetry overlays — speed, GPS map, G-force, altitude, lap timing and more — exported directly over your video footage.

Built with Tauri v2, React 19, TypeScript and Framer Motion.

![Velocity Studio](https://img.shields.io/badge/version-0.1.0-blue) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

### Telemetry Widgets
| Widget | Description |
|--------|-------------|
| **Speedometer** | 17+ variants: classic arc, digital, HUD, LED bars, tape, analog, redline, glow, notched, step-blocks, numerals, and more |
| **Circuit Map** | GPS track with animated car dot, gradient (speed heatmap) or circuit style with zebra curb markers |
| **Lap Timer** | Lap number, elapsed time, last/best lap, configurable history (0–10 laps) |
| **G-Force** | 2D ball indicator with lateral and longitudinal display |
| **Compass** | Animated heading compass |
| **Altitude** | Current altitude display |
| **Timer** | Video elapsed time |

### Editor
- Drag-and-drop widget placement on a scaled video canvas
- Resize handles, rotation, opacity, lock/visibility per widget
- Right-panel inspector with widget-specific controls (colors, sizes, styles)
- Inline delete/duplicate on selected widgets
- Theme support: dark, light, glass, minimal

### Lap Timing System
- Click-to-set start/finish line directly on the GPS map
- Direction-aware crossing detection (prevents reverse-direction false laps)
- Per-lap history with delta to best lap
- Best-lap circuit trace in circuit map style

### Export
- Frame-by-frame HTML→canvas capture with FFmpeg encoding
- Codecs: H.264, H.265, ProRes
- Configurable CRF quality
- Test export (5% of video) for quick preview

---

## Tech Stack

```
velocity-studio/
├── apps/
│   └── desktop/          # Tauri v2 app (React frontend + Rust backend)
│       └── src-tauri/    # Rust: video commands, GPMF telemetry, FFmpeg export
└── packages/
    ├── shared/           # Types, utilities, lap computation
    ├── telemetry/        # GPMF/GPS extractors, normalizers
    ├── widgets/          # All React widget components
    ├── templates/        # Preset widget layouts
    └── timeline/         # Timeline utilities
```

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Zustand, dnd-kit  
**Backend:** Rust, Tauri v2, FFmpeg (via CLI)  
**Build:** pnpm workspaces, Turborepo

---

## Requirements

- Node.js ≥ 20
- pnpm ≥ 9
- Rust (stable) — [rustup.rs](https://rustup.rs)
- FFmpeg — must be available in `PATH`
- macOS 13+ or Windows 10+

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Run in development
pnpm desktop

# Build for production
pnpm build
```

The Tauri desktop app opens automatically. On first run, import a GoPro MP4 file — telemetry (GPMF/GPS) is extracted automatically.

---

## GoPro Compatibility

Tested with GoPro Hero 9, 10, 11, 12 footage containing GPMF telemetry streams (GPS5, ACCL, GYRO, CORI). Files must have GPS enabled during recording.

---

## Roadmap

- [ ] Multi-file sequential GoPro support (logical concatenation)
- [ ] Additional widget types (throttle, brake, RPM)
- [ ] Custom widget positioning presets / templates
- [ ] Windows installer
- [ ] GPX file import

---

## License

MIT
