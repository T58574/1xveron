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
        accent: {
          DEFAULT: 'rgb(var(--veron-accent-rgb) / <alpha-value>)',
          hover: 'var(--veron-accent-hover)',
          dim: 'var(--veron-accent-dim)',
          glow: 'var(--veron-accent-glow)',
          fg: 'var(--veron-accent-fg)',
        },
        veron: {
          bg: 'var(--veron-bg)',
          sidebar: 'var(--veron-sidebar)',
          card: 'var(--veron-card)',
          cardHeader: 'var(--veron-card-header)',
          elevated: 'var(--veron-elevated)',
          border: 'var(--veron-border)',
          borderSubtle: 'var(--veron-border-subtle)',
          borderHover: 'var(--veron-border-accent)',
          hover: 'rgba(255, 255, 255, 0.04)',
          active: 'var(--veron-accent-dim)',
          accent: 'rgb(var(--veron-accent-rgb) / <alpha-value>)',
          accentHover: 'var(--veron-accent-hover)',
          accentMuted: 'var(--veron-accent-dim)',
          text: 'var(--veron-text)',
          muted: 'var(--veron-text-muted)',
        }
      },
      fontFamily: {
        mono: ['"Cascadia Code"', '"JetBrains Mono"', 'Consolas', 'monospace'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.6)',
        'pane-active': '0 0 0 1px var(--veron-border-accent), 0 8px 30px rgba(0, 0, 0, 0.6)',
        'accent-glow': '0 0 16px -2px var(--veron-accent-glow)',
        'amber-glow': '0 0 16px -2px var(--veron-accent-glow)',
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
        'accent-pulse': {
          '0%, 100%': { borderColor: 'var(--veron-border-accent)', boxShadow: '0 0 12px var(--veron-accent-dim)' },
          '50%': { borderColor: 'var(--veron-accent)', boxShadow: '0 0 22px var(--veron-accent-glow)' },
        },
        'amber-pulse': {
          '0%, 100%': { borderColor: 'var(--veron-border-accent)', boxShadow: '0 0 12px var(--veron-accent-dim)' },
          '50%': { borderColor: 'var(--veron-accent)', boxShadow: '0 0 22px var(--veron-accent-glow)' },
        },
      },
      animation: {
        'dialog-in': 'dialog-in 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'overlay-in': 'overlay-in 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'dropdown-in': 'dropdown-in 160ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'toast-in': 'toast-slide 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'accent-pulse': 'accent-pulse 2.4s ease-in-out infinite',
        'amber-pulse': 'accent-pulse 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
