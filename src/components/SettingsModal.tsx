import React, { useState } from 'react';
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
} from 'lucide-react';
import { CapturesInfo, SystemInfo } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  capturesInfo: CapturesInfo | null;
  onClearCaptures: () => void;
  onOpenCapturesFolder: () => void;
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
  capturesInfo,
  onClearCaptures,
  onOpenCapturesFolder,
  systemInfo,
  onOpenRemoteModal,
  agyMode,
  onToggleAgyMode,
}) => {
  const [copiedToken, setCopiedToken] = useState(false);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  const handleCopyToken = () => {
    if (systemInfo?.auth_token) {
      navigator.clipboard.writeText(systemInfo.auth_token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#111217] border border-white/[0.08] rounded-2xl p-6 shadow-2xl text-zinc-200 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Close Settings"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/[0.06]">
          <div className="p-2.5 rounded-xl bg-amber-400/[0.1] border border-amber-400/30 text-amber-400">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">Settings & Preferences</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Customization, storage and system controls</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Section 1: Appearance / Theme Mode */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2.5">
              Appearance / Theme
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Dark Option */}
              <button
                type="button"
                onClick={() => {
                  if (!isDark) onToggleTheme();
                }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  isDark
                    ? 'bg-[#090a0d] border-amber-400/60 ring-1 ring-amber-400/30 text-white'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    isDark ? 'bg-amber-400/20 text-amber-400' : 'bg-white/[0.05] text-zinc-400'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Dark Mode</div>
                  <div className="text-[10px] text-zinc-500">Cybran Obsidian & Amber</div>
                </div>
              </button>

              {/* Light Option */}
              <button
                type="button"
                onClick={() => {
                  if (isDark) onToggleTheme();
                }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  !isDark
                    ? 'bg-zinc-100 border-amber-500/60 ring-1 ring-amber-500/30 text-zinc-900'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    !isDark ? 'bg-amber-400/30 text-amber-600' : 'bg-white/[0.05] text-zinc-400'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Light Mode</div>
                  <div className="text-[10px] text-zinc-500">High Contrast Day</div>
                </div>
              </button>
            </div>
          </div>

          {/* Section: AI Agent Integration & Paste Mode */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2.5">
              AI Agent & Image Paste Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* AGY Mode */}
              <button
                type="button"
                onClick={() => {
                  if (!agyMode) onToggleAgyMode(true);
                }}
                className={`flex flex-col p-3.5 rounded-xl border transition-all text-left cursor-pointer ${
                  agyMode
                    ? 'bg-[#090a0d] border-amber-400/60 ring-1 ring-amber-400/30 text-white'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        agyMode ? 'bg-amber-400/20 text-amber-400' : 'bg-white/[0.05] text-zinc-400'
                      }`}
                    >
                      <Bot className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold">AGY Mode</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-medium">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  For AGY CLI 1.2+. AGY attaches images natively via clipboard; Veron saves captures to disk (.veron/captures) without polluting prompt with text paths.
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
                    ? 'bg-[#090a0d] border-amber-400/60 ring-1 ring-amber-400/30 text-white'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        !agyMode ? 'bg-amber-400/20 text-amber-400' : 'bg-white/[0.05] text-zinc-400'
                      }`}
                    >
                      <Image className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold">Direct Path Mode</span>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Automatically types relative file path (.veron/captures/...) into terminal prompt on Ctrl+V. Ideal for local models, bash, and custom scripts.
                </p>
              </button>
            </div>
          </div>

          {/* Section 2: Screenshot Captures */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2.5">
              Terminal Screenshot Captures
            </label>
            <div className="p-3.5 rounded-xl bg-[#0c0d12] border border-white/[0.06] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-300 text-xs">
                  <Image className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {capturesInfo && capturesInfo.count > 0
                      ? `${capturesInfo.count} capture${capturesInfo.count > 1 ? 's' : ''} stored (${capturesInfo.size_formatted})`
                      : 'No screenshots saved yet'}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-zinc-500">.veron/captures</span>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={onOpenCapturesFolder}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-200 transition-colors border border-white/[0.06]"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Open in Explorer</span>
                </button>

                <button
                  type="button"
                  onClick={onClearCaptures}
                  disabled={!capturesInfo || capturesInfo.count === 0}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-red-400 transition-colors border border-red-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Network & Remote Access */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2.5">
              Network & Remote Access
            </label>
            <div className="p-3.5 rounded-xl bg-[#0c0d12] border border-white/[0.06] flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-[10px] text-zinc-500 uppercase block">LAN IP Address</span>
                  <span className="font-mono text-amber-300 text-xs mt-0.5 block truncate">
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
                  <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 uppercase">Auth PIN / Token</span>
                    <span className="font-mono text-amber-300 text-xs tracking-wider">
                      {systemInfo?.auth_token || '—'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-xs text-zinc-300 transition-colors"
                >
                  {copiedToken ? <Check className="w-3 h-3 text-amber-400" /> : <Copy className="w-3 h-3" />}
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
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-400/[0.08] hover:bg-amber-400/[0.15] text-amber-300 text-xs font-medium border border-amber-400/20 transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span>Show Phone Remote QR Code</span>
              </button>
            </div>
          </div>

          {/* Section 4: System Info / Build */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-500">
            <span>VERON Terminal Workspace v0.1.0</span>
            <span>ConPTY & Cybran Amber</span>
          </div>
        </div>
      </div>
    </div>
  );
};
