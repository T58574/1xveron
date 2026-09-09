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
      className={`h-11 px-4 flex items-center justify-between border-b select-none transition-colors duration-150 z-20 ${
        isDark ? 'bg-[#0d0e12] border-white/[0.06] text-zinc-300' : 'bg-zinc-50 border-zinc-200 text-zinc-700'
      }`}
    >
      {/* Apple-grade Segmented Control for Layouts 1 - 6 */}
      <div className="flex items-center bg-[#13141a] p-0.5 rounded-lg border border-white/[0.06]">
        {layoutIcons.map(({ mode, label, icon }) => {
          const isActive = layoutMode === mode;
          return (
            <button
              key={mode}
              onClick={() => onChangeLayout(mode)}
              title={label}
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

      {/* Right Action Tools */}
      <div className="flex items-center gap-2">
        {/* Launch Shell Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsShellDropdownOpen(!isShellDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] hover:text-amber-400 text-zinc-300 rounded-md text-xs font-medium transition-all duration-150 border border-white/[0.06]"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>New Shell</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {isShellDropdownOpen && (
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
