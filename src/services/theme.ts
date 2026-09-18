export interface XtermTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent?: string;
  selectionBackground: string;
  selectionForeground?: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface VeronTheme {
  id: string;
  name: string;
  description: string;
  mode: 'dark' | 'light';
  accent: string;       // HEX e.g. '#f59e0b'
  accentHover: string;  // HEX e.g. '#fbbf24'
  accentMuted: string;  // e.g. 'rgba(245, 158, 11, 0.15)'
  accentGlow: string;   // e.g. 'rgba(245, 158, 11, 0.35)'
  accentFg: string;     // Contrast text e.g. '#000000' or '#ffffff'
  bgCanvas: string;     // Base bg e.g. '#090a0d'
  bgSidebar: string;    // Sidebar bg e.g. '#0d0e12'
  bgCard: string;       // Card/Pane bg e.g. '#12141a'
  bgCardHeader: string; // Header bg e.g. '#161820'
  bgElevated: string;   // Dropdowns/modals e.g. '#181c24'
  borderSubtle: string; // Subtle border e.g. 'rgba(255, 255, 255, 0.08)'
  borderAccent: string; // Accent border e.g. 'rgba(245, 158, 11, 0.4)'
  textPrimary: string;  // e.g. '#f4f4f5'
  textMuted: string;    // e.g. '#71717a'
  xterm: XtermTheme;
}

export interface ThemeSettings {
  selectedThemeId: string;
  customAccent: string | null;
  mode: 'dark' | 'light';
}

export const STORAGE_KEY = 'veron_theme_settings';

// Quick accent palette swatches for manual color selection
export const QUICK_ACCENT_SWATCHES = [
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Pink Rose', hex: '#f43f5e' },
  { name: 'Crimson', hex: '#ef4444' },
  { name: 'Gold', hex: '#eab308' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Slate', hex: '#94a3b8' },
  { name: 'Orange', hex: '#f97316' },
];

/**
 * Color math utilities
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  return null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function getLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

export function getContrastForeground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const lum = getLuminance(rgb.r, rgb.g, rgb.b);
  return lum > 0.45 ? '#000000' : '#ffffff';
}

export function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 + percent / 100;
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

/**
 * Built-in Theme Presets
 */
export const THEME_PRESETS: VeronTheme[] = [
  {
    id: 'cybran-amber',
    name: 'Cybran Amber',
    description: 'Supreme Commander industrial obsidian & tactile amber',
    mode: 'dark',
    accent: '#f59e0b',
    accentHover: '#fbbf24',
    accentMuted: 'rgba(245, 158, 11, 0.15)',
    accentGlow: 'rgba(245, 158, 11, 0.35)',
    accentFg: '#000000',
    bgCanvas: '#090a0d',
    bgSidebar: '#0d0e12',
    bgCard: '#12141a',
    bgCardHeader: '#161820',
    bgElevated: '#181c24',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(245, 158, 11, 0.4)',
    textPrimary: '#f4f4f5',
    textMuted: '#71717a',
    xterm: {
      background: '#0c0d12',
      foreground: '#f4f4f5',
      cursor: '#f59e0b',
      selectionBackground: 'rgba(245, 158, 11, 0.28)',
      black: '#14161f',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#fbbf24',
      blue: '#38bdf8',
      magenta: '#e879f9',
      cyan: '#22d3ee',
      white: '#f4f4f5',
      brightBlack: '#52525b',
      brightRed: '#ef4444',
      brightGreen: '#22c55e',
      brightYellow: '#f59e0b',
      brightBlue: '#60a5fa',
      brightMagenta: '#d946ef',
      brightCyan: '#06b6d4',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'emerald-matrix',
    name: 'Emerald Matrix',
    description: 'High-velocity sci-fi cyber matrix with emerald glow',
    mode: 'dark',
    accent: '#10b981',
    accentHover: '#34d399',
    accentMuted: 'rgba(16, 185, 129, 0.15)',
    accentGlow: 'rgba(16, 185, 129, 0.35)',
    accentFg: '#000000',
    bgCanvas: '#060d09',
    bgSidebar: '#09130d',
    bgCard: '#0d1a12',
    bgCardHeader: '#112217',
    bgElevated: '#14291c',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(16, 185, 129, 0.4)',
    textPrimary: '#f0fdf4',
    textMuted: '#6ee7b7',
    xterm: {
      background: '#08100b',
      foreground: '#f0fdf4',
      cursor: '#10b981',
      selectionBackground: 'rgba(16, 185, 129, 0.28)',
      black: '#0c1a11',
      red: '#f87171',
      green: '#10b981',
      yellow: '#fbbf24',
      blue: '#38bdf8',
      magenta: '#e879f9',
      cyan: '#2dd4bf',
      white: '#f0fdf4',
      brightBlack: '#4ade80',
      brightRed: '#ef4444',
      brightGreen: '#34d399',
      brightYellow: '#fde047',
      brightBlue: '#60a5fa',
      brightMagenta: '#d946ef',
      brightCyan: '#5eead4',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'cobalt-cyan',
    name: 'Cobalt Cyan',
    description: 'Tron digital neon, deep abyss navy and electric cyan',
    mode: 'dark',
    accent: '#06b6d4',
    accentHover: '#22d3ee',
    accentMuted: 'rgba(6, 182, 212, 0.15)',
    accentGlow: 'rgba(6, 182, 212, 0.35)',
    accentFg: '#000000',
    bgCanvas: '#070d14',
    bgSidebar: '#0a131e',
    bgCard: '#0f1c2b',
    bgCardHeader: '#142539',
    bgElevated: '#172b42',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(6, 182, 212, 0.4)',
    textPrimary: '#ecfeff',
    textMuted: '#67e8f9',
    xterm: {
      background: '#08101a',
      foreground: '#ecfeff',
      cursor: '#06b6d4',
      selectionBackground: 'rgba(6, 182, 212, 0.28)',
      black: '#0d1b2a',
      red: '#f87171',
      green: '#34d399',
      yellow: '#fde047',
      blue: '#0ea5e9',
      magenta: '#c084fc',
      cyan: '#06b6d4',
      white: '#ecfeff',
      brightBlack: '#475569',
      brightRed: '#ef4444',
      brightGreen: '#4ade80',
      brightYellow: '#fbbf24',
      brightBlue: '#38bdf8',
      brightMagenta: '#d946ef',
      brightCyan: '#22d3ee',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'amethyst-synth',
    name: 'Amethyst Synth',
    description: 'Cyberpunk neon synthwave with deep velvet purple',
    mode: 'dark',
    accent: '#a855f7',
    accentHover: '#c084fc',
    accentMuted: 'rgba(168, 85, 247, 0.15)',
    accentGlow: 'rgba(168, 85, 247, 0.35)',
    accentFg: '#ffffff',
    bgCanvas: '#0e0918',
    bgSidebar: '#130c22',
    bgCard: '#1a112e',
    bgCardHeader: '#21163a',
    bgElevated: '#281a47',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(168, 85, 247, 0.4)',
    textPrimary: '#faf5ff',
    textMuted: '#c084fc',
    xterm: {
      background: '#110b1d',
      foreground: '#faf5ff',
      cursor: '#a855f7',
      selectionBackground: 'rgba(168, 85, 247, 0.28)',
      black: '#1a112e',
      red: '#f43f5e',
      green: '#34d399',
      yellow: '#fbbf24',
      blue: '#818cf8',
      magenta: '#a855f7',
      cyan: '#22d3ee',
      white: '#faf5ff',
      brightBlack: '#6b7280',
      brightRed: '#fb7185',
      brightGreen: '#4ade80',
      brightYellow: '#fde047',
      brightBlue: '#a5b4fc',
      brightMagenta: '#c084fc',
      brightCyan: '#67e8f9',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'crimson-void',
    name: 'Crimson Void',
    description: 'High-alert tactical command with carbon & vivid crimson',
    mode: 'dark',
    accent: '#ef4444',
    accentHover: '#f87171',
    accentMuted: 'rgba(239, 68, 68, 0.15)',
    accentGlow: 'rgba(239, 68, 68, 0.35)',
    accentFg: '#ffffff',
    bgCanvas: '#110808',
    bgSidebar: '#170b0b',
    bgCard: '#201010',
    bgCardHeader: '#281414',
    bgElevated: '#301818',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(239, 68, 68, 0.4)',
    textPrimary: '#fef2f2',
    textMuted: '#fca5a5',
    xterm: {
      background: '#140909',
      foreground: '#fef2f2',
      cursor: '#ef4444',
      selectionBackground: 'rgba(239, 68, 68, 0.28)',
      black: '#201010',
      red: '#ef4444',
      green: '#34d399',
      yellow: '#fbbf24',
      blue: '#60a5fa',
      magenta: '#e879f9',
      cyan: '#22d3ee',
      white: '#fef2f2',
      brightBlack: '#6b7280',
      brightRed: '#f87171',
      brightGreen: '#4ade80',
      brightYellow: '#fde047',
      brightBlue: '#93c5fd',
      brightMagenta: '#f472b6',
      brightCyan: '#67e8f9',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'solar-gold',
    name: 'Solar Gold',
    description: 'High-energy electric yellow-gold & matte charcoal',
    mode: 'dark',
    accent: '#eab308',
    accentHover: '#facc15',
    accentMuted: 'rgba(234, 179, 8, 0.15)',
    accentGlow: 'rgba(234, 179, 8, 0.35)',
    accentFg: '#000000',
    bgCanvas: '#0c0c08',
    bgSidebar: '#12120c',
    bgCard: '#181810',
    bgCardHeader: '#202015',
    bgElevated: '#26261a',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(234, 179, 8, 0.4)',
    textPrimary: '#fefce8',
    textMuted: '#fef08a',
    xterm: {
      background: '#0f0f0a',
      foreground: '#fefce8',
      cursor: '#eab308',
      selectionBackground: 'rgba(234, 179, 8, 0.28)',
      black: '#181810',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#eab308',
      blue: '#38bdf8',
      magenta: '#e879f9',
      cyan: '#22d3ee',
      white: '#fefce8',
      brightBlack: '#71717a',
      brightRed: '#ef4444',
      brightGreen: '#22c55e',
      brightYellow: '#facc15',
      brightBlue: '#60a5fa',
      brightMagenta: '#d946ef',
      brightCyan: '#06b6d4',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'velvet-rose',
    name: 'Velvet Rose',
    description: 'Deep onyx night with glowing cyberpunk rose & coral',
    mode: 'dark',
    accent: '#f43f5e',
    accentHover: '#fb7185',
    accentMuted: 'rgba(244, 63, 94, 0.15)',
    accentGlow: 'rgba(244, 63, 94, 0.35)',
    accentFg: '#ffffff',
    bgCanvas: '#12070c',
    bgSidebar: '#180a10',
    bgCard: '#210e17',
    bgCardHeader: '#2a121d',
    bgElevated: '#321623',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(244, 63, 94, 0.4)',
    textPrimary: '#fff1f2',
    textMuted: '#fda4af',
    xterm: {
      background: '#15080e',
      foreground: '#fff1f2',
      cursor: '#f43f5e',
      selectionBackground: 'rgba(244, 63, 94, 0.28)',
      black: '#210e17',
      red: '#f43f5e',
      green: '#34d399',
      yellow: '#fbbf24',
      blue: '#818cf8',
      magenta: '#f472b6',
      cyan: '#22d3ee',
      white: '#fff1f2',
      brightBlack: '#71717a',
      brightRed: '#fb7185',
      brightGreen: '#4ade80',
      brightYellow: '#fde047',
      brightBlue: '#a5b4fc',
      brightMagenta: '#fb7185',
      brightCyan: '#67e8f9',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'nordic-frost',
    name: 'Nordic Frost',
    description: 'Arctic night with glacial polar ice blue',
    mode: 'dark',
    accent: '#38bdf8',
    accentHover: '#7dd3fc',
    accentMuted: 'rgba(56, 189, 248, 0.15)',
    accentGlow: 'rgba(56, 189, 248, 0.35)',
    accentFg: '#000000',
    bgCanvas: '#0a0e16',
    bgSidebar: '#0e1420',
    bgCard: '#131b2b',
    bgCardHeader: '#192337',
    bgElevated: '#1f2b43',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(56, 189, 248, 0.4)',
    textPrimary: '#f0f9ff',
    textMuted: '#7dd3fc',
    xterm: {
      background: '#0c111b',
      foreground: '#f0f9ff',
      cursor: '#38bdf8',
      selectionBackground: 'rgba(56, 189, 248, 0.28)',
      black: '#131b2b',
      red: '#f87171',
      green: '#34d399',
      yellow: '#fbbf24',
      blue: '#38bdf8',
      magenta: '#c084fc',
      cyan: '#22d3ee',
      white: '#f0f9ff',
      brightBlack: '#64748b',
      brightRed: '#ef4444',
      brightGreen: '#4ade80',
      brightYellow: '#fde047',
      brightBlue: '#7dd3fc',
      brightMagenta: '#d946ef',
      brightCyan: '#a5f3fc',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'monokai-neon',
    name: 'Monokai Neon',
    description: 'Hacker aesthetic with sharp acid lime & deep graphite',
    mode: 'dark',
    accent: '#84cc16',
    accentHover: '#a3e635',
    accentMuted: 'rgba(132, 204, 22, 0.15)',
    accentGlow: 'rgba(132, 204, 22, 0.35)',
    accentFg: '#000000',
    bgCanvas: '#101214',
    bgSidebar: '#15181b',
    bgCard: '#1a1e22',
    bgCardHeader: '#21262b',
    bgElevated: '#282e34',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(132, 204, 22, 0.4)',
    textPrimary: '#f7fee7',
    textMuted: '#bef264',
    xterm: {
      background: '#121417',
      foreground: '#f7fee7',
      cursor: '#84cc16',
      selectionBackground: 'rgba(132, 204, 22, 0.28)',
      black: '#1a1e22',
      red: '#f43f5e',
      green: '#84cc16',
      yellow: '#eab308',
      blue: '#38bdf8',
      magenta: '#d946ef',
      cyan: '#06b6d4',
      white: '#f7fee7',
      brightBlack: '#52525b',
      brightRed: '#fb7185',
      brightGreen: '#a3e635',
      brightYellow: '#facc15',
      brightBlue: '#60a5fa',
      brightMagenta: '#e879f9',
      brightCyan: '#22d3ee',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'titanium-slate',
    name: 'Titanium Slate',
    description: 'Ultra-clean monochromatic steel with crisp silver accent',
    mode: 'dark',
    accent: '#cbd5e1',
    accentHover: '#f1f5f9',
    accentMuted: 'rgba(203, 213, 225, 0.15)',
    accentGlow: 'rgba(203, 213, 225, 0.3)',
    accentFg: '#000000',
    bgCanvas: '#0d0f12',
    bgSidebar: '#121519',
    bgCard: '#171b21',
    bgCardHeader: '#1e232a',
    bgElevated: '#242a33',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(203, 213, 225, 0.4)',
    textPrimary: '#f8fafc',
    textMuted: '#94a3b8',
    xterm: {
      background: '#0f1216',
      foreground: '#f8fafc',
      cursor: '#cbd5e1',
      selectionBackground: 'rgba(203, 213, 225, 0.28)',
      black: '#171b21',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#fbbf24',
      blue: '#60a5fa',
      magenta: '#c084fc',
      cyan: '#38bdf8',
      white: '#f8fafc',
      brightBlack: '#64748b',
      brightRed: '#ef4444',
      brightGreen: '#22c55e',
      brightYellow: '#f59e0b',
      brightBlue: '#93c5fd',
      brightMagenta: '#d946ef',
      brightCyan: '#7dd3fc',
      brightWhite: '#ffffff',
    },
  },
  // Light Mode Presets
  {
    id: 'light-amber',
    name: 'Paper Amber',
    description: 'Warm cream-paper workspace with deep ochre accent',
    mode: 'light',
    accent: '#d97706',
    accentHover: '#b45309',
    accentMuted: 'rgba(217, 119, 6, 0.15)',
    accentGlow: 'rgba(217, 119, 6, 0.25)',
    accentFg: '#ffffff',
    bgCanvas: '#f8f9fa',
    bgSidebar: '#f1f2f4',
    bgCard: '#ffffff',
    bgCardHeader: '#f4f5f7',
    bgElevated: '#ffffff',
    borderSubtle: 'rgba(0, 0, 0, 0.09)',
    borderAccent: 'rgba(217, 119, 6, 0.4)',
    textPrimary: '#09090b',
    textMuted: '#64748b',
    xterm: {
      background: '#ffffff',
      foreground: '#09090b',
      cursor: '#d97706',
      selectionBackground: 'rgba(217, 119, 6, 0.2)',
      black: '#09090b',
      red: '#dc2626',
      green: '#16a34a',
      yellow: '#d97706',
      blue: '#2563eb',
      magenta: '#9333ea',
      cyan: '#0891b2',
      white: '#fafafa',
      brightBlack: '#71717a',
      brightRed: '#b91c1c',
      brightGreen: '#15803d',
      brightYellow: '#b45309',
      brightBlue: '#1d4ed8',
      brightMagenta: '#7e22ce',
      brightCyan: '#0e7490',
      brightWhite: '#09090b',
    },
  },
  {
    id: 'light-cobalt',
    name: 'Clean Azure',
    description: 'Crisp bright workspace with electric cobalt azure',
    mode: 'light',
    accent: '#0284c7',
    accentHover: '#0369a1',
    accentMuted: 'rgba(2, 132, 199, 0.15)',
    accentGlow: 'rgba(2, 132, 199, 0.25)',
    accentFg: '#ffffff',
    bgCanvas: '#f8fafc',
    bgSidebar: '#f1f5f9',
    bgCard: '#ffffff',
    bgCardHeader: '#f1f5f9',
    bgElevated: '#ffffff',
    borderSubtle: 'rgba(0, 0, 0, 0.08)',
    borderAccent: 'rgba(2, 132, 199, 0.4)',
    textPrimary: '#0f172a',
    textMuted: '#64748b',
    xterm: {
      background: '#ffffff',
      foreground: '#0f172a',
      cursor: '#0284c7',
      selectionBackground: 'rgba(2, 132, 199, 0.2)',
      black: '#0f172a',
      red: '#dc2626',
      green: '#16a34a',
      yellow: '#ca8a04',
      blue: '#0284c7',
      magenta: '#9333ea',
      cyan: '#0891b2',
      white: '#f8fafc',
      brightBlack: '#64748b',
      brightRed: '#b91c1c',
      brightGreen: '#15803d',
      brightYellow: '#a16207',
      brightBlue: '#0369a1',
      brightMagenta: '#7e22ce',
      brightCyan: '#0e7490',
      brightWhite: '#0f172a',
    },
  },
  {
    id: 'light-emerald',
    name: 'Forest Sage',
    description: 'Earthy mint & forest green for fatigue-free daylight pair coding',
    mode: 'light',
    accent: '#059669',
    accentHover: '#047857',
    accentMuted: 'rgba(5, 150, 105, 0.15)',
    accentGlow: 'rgba(5, 150, 105, 0.25)',
    accentFg: '#ffffff',
    bgCanvas: '#f6faf7',
    bgSidebar: '#eef6f0',
    bgCard: '#ffffff',
    bgCardHeader: '#edf5ef',
    bgElevated: '#ffffff',
    borderSubtle: 'rgba(0, 0, 0, 0.08)',
    borderAccent: 'rgba(5, 150, 105, 0.4)',
    textPrimary: '#064e3b',
    textMuted: '#047857',
    xterm: {
      background: '#ffffff',
      foreground: '#064e3b',
      cursor: '#059669',
      selectionBackground: 'rgba(5, 150, 105, 0.2)',
      black: '#064e3b',
      red: '#dc2626',
      green: '#059669',
      yellow: '#ca8a04',
      blue: '#2563eb',
      magenta: '#9333ea',
      cyan: '#0d9488',
      white: '#f6faf7',
      brightBlack: '#4b5563',
      brightRed: '#b91c1c',
      brightGreen: '#047857',
      brightYellow: '#a16207',
      brightBlue: '#1d4ed8',
      brightMagenta: '#7e22ce',
      brightCyan: '#0f766e',
      brightWhite: '#064e3b',
    },
  },
  {
    id: 'light-minimal',
    name: 'Pure Monochrome',
    description: 'High contrast stark black on porcelain white',
    mode: 'light',
    accent: '#18181b',
    accentHover: '#27272a',
    accentMuted: 'rgba(24, 24, 27, 0.12)',
    accentGlow: 'rgba(24, 24, 27, 0.2)',
    accentFg: '#ffffff',
    bgCanvas: '#ffffff',
    bgSidebar: '#f4f4f5',
    bgCard: '#ffffff',
    bgCardHeader: '#fafafa',
    bgElevated: '#ffffff',
    borderSubtle: 'rgba(0, 0, 0, 0.1)',
    borderAccent: 'rgba(24, 24, 27, 0.4)',
    textPrimary: '#09090b',
    textMuted: '#52525b',
    xterm: {
      background: '#ffffff',
      foreground: '#09090b',
      cursor: '#18181b',
      selectionBackground: 'rgba(24, 24, 27, 0.15)',
      black: '#09090b',
      red: '#dc2626',
      green: '#16a34a',
      yellow: '#ca8a04',
      blue: '#2563eb',
      magenta: '#9333ea',
      cyan: '#0891b2',
      white: '#f4f4f5',
      brightBlack: '#71717a',
      brightRed: '#b91c1c',
      brightGreen: '#15803d',
      brightYellow: '#a16207',
      brightBlue: '#1d4ed8',
      brightMagenta: '#7e22ce',
      brightCyan: '#0e7490',
      brightWhite: '#09090b',
    },
  },
];

/**
 * Generate a custom VeronTheme from any user-chosen accent color & mode
 */
export function generateCustomTheme(accentHex: string, mode: 'dark' | 'light'): VeronTheme {
  const rgb = hexToRgb(accentHex) || { r: 245, g: 158, b: 11 };
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const isDark = mode === 'dark';

  const hoverHex = adjustBrightness(hex, isDark ? 15 : -15);
  const muted = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
  const glow = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;
  const border = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;
  const fg = getContrastForeground(hex);

  if (isDark) {
    return {
      id: 'custom',
      name: 'Custom Palette',
      description: `User customized theme with accent ${hex.toUpperCase()}`,
      mode: 'dark',
      accent: hex,
      accentHover: hoverHex,
      accentMuted: muted,
      accentGlow: glow,
      accentFg: fg,
      bgCanvas: '#090a0d',
      bgSidebar: '#0d0e12',
      bgCard: '#12141a',
      bgCardHeader: '#161820',
      bgElevated: '#181c24',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      borderAccent: border,
      textPrimary: '#f4f4f5',
      textMuted: '#71717a',
      xterm: {
        background: '#0c0d12',
        foreground: '#f4f4f5',
        cursor: hex,
        selectionBackground: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`,
        black: '#14161f',
        red: '#f87171',
        green: '#4ade80',
        yellow: hex,
        blue: '#38bdf8',
        magenta: '#e879f9',
        cyan: '#22d3ee',
        white: '#f4f4f5',
        brightBlack: '#52525b',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: hoverHex,
        brightBlue: '#60a5fa',
        brightMagenta: '#d946ef',
        brightCyan: '#06b6d4',
        brightWhite: '#ffffff',
      },
    };
  } else {
    return {
      id: 'custom',
      name: 'Custom Palette',
      description: `User customized light theme with accent ${hex.toUpperCase()}`,
      mode: 'light',
      accent: hex,
      accentHover: hoverHex,
      accentMuted: muted,
      accentGlow: glow,
      accentFg: fg,
      bgCanvas: '#f8f9fa',
      bgSidebar: '#f1f2f4',
      bgCard: '#ffffff',
      bgCardHeader: '#f8f9fa',
      bgElevated: '#ffffff',
      borderSubtle: 'rgba(0, 0, 0, 0.09)',
      borderAccent: border,
      textPrimary: '#09090b',
      textMuted: '#64748b',
      xterm: {
        background: '#ffffff',
        foreground: '#09090b',
        cursor: hex,
        selectionBackground: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
        black: '#09090b',
        red: '#dc2626',
        green: '#16a34a',
        yellow: hex,
        blue: '#2563eb',
        magenta: '#9333ea',
        cyan: '#0891b2',
        white: '#fafafa',
        brightBlack: '#71717a',
        brightRed: '#b91c1c',
        brightGreen: '#15803d',
        brightYellow: hoverHex,
        brightBlue: '#1d4ed8',
        brightMagenta: '#7e22ce',
        brightCyan: '#0e7490',
        brightWhite: '#09090b',
      },
    };
  }
}

/**
 * Load theme settings from localStorage
 */
export function loadThemeSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.selectedThemeId === 'string') {
        return {
          selectedThemeId: parsed.selectedThemeId,
          customAccent: parsed.customAccent || null,
          mode: parsed.mode === 'light' ? 'light' : 'dark',
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored theme settings:', e);
  }

  // Check legacy 'theme' key if present
  const legacyTheme = localStorage.getItem('theme');
  return {
    selectedThemeId: legacyTheme === 'light' ? 'light-amber' : 'cybran-amber',
    customAccent: null,
    mode: legacyTheme === 'light' ? 'light' : 'dark',
  };
}

/**
 * Save theme settings to localStorage
 */
export function saveThemeSettings(settings: ThemeSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Also keep legacy 'theme' key in sync for backward compatibility
    localStorage.setItem('theme', settings.mode);
  } catch (e) {
    console.warn('Failed to save theme settings:', e);
  }
}

/**
 * Resolve the active VeronTheme based on settings
 */
export function resolveTheme(settings: ThemeSettings): VeronTheme {
  if (settings.selectedThemeId === 'custom' && settings.customAccent) {
    return generateCustomTheme(settings.customAccent, settings.mode);
  }

  const preset = THEME_PRESETS.find((t) => t.id === settings.selectedThemeId);
  if (preset) {
    // If user has a custom accent applied on top of preset:
    if (settings.customAccent) {
      return generateCustomTheme(settings.customAccent, preset.mode);
    }
    return preset;
  }

  // Fallback to default
  return THEME_PRESETS[0];
}

/**
 * Apply the theme properties to document root DOM (:root)
 */
export function applyThemeToDOM(theme: VeronTheme): void {
  const root = document.documentElement;
  const rgb = hexToRgb(theme.accent) || { r: 245, g: 158, b: 11 };
  const hoverRgb = hexToRgb(theme.accentHover) || rgb;

  root.style.setProperty('--veron-accent', theme.accent);
  root.style.setProperty('--veron-accent-rgb', `${rgb.r} ${rgb.g} ${rgb.b}`);
  root.style.setProperty('--veron-accent-hover', theme.accentHover);
  root.style.setProperty('--veron-accent-hover-rgb', `${hoverRgb.r} ${hoverRgb.g} ${hoverRgb.b}`);
  root.style.setProperty('--veron-accent-dim', theme.accentMuted);
  root.style.setProperty('--veron-accent-glow', theme.accentGlow);
  root.style.setProperty('--veron-accent-fg', theme.accentFg);

  root.style.setProperty('--veron-bg', theme.bgCanvas);
  root.style.setProperty('--veron-sidebar', theme.bgSidebar);
  root.style.setProperty('--veron-card', theme.bgCard);
  root.style.setProperty('--veron-card-header', theme.bgCardHeader);
  root.style.setProperty('--veron-elevated', theme.bgElevated);
  root.style.setProperty('--veron-border', theme.borderSubtle);
  root.style.setProperty('--veron-border-subtle', theme.borderSubtle);
  root.style.setProperty('--veron-border-accent', theme.borderAccent);
  root.style.setProperty('--veron-text', theme.textPrimary);
  root.style.setProperty('--veron-text-muted', theme.textMuted);

  if (theme.mode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}
