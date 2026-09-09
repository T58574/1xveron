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
} from 'lucide-react';
import { LayoutMode, ShellOption, SystemInfo } from '../types';

interface TopBarProps {
  layoutMode: LayoutMode;
  onChangeLayout: (mode: LayoutMode) => void;
  systemInfo: SystemInfo | null;
  onOpenRemoteModal: () => void;
  onCreateSession: (shell?: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  layoutMode,
  onChangeLayout,
  systemInfo,
  onOpenRemoteModal,
  onCreateSession,
  theme,
  onToggleTheme,
}) => {
  const [isShellDropdownOpen, setIsShellDropdownOpen] = useState(false);
  const isDark = theme === 'dark';

  const layoutIcons: { mode: LayoutMode; label: string; icon: React.ReactNode }[] = [
    { mode: 1, label: '1 Pane', icon: <Square className="w-3.5 h-3.5" /> },
    { mode: 2, label: '2 Panes', icon: <Columns2 className="w-3.5 h-3.5" /> },
    { mode: 3, label: '3 Panes', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { mode: 4, label: '4 Panes', icon: <Grid2X2 className="w-3.5 h-3.5" /> },
    { mode: 5, label: '5 Panes', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
    { mode: 6, label: '6 Panes', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
  ];

  return (
    <header
      className={`h-11 px-4 flex items-center justify-between border-b select-none transition-colors z-20 ${
        isDark ? 'bg-[#14151b] border-zinc-800/70 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}
    >
      {/* Center Layout Selector (1 - 6 Windows) */}
      <div className="flex items-center gap-1 bg-zinc-800/40 p-0.5 rounded-lg border border-zinc-800/60">
        {layoutIcons.map(({ mode, label, icon }) => {
          const isActive = layoutMode === mode;
          return (
            <button
              key={mode}
              onClick={() => onChangeLayout(mode)}
              title={label}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              }`}
            >
              {icon}
              <span>{mode}</span>
            </button>
          );
        })}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Launch Shell Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsShellDropdownOpen(!isShellDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-medium transition-colors border border-zinc-700/50"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>New Shell</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {isShellDropdownOpen && (
            <div
              className="absolute right-0 mt-1.5 w-48 rounded-lg bg-[#1a1c24] border border-zinc-800 shadow-xl py-1 z-50 text-xs"
              onClick={() => setIsShellDropdownOpen(false)}
            >
              {systemInfo?.available_shells?.map((shell: ShellOption) => (
                <button
                  key={shell.cmd}
                  onClick={() => onCreateSession(shell.cmd)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/80 text-zinc-300 text-left transition-colors"
                >
                  <TermIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>{shell.name}</span>
                </button>
              )) || (
                <button
                  onClick={() => onCreateSession('powershell.exe')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/80 text-zinc-300 text-left"
                >
                  <TermIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>PowerShell</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Mobile Phone Remote Access Button */}
        <button
          onClick={onOpenRemoteModal}
          title="Open Mobile Remote Control"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/40 transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Phone Remote</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title="Toggle Dark / Light"
          className="p-1.5 rounded-md text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/50 transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
