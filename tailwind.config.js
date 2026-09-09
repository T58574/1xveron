/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep modern dark zinc/slate (Non-OLED)
        veron: {
          bg: '#121316',
          sidebar: '#16171c',
          card: '#1a1c23',
          cardHeader: '#1e212b',
          border: '#2a2d3d',
          hover: '#252836',
          active: '#2f3447',
          accent: '#38bdf8',
          accentGlow: 'rgba(56, 189, 248, 0.15)',
          text: '#f1f5f9',
          muted: '#94a3b8',
        }
      },
      fontFamily: {
        mono: ['"Cascadia Code"', '"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.35)',
        'pane-active': '0 0 0 1.5px rgba(56, 189, 248, 0.5), 0 8px 30px rgba(0, 0, 0, 0.4)',
      }
    },
  },
  plugins: [],
}
