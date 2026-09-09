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
        // Cybran / Cicada Precision Palette (Matte Obsidian + Amber/Gold)
        veron: {
          bg: '#090a0d',
          sidebar: '#0d0e12',
          card: '#12141a',
          cardHeader: '#161820',
          border: 'rgba(255, 255, 255, 0.08)',
          borderSubtle: 'rgba(255, 255, 255, 0.04)',
          borderHover: 'rgba(245, 158, 11, 0.35)',
          hover: 'rgba(255, 255, 255, 0.04)',
          active: 'rgba(245, 158, 11, 0.08)',
          accent: '#f59e0b',       // Cicada Amber
          accentHover: '#fbbf24',  // Electric Gold
          accentMuted: 'rgba(245, 158, 11, 0.15)',
          text: '#f4f4f5',
          muted: '#71717a',
        }
      },
      fontFamily: {
        mono: ['"Cascadia Code"', '"JetBrains Mono"', 'Consolas', 'monospace'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.6)',
        'pane-active': '0 0 0 1px rgba(245, 158, 11, 0.6), 0 8px 30px rgba(0, 0, 0, 0.6)',
        'amber-glow': '0 0 16px -2px rgba(245, 158, 11, 0.25)',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.16, 1, 0.3, 1)',
      }
    },
  },
  plugins: [],
}
