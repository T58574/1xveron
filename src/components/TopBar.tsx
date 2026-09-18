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
  GitBranch,
} from 'lucide-react';
import { LayoutMode, ShellOption, SystemInfo, Workspace, GitStatusResponse, DetectedPort } from '../types';
import { AntigravityIcon } from './AntigravityIcon';
import { GitDiffPill } from './GitDiffPill';
import { PortIndicator } from './PortIndicator';

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
  gitStatus: GitStatusResponse | null;
  onOpenGitDiff: () => void;
  activePorts: DetectedPort[];
  onToast: (msg: string) => void;
  onSplit?: () => void;
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
  gitStatus,
  onOpenGitDiff,
  activePorts,
  onToast,
  onSplit,
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
            className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#141620] border border-accent/30 hover:border-accent/60 text-zinc-200 text-xs font-medium transition-all shadow-sm"
          >
            {isAntigravity ? (
              <AntigravityIcon size={14} mode="accent" className="shrink-0" />
            ) : activeWorkspace?.is_worktree ? (
              <GitBranch className="w-3.5 h-3.5 text-accent shrink-0" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-accent shrink-0" />
            )}
            <span className="font-semibold text-zinc-100 max-w-[130px] truncate">
              {activeWorkspace?.name || 'Workspace'}
            </span>
            {activeWorkspace?.branch && (
              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 flex items-center gap-1 shrink-0">
                <GitBranch className="w-2.5 h-2.5" />
                <span className="max-w-[70px] truncate">{activeWorkspace.branch}</span>
              </span>
            )}
            {isAntigravity && (
              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold bg-accent/20 text-accent border border-accent/30">
                AGY
              </span>
            )}
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-accent/15 text-accent font-mono">
              {activeWorkspaceSessionCount}/6
            </span>
            <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
          </button>

          {isWorkspaceDropdownOpen && (
            <div
              className="absolute left-0 mt-1.5 w-64 rounded-xl bg-[#13151c] border border-white/[0.08] shadow-2xl py-1.5 z-50 text-xs backdrop-blur-md animate-dropdown-in origin-top-left"
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
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/[0.06] transition-colors press-scale ${
                      isCurrent ? 'text-accent font-medium bg-white/[0.03]' : 'text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isWsAgy ? (
                        <AntigravityIcon size={14} mode={isCurrent ? 'gradient' : 'accent'} className="shrink-0" />
                      ) : ws.is_worktree ? (
                        <GitBranch className="w-3.5 h-3.5 text-accent shrink-0" />
                      ) : (
                        <Layers className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      )}
                      <span className="truncate">{ws.name}</span>
                      {ws.branch && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono text-cyan-300 bg-cyan-500/15 border border-cyan-400/20 truncate max-w-[80px]">
                           {ws.branch}
                        </span>
                      )}
                      {isWsAgy && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold bg-accent/15 text-accent">
                          AGY
                        </span>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
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
                className="w-full flex items-center gap-2 px-3 py-2 text-accent hover:bg-accent/10 transition-colors font-medium press-scale"
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
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all duration-200 ease-apple press-scale ${
                  isActive
                    ? 'bg-accent text-[var(--veron-accent-fg,#000)] font-semibold shadow-sm shadow-accent'
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
        {/* Live Git Changes Pill */}
        <GitDiffPill status={gitStatus} onClick={onOpenGitDiff} />

        {/* Auto Port Detector Pill */}
        <PortIndicator ports={activePorts} onToast={onToast} />

        {/* Quick Add Menu / Launch Shell / AGY Dropdown */}
        <div className="relative">
          <button
            onClick={() => !isFull && setIsShellDropdownOpen(!isShellDropdownOpen)}
            disabled={isFull}
            title={
              isFull
                ? 'Workspace limit reached (max 6 windows)'
                : 'Quick Add Menu: Shells, AGY, Split & Workspaces'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ease-apple border press-scale ${
              isFull
                ? 'opacity-40 cursor-not-allowed bg-white/[0.02] border-white/[0.04] text-zinc-500'
                : 'bg-accent/10 hover:bg-accent/20 text-accent border-accent/30 shadow-accent'
            }`}
          >
            {isAntigravity ? (
              <AntigravityIcon size={14} mode="gradient" className="shrink-0" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-accent" />
            )}
            <span>{isFull ? '6/6 Full' : '+ Add'}</span>
            {!isFull && <ChevronDown className="w-3 h-3 opacity-60" />}
          </button>

          {isShellDropdownOpen && !isFull && (
            <div
              className="absolute right-0 mt-1.5 w-56 rounded-xl bg-[#13151c]/95 border border-white/[0.08] shadow-2xl py-1.5 z-50 text-xs backdrop-blur-md animate-dropdown-in origin-top-right divide-y divide-white/[0.06]"
              onClick={() => setIsShellDropdownOpen(false)}
            >
              {/* Shells Section */}
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-mono tracking-wider text-zinc-500 uppercase">
                  Launch Terminal / Agent
                </div>
                {systemInfo?.available_shells?.map((shell: ShellOption) => (
                  <button
                    key={shell.cmd}
                    onClick={() => onCreateSession(shell.cmd)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.06] text-zinc-300 hover:text-accent text-left transition-colors duration-150 press-scale"
                  >
                    <TermIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="truncate">{shell.name}</span>
                  </button>
                )) || (
                  <button
                    onClick={() => onCreateSession('powershell.exe')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.06] text-zinc-300 hover:text-accent text-left transition-colors duration-150 press-scale"
                  >
                    <TermIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span>PowerShell</span>
                  </button>
                )}
              </div>

              {/* Quick Actions Section */}
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-mono tracking-wider text-zinc-500 uppercase">
                  Quick Actions
                </div>
                {onSplit && (
                  <button
                    onClick={() => onSplit()}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/[0.06] text-zinc-300 hover:text-accent text-left transition-colors duration-150 press-scale"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Split Window</span>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500 px-1 py-0.2 bg-black/40 rounded border border-white/[0.06]">
                      Ctrl+Shift+T
                    </span>
                  </button>
                )}
                <button
                  onClick={() => onOpenCreateWorkspaceModal()}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.06] text-zinc-300 hover:text-accent text-left transition-colors duration-150 press-scale"
                >
                  <Layers className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>New Workspace Group...</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Scripts / Command Palette Button */}
        <button
          onClick={onOpenQuickScripts}
          title="Quick Scripts & Commands (Ctrl+K)"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] hover:text-accent text-zinc-300 rounded-md text-xs font-medium transition-all duration-200 ease-apple border border-white/[0.06] press-scale"
        >
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span className="hidden sm:inline">Scripts</span>
          <span className="hidden md:inline-block px-1.5 py-0.2 text-[10px] font-mono text-zinc-400 bg-black/40 rounded border border-white/[0.08]">
            Ctrl+K
          </span>
        </button>

        {/* Mobile Remote Button */}
        <button
          onClick={onOpenRemoteModal}
          title="Open Mobile Remote Control"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-accent/[0.08] text-accent border border-accent/20 hover:bg-accent/[0.15] transition-all duration-200 ease-apple press-scale"
        >
          <Smartphone className="w-3.5 h-3.5 text-accent" />
          <span className="hidden sm:inline">Phone Remote</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 rounded-md text-zinc-400 hover:text-accent bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all duration-200 ease-apple press-scale"
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};
