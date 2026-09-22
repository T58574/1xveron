import React, { useState, useEffect } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Image,
  FolderOpen,
  Trash2,
  Smartphone,
  Copy,
  Check,
  Shield,
  Bot,
  Keyboard,
  Palette,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Terminal,
  Volume2,
  VolumeX,
  Play,
  Clock,
  Link,
} from 'lucide-react';
import { CapturesInfo, CapturePathFormat, SystemInfo } from '../types';
import { copyToGlobalClipboard } from '../services/api';
import {
  isSoundEnabled,
  setSoundEnabled,
  getSoundVolume,
  setSoundVolume,
  testVeronChime,
} from '../services/sound';
import {
  VeronTheme,
  ThemeSettings,
  THEME_PRESETS,
  QUICK_ACCENT_SWATCHES,
} from '../services/theme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  activeTheme?: VeronTheme;
  themeSettings?: ThemeSettings;
  onSelectTheme?: (themeId: string) => void;
  onSetCustomAccent?: (accent: string | null) => void;
  capturesInfo: CapturesInfo | null;
  onClearCaptures: () => void;
  onCleanupCaptures?: (olderThanDays?: number, maxTotalMb?: number) => Promise<void>;
  onOpenCapturesFolder: () => void;
  capturePathFormat?: CapturePathFormat;
  onSetCapturePathFormat?: (format: CapturePathFormat) => void;
  systemInfo: SystemInfo | null;
  onOpenRemoteModal: () => void;
  agyMode: boolean;
  onToggleAgyMode: (enabled?: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  activeTheme,
  themeSettings,
  onSelectTheme,
  onSetCustomAccent,
  capturesInfo,
  onClearCaptures,
  onCleanupCaptures,
  onOpenCapturesFolder,
  capturePathFormat = 'absolute',
  onSetCapturePathFormat,
  systemInfo,
  onOpenRemoteModal,
  agyMode,
  onToggleAgyMode,
}) => {
  const [copiedToken, setCopiedToken] = useState(false);
  const [customHexInput, setCustomHexInput] = useState<string>(
    activeTheme?.accent || '#f59e0b'
  );
  const [soundActive, setSoundActive] = useState(isSoundEnabled());
  const [soundVol, setSoundVol] = useState(getSoundVolume());
  const [isCleaning, setIsCleaning] = useState<number | null>(null);

  useEffect(() => {
    if (activeTheme?.accent) {
      setCustomHexInput(activeTheme.accent);
    }
  }, [activeTheme?.accent]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const currentAccent = activeTheme?.accent || '#f59e0b';
  const hasCustomAccent = Boolean(themeSettings?.customAccent);

  const handleCopyToken = () => {
    if (systemInfo?.auth_token) {
      copyToGlobalClipboard(systemInfo.auth_token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#')) {
      val = '#' + val;
    }
    setCustomHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val) || /^#[0-9A-Fa-f]{3}$/.test(val)) {
      onSetCustomAccent?.(val);
    }
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomHexInput(val);
    onSetCustomAccent?.(val);
  };

  const handleResetCustomAccent = () => {
    onSetCustomAccent?.(null);
  };

  // Filter presets based on active mode
  const currentPresets = THEME_PRESETS.filter((p) => p.mode === theme);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-overlay-in select-none"
    >
      <div className="relative w-full max-w-xl bg-[#111217] border border-white/[0.08] rounded-2xl p-6 shadow-2xl text-zinc-200 max-h-[90vh] overflow-y-auto custom-scrollbar animate-dialog-in will-change-transform">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors press-scale"
          title="Close Settings"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/[0.06]">
          <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">Settings & Preferences</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Themes, color palettes, shortcuts and system controls</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Section 1: Themes & Appearance */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-accent" />
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Themes & Color Palettes
                </label>
              </div>
              <span className="text-[11px] font-mono text-accent">
                {activeTheme?.name || 'Cybran Amber'}
                {hasCustomAccent && ' (Custom)'}
              </span>
            </div>

            {/* Dark / Light Mode Switcher */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                type="button"
                onClick={() => {
                  if (!isDark) onToggleTheme();
                }}
                className={`flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all duration-200 ease-apple press-scale ${
                  isDark
                    ? 'bg-[#090a0d] border-accent/60 ring-1 ring-accent/30 text-white shadow-accent'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark ? 'bg-accent/20 text-accent' : 'bg-white/[0.05] text-zinc-400'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                </div>
                <span>Dark Obsidian Mode</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isDark) onToggleTheme();
                }}
                className={`flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all duration-200 ease-apple press-scale ${
                  !isDark
                    ? 'bg-zinc-100 border-accent/60 ring-1 ring-accent/30 text-zinc-900'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg transition-colors ${
                    !isDark ? 'bg-accent/30 text-accent' : 'bg-white/[0.05] text-zinc-400'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                </div>
                <span>Light Workspace Mode</span>
              </button>
            </div>

            {/* Presets Gallery */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
                <span>Preset Color Themes ({currentPresets.length})</span>
                <span className="text-[10px] text-zinc-500 font-mono">Click to activate</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {currentPresets.map((preset) => {
                  const isSelected =
                    themeSettings?.selectedThemeId === preset.id && !hasCustomAccent;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectTheme?.(preset.id)}
                      className={`relative flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all duration-150 press-scale ${
                        isSelected
                          ? 'border-accent bg-accent/10 ring-1 ring-accent/40 shadow-accent'
                          : 'border-white/[0.06] bg-[#0c0d12]/70 hover:bg-white/[0.04] hover:border-white/[0.12]'
                      }`}
                    >
                      {/* Color Preview Swatch Dot */}
                      <div
                        className="w-4 h-4 rounded-full shrink-0 mt-0.5 shadow-sm border border-white/20"
                        style={{ backgroundColor: preset.accent }}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-medium text-zinc-200 truncate">
                            {preset.name}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5 leading-tight">
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual Color Customization Panel (Ручная настройка цвета) */}
            <div className="p-3.5 rounded-xl bg-[#0c0d12] border border-white/[0.06] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Custom Accent Tuning (Ручная настройка цвета)</span>
                </div>
                {hasCustomAccent && (
                  <button
                    type="button"
                    onClick={handleResetCustomAccent}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                    title="Reset back to preset default"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Color Picker & Hex Input row */}
              <div className="flex items-center gap-3">
                {/* Native Color Picker Styled Box */}
                <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/[0.1] shadow-inner shrink-0 cursor-pointer group">
                  <input
                    type="color"
                    value={currentAccent}
                    onChange={handlePickerChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title="Open Color Wheel"
                  />
                  <div
                    className="w-full h-full transition-transform group-hover:scale-105"
                    style={{ backgroundColor: currentAccent }}
                  />
                </div>

                {/* HEX Text Input */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={customHexInput}
                    onChange={handleHexChange}
                    placeholder="#f59e0b"
                    maxLength={7}
                    className="w-full h-10 px-3 font-mono text-xs text-white bg-black/40 border border-white/[0.08] rounded-xl focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 uppercase transition-all"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] text-zinc-500 font-mono pointer-events-none">
                    HEX
                  </span>
                </div>

                {/* Live Preview Pill */}
                <div
                  className="px-3 h-10 rounded-xl flex items-center gap-2 border text-xs font-medium shrink-0 select-none shadow-accent"
                  style={{
                    backgroundColor: `${currentAccent}15`,
                    borderColor: `${currentAccent}60`,
                    color: currentAccent,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full animate-ping"
                    style={{ backgroundColor: currentAccent }}
                  />
                  <span>Live Accent</span>
                </div>
              </div>

              {/* 12 Quick Accent Swatches */}
              <div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1.5">
                  Quick Palette Swatches
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACCENT_SWATCHES.map((swatch) => {
                    const isCurrent =
                      currentAccent.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.name}
                        type="button"
                        onClick={() => {
                          setCustomHexInput(swatch.hex);
                          onSetCustomAccent?.(swatch.hex);
                        }}
                        title={`${swatch.name} (${swatch.hex})`}
                        className={`w-6 h-6 rounded-lg transition-transform duration-100 press-scale relative flex items-center justify-center ${
                          isCurrent
                            ? 'ring-2 ring-white scale-110 shadow-md'
                            : 'hover:scale-110 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {isCurrent && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Realtime Terminal Mockup Preview */}
              <div className="mt-1 p-2.5 rounded-lg bg-black/60 border border-white/[0.05] flex items-center justify-between text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  <span className="text-zinc-400">Terminal Cursor Preview:</span>
                  <span className="text-zinc-200">veron@session:~$</span>
                  <span
                    className="w-2 h-3.5 animate-pulse inline-block"
                    style={{ backgroundColor: currentAccent }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500">Zero-latency sync</span>
              </div>
            </div>
          </div>

          {/* Section 2: AI Agent Integration & Paste Mode */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2.5">
              AI Agent & Image Paste Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {/* AGY Mode */}
              <button
                type="button"
                onClick={() => {
                  if (!agyMode) onToggleAgyMode(true);
                }}
                className={`flex flex-col p-3.5 rounded-xl border transition-all text-left cursor-pointer ${
                  agyMode
                    ? 'bg-[#090a0d] border-accent/60 ring-1 ring-accent/30 text-white'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        agyMode ? 'bg-accent/20 text-accent' : 'bg-white/[0.05] text-zinc-400'
                      }`}
                    >
                      <Bot className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold">AGY Mode</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-medium">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  For AGY CLI 1.2+. AGY attaches images natively; Veron saves captures to disk and copies the formatted absolute path to clipboard without polluting prompt.
                </p>
              </button>

              {/* Direct Path Mode */}
              <button
                type="button"
                onClick={() => {
                  if (agyMode) onToggleAgyMode(false);
                }}
                className={`flex flex-col p-3.5 rounded-xl border transition-all text-left cursor-pointer ${
                  !agyMode
                    ? 'bg-[#090a0d] border-accent/60 ring-1 ring-accent/30 text-white'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        !agyMode ? 'bg-accent/20 text-accent' : 'bg-white/[0.05] text-zinc-400'
                      }`}
                    >
                      <Image className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold">Direct Path Mode</span>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Automatically types normalized screenshot file path into terminal prompt on Ctrl+V and copies to clipboard. Ideal for local models, bash, and scripts.
                </p>
              </button>
            </div>

            {/* Sub-setting: Path Format in Clipboard / Prompt */}
            <div className="p-3 rounded-xl bg-[#0c0d12] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5 text-accent" />
                  Clipboard & Prompt Path Format
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {capturePathFormat === 'absolute'
                    ? 'C:/.../screenshot.png'
                    : capturePathFormat === 'relative'
                    ? '.veron/captures/...'
                    : '![capture](file:///...)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => onSetCapturePathFormat?.('absolute')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-center border ${
                    capturePathFormat === 'absolute'
                      ? 'bg-accent/15 border-accent/40 text-accent font-semibold'
                      : 'bg-white/[0.02] border-white/[0.04] text-zinc-400 hover:bg-white/[0.05]'
                  }`}
                  title="Zero guesswork for external agents. Works anywhere across drives and projects."
                >
                  Absolute (Agent)
                </button>
                <button
                  type="button"
                  onClick={() => onSetCapturePathFormat?.('relative')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-center border ${
                    capturePathFormat === 'relative'
                      ? 'bg-accent/15 border-accent/40 text-accent font-semibold'
                      : 'bg-white/[0.02] border-white/[0.04] text-zinc-400 hover:bg-white/[0.05]'
                  }`}
                  title="Short relative path (.veron/captures/...) for local terminal work."
                >
                  Relative Path
                </button>
                <button
                  type="button"
                  onClick={() => onSetCapturePathFormat?.('markdown')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-center border ${
                    capturePathFormat === 'markdown'
                      ? 'bg-accent/15 border-accent/40 text-accent font-semibold'
                      : 'bg-white/[0.02] border-white/[0.04] text-zinc-400 hover:bg-white/[0.05]'
                  }`}
                  title="Formatted Markdown image link with file:/// protocol."
                >
                  Markdown Link
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 mt-2">
                Absolute path prevents AI agents from burning 4+ search tool calls when running outside the Veron workspace.
              </p>
            </div>
          </div>

          {/* Section 3: Screenshot Captures & Retention */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2.5">
              Terminal Screenshot Captures & Retention
            </label>
            <div className="p-3.5 rounded-xl bg-[#0c0d12] border border-white/[0.06] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-300 text-xs">
                  <Image className="w-4 h-4 text-accent shrink-0" />
                  <span>
                    {capturesInfo && capturesInfo.count > 0
                      ? `${capturesInfo.count} capture${capturesInfo.count > 1 ? 's' : ''} stored (${capturesInfo.size_formatted})`
                      : 'No screenshots saved yet'}
                  </span>
                </div>
                <span
                  className="text-[11px] font-mono text-zinc-500 truncate max-w-[200px]"
                  title={capturesInfo?.captures_dir || '.veron/captures'}
                >
                  {capturesInfo?.captures_dir
                    ? capturesInfo.captures_dir.split('/').slice(-2).join('/')
                    : '.veron/captures'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={onOpenCapturesFolder}
                  className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 transition-all border border-white/[0.06] press-scale"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-accent" />
                  <span>Open in Explorer</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (onCleanupCaptures) {
                      setIsCleaning(7);
                      await onCleanupCaptures(7);
                      setIsCleaning(null);
                    }
                  }}
                  disabled={isCleaning !== null || !capturesInfo || capturesInfo.count === 0}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-amber-300 transition-all border border-amber-500/20 press-scale"
                  title="Remove captures older than 7 days"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isCleaning === 7 ? 'Cleaning...' : 'Clean > 7 Days'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (onCleanupCaptures) {
                      setIsCleaning(30);
                      await onCleanupCaptures(30);
                      setIsCleaning(null);
                    }
                  }}
                  disabled={isCleaning !== null || !capturesInfo || capturesInfo.count === 0}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-zinc-300 transition-all border border-white/[0.06] press-scale"
                  title="Remove captures older than 30 days"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isCleaning === 30 ? 'Cleaning...' : 'Clean > 30 Days'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClearCaptures}
                  disabled={!capturesInfo || capturesInfo.count === 0}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-red-400 transition-all border border-red-500/20 press-scale"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Sound Synthesizer & Task Completion Audio */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2.5">
              Sound Synthesizer & Task Completion Audio
            </label>
            <div className="p-3.5 rounded-xl bg-[#0c0d12] border border-white/[0.06] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundActive;
                      setSoundActive(next);
                      setSoundEnabled(next);
                    }}
                    className={`p-1.5 rounded-lg border transition-all ${
                      soundActive
                        ? 'bg-accent/15 border-accent/40 text-accent'
                        : 'bg-white/[0.04] border-white/[0.06] text-zinc-500'
                    }`}
                  >
                    {soundActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-zinc-200">
                      Veron Cyber Completion Chime
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Plays a synthesized harmonic tone when AI agents (Claude, AGY, Codex) or tasks complete
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => testVeronChime()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 border border-white/[0.06] transition-all press-scale"
                  title="Test chime preview"
                >
                  <Play className="w-3 h-3 text-accent fill-accent" />
                  <span>Test Chime</span>
                </button>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
                <span className="text-[11px] text-zinc-400 w-14 shrink-0">Volume</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVol}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setSoundVol(val);
                    setSoundVolume(val);
                  }}
                  disabled={!soundActive}
                  className="flex-1 accent-[var(--veron-accent,#f59e0b)] h-1.5 bg-zinc-700 rounded-lg cursor-pointer disabled:opacity-30"
                />
                <span className="font-mono text-xs text-zinc-300 w-10 text-right">
                  {Math.round(soundVol * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Network & Remote Access */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2.5">
              Network & Remote Access
            </label>
            <div className="p-3.5 rounded-xl bg-[#0c0d12] border border-white/[0.06] flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-[10px] text-zinc-500 uppercase block">LAN IP Address</span>
                  <span className="font-mono text-accent text-xs mt-0.5 block truncate">
                    {systemInfo?.local_ip || '127.0.0.1'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-[10px] text-zinc-500 uppercase block">Server Port</span>
                  <span className="font-mono text-zinc-300 text-xs mt-0.5 block">
                    {systemInfo?.port || 4567}
                  </span>
                </div>
              </div>

              {/* Auth PIN / Token */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-accent shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 uppercase">Auth PIN / Token</span>
                    <span className="font-mono text-accent text-xs tracking-wider">
                      {systemInfo?.auth_token || '—'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-xs text-zinc-300 transition-all press-scale"
                >
                  {copiedToken ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Open Phone Remote QR button */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRemoteModal();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-xs font-medium border border-accent/20 transition-all press-scale"
              >
                <Smartphone className="w-3.5 h-3.5 text-accent" />
                <span>Show Phone Remote QR Code</span>
              </button>
            </div>
          </div>

          {/* Section 6: Keyboard Shortcuts */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Keyboard className="w-3.5 h-3.5 text-accent" />
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Keyboard Shortcuts
              </label>
            </div>
            <div className="p-3 rounded-xl bg-[#0c0d12] border border-white/[0.06] flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                <span className="text-zinc-400">Command Palette / Quick Scripts</span>
                <kbd className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-accent font-mono text-[11px]">Ctrl + K</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                <span className="text-zinc-400">Search in Active Terminal</span>
                <kbd className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-accent font-mono text-[11px]">Ctrl + F</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                <span className="text-zinc-400">Instant Split / New Pane</span>
                <kbd className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-accent font-mono text-[11px]">Ctrl + Shift + T</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                <span className="text-zinc-400">Switch Quadrant / Pane</span>
                <kbd className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-accent font-mono text-[11px]">Alt + 1..6</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                <span className="text-zinc-400">Maximize / Restore Active Pane</span>
                <kbd className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-accent font-mono text-[11px]">Alt + M</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                <span className="text-zinc-400">Close Active Pane</span>
                <kbd className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-accent font-mono text-[11px]">Alt + W</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                <span className="text-zinc-400">Multi-line Prompt (AGY / REPL)</span>
                <kbd className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-accent font-mono text-[11px]">Ctrl + Enter</kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-zinc-400">Smart Copy Selection / Paste</span>
                <kbd className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-accent font-mono text-[11px]">Ctrl+C / Ctrl+V</kbd>
              </div>
            </div>
          </div>

          {/* Section 6: System Info / Build */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-500">
            <span>VERON Terminal Workspace v0.1.0</span>
            <span className="font-mono text-accent">
              {activeTheme?.name || 'Cybran Amber'} • {currentAccent}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
