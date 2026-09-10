import React, { useState } from 'react';
import {
  Square,
  Columns2,
  LayoutGrid,
  Grid2X2,
  Grid3X3,
  Plus,
  Smartphone,
  Sun,
  Moon,
  ChevronDown,
  Terminal as TermIcon,
  Sparkles,
  Layers,
} from 'lucide-react';
import { LayoutMode, ShellOption, SystemInfo, Workspace } from '../types';
import { AntigravityIcon } from './AntigravityIcon';

interface TopBarProps {
  layoutMode: LayoutMode;
  onChangeLayout: (mode: LayoutMode) => void;
  systemInfo: SystemInfo | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | undefined;
  activeWorkspaceSessionCount: number;
  onSelectWorkspace: (id: string) => void;
  onOpenCreateWorkspaceModal: () => void;
  onOpenRemoteModal: () => void;
  onOpenQuickScripts: () => void;
  onCreateSession: (shell?: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  layoutMode,
  onChangeLayout,
  systemInfo,
  workspaces,
  activeWorkspace,
  activeWorkspaceSessionCount,
  onSelectWorkspace,
  onOpenCreateWorkspaceModal,
  onOpenRemoteModal,
  onOpenQuickScripts,
  onCreateSession,
  theme,
  onToggleTheme,
}) => {
  const [isShellDropdownOpen, setIsShellDropdownOpen] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const isDark = theme === 'dark';

  const layoutIcons: { mode: LayoutMode; label: string; icon: React.ReactNode }[] = [
    { mode: 1, label: '1 Pane', icon: <Square className="w-3.5 h-3.5" /> },
    { mode: 2, label: '2 Panes', icon: <Columns2 className="w-3.5 h-3.5" /> },
    { mode: 3, label: '3 Panes', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { mode: 4, label: '4 Panes', icon: <Grid2X2 className="w-3.5 h-3.5" /> },
    { mode: 5, label: '5 Panes', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
    { mode: 6, label: '6 Panes', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
  ];

  const isFull = activeWorkspaceSessionCount >= 6;
  const isAntigravity =
    activeWorkspace?.kind === 'antigravity' ||
    activeWorkspace?.name.toLowerCase().includes('antigravity') ||
    activeWorkspace?.name.toLowerCase().includes('agy');

  return (
    <header
      className={`h-11 px-4 flex items-center justify-between border-b select-none transition-colors duration-150 z-20 ${
        isDark ? 'bg-[#0d0e12] border-white/[0.06] text-zinc-300' : 'bg-zinc-50 border-zinc-200 text-zinc-700'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Active Workspace Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
            title="Switch Workspace Group"
            className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#141620] border border-amber-400/30 hover:border-amber-400/60 text-zinc-200 text-xs font-medium transition-all shadow-sm"
          >
            {isAntigravity ? (
              <AntigravityIcon size={15} mode="gradient" className="shrink-0" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            <span className="font-semibold text-zinc-100 max-w-[130px] truncate">
              {activeWorkspace?.name || 'Workspace'}
            </span>
            {isAntigravity && (
              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold bg-gradient-to-r from-blue-500/20 via-emerald-500/20 to-amber-500/20 text-amber-300 border border-amber-400/30">
                AGY
              </span>
            )}
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/15 text-amber-300 font-mono">
              {activeWorkspaceSessionCount}/6
            </span>
            <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
          </button>

          {isWorkspaceDropdownOpen && (
            <div
              className="absolute left-0 mt-1.5 w-64 rounded-xl bg-[#13151c] border border-white/[0.08] shadow-2xl py-1.5 z-50 text-xs backdrop-blur-md"
              onClick={() => setIsWorkspaceDropdownOpen(false)}
            >
              <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Workspace Groups
              </div>

              {workspaces.map((ws) => {
                const isCurrent = ws.id === activeWorkspace?.id;
                const isWsAgy =
                  ws.kind === 'antigravity' ||
                  ws.name.toLowerCase().includes('antigravity') ||
                  ws.name.toLowerCase().includes('agy');

                return (
                  <button
                    key={ws.id}
                    onClick={() => onSelectWorkspace(ws.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/[0.06] transition-colors ${
                      isCurrent ? 'text-amber-400 font-medium bg-white/[0.03]' : 'text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isWsAgy ? (
                        <AntigravityIcon size={14} mode={isCurrent ? 'gradient' : 'amber'} className="shrink-0" />
                      ) : (
                        <Layers className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      )}
                      <span className="truncate">{ws.name}</span>
                      {isWsAgy && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold bg-amber-400/15 text-amber-300">
                          AGY
                        </span>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}

              <div className="my-1 border-t border-white/[0.06]" />

              <button
                onClick={() => {
                  setIsWorkspaceDropdownOpen(false);
                  onOpenCreateWorkspaceModal();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-amber-400 hover:bg-amber-400/10 transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Workspace Group...</span>
              </button>
            </div>
          )}
        </div>

        {/* Apple-grade Segmented Control for Layouts 1 - 6 */}
        <div className="flex items-center bg-[#13141a] p-0.5 rounded-lg border border-white/[0.06]">
          {layoutIcons.map(({ mode, label, icon }) => {
            const isActive = layoutMode === mode;
            return (
              <button
                key={mode}
                onClick={() => onChangeLayout(mode)}
                title={`${label} in this workspace`}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all duration-150 ${
                  isActive
                    ? 'bg-amber-400 text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {icon}
                <span className="font-mono">{mode}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Action Tools */}
      <div className="flex items-center gap-2">
        {/* Launch Shell / AGY Dropdown */}
        <div className="relative">
          <button
            onClick={() => !isFull && setIsShellDropdownOpen(!isShellDropdownOpen)}
            disabled={isFull}
            title={
              isFull
                ? 'Workspace limit reached (max 6 windows)'
                : isAntigravity
                ? 'Launch new AGY session in this workspace'
                : 'Launch new shell in active workspace'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 border ${
              isFull
                ? 'opacity-40 cursor-not-allowed bg-white/[0.02] border-white/[0.04] text-zinc-500'
                : 'bg-white/[0.04] hover:bg-white/[0.08] hover:text-amber-400 text-zinc-300 border-white/[0.06]'
            }`}
          >
            {isAntigravity ? (
              <AntigravityIcon size={14} mode="gradient" className="shrink-0" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{isFull ? '6/6 Full' : isAntigravity ? 'New AGY' : 'New Shell'}</span>
            {!isFull && <ChevronDown className="w-3 h-3 opacity-60" />}
          </button>

          {isShellDropdownOpen && !isFull && (
            <div
              className="absolute right-0 mt-1.5 w-48 rounded-xl bg-[#13151c] border border-white/[0.08] shadow-2xl py-1 z-50 text-xs backdrop-blur-md"
              onClick={() => setIsShellDropdownOpen(false)}
            >
              {systemInfo?.available_shells?.map((shell: ShellOption) => (
                <button
                  key={shell.cmd}
                  onClick={() => onCreateSession(shell.cmd)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.06] text-zinc-300 hover:text-amber-400 text-left transition-colors"
                >
                  <TermIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>{shell.name}</span>
                </button>
              )) || (
                <button
                  onClick={() => onCreateSession('powershell.exe')}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.06] text-zinc-300 hover:text-amber-400 text-left"
                >
                  <TermIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>PowerShell</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick Scripts / Command Palette Button */}
        <button
          onClick={onOpenQuickScripts}
          title="Quick Scripts & Commands (Ctrl+K)"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] hover:text-amber-400 text-zinc-300 rounded-md text-xs font-medium transition-all duration-150 border border-white/[0.06]"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Scripts</span>
          <span className="hidden md:inline-block px-1.5 py-0.2 text-[10px] font-mono text-zinc-400 bg-black/40 rounded border border-white/[0.08]">
            Ctrl+K
          </span>
        </button>

        {/* Mobile Remote Button */}
        <button
          onClick={onOpenRemoteModal}
          title="Open Mobile Remote Control"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-400/[0.08] text-amber-300 border border-amber-400/20 hover:bg-amber-400/[0.15] transition-all duration-150"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Phone Remote</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title="Toggle Theme"
          className="p-1.5 rounded-md text-zinc-400 hover:text-amber-400 hover:bg-white/[0.05] transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
