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
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'dialog-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'overlay-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'dropdown-in': {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(-6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'toast-slide': {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'amber-pulse': {
          '0%, 100%': { borderColor: 'rgba(245, 158, 11, 0.25)', boxShadow: '0 0 12px rgba(245, 158, 11, 0.08)' },
          '50%': { borderColor: 'rgba(245, 158, 11, 0.55)', boxShadow: '0 0 22px rgba(245, 158, 11, 0.22)' },
        },
      },
      animation: {
        'dialog-in': 'dialog-in 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'overlay-in': 'overlay-in 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'dropdown-in': 'dropdown-in 160ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'toast-in': 'toast-slide 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'amber-pulse': 'amber-pulse 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
