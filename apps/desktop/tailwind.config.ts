import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0a0a0a",
          50: "#141414",
          100: "#1a1a1a",
          200: "#222222",
          300: "#2a2a2a",
          400: "#333333",
        },
        accent: {
          DEFAULT: "#00ff88",
          dim: "rgba(0,255,136,0.15)",
          glow: "rgba(0,255,136,0.3)",
        },
        blue: {
          accent: "#4488ff",
        },
        red: {
          accent: "#ff4444",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        mono: ["ui-monospace", "'Cascadia Code'", "'JetBrains Mono'", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 3s linear infinite",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "glow-green": "0 0 20px rgba(0,255,136,0.3)",
        "glow-blue": "0 0 20px rgba(68,136,255,0.3)",
        "elevated": "0 4px 24px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
}

export default config
