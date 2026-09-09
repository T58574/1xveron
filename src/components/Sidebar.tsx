import React, { useState } from 'react';
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Folder,
  Smartphone,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
  X,
  Layers,
  Image,
  Trash2,
} from 'lucide-react';
import { CapturesInfo, SessionInfo, SystemInfo, Workspace } from '../types';

interface SidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  workspaces: Workspace[];
  systemInfo: SystemInfo | null;
  capturesInfo: CapturesInfo | null;
  onClearCaptures: () => void;
  isOpen: boolean;
  onToggle: () => void;
  onSelectSession: (id: string) => void;
  onCreateSession: (shell?: string) => void;
  onCloseSession: (id: string) => void;
  onOpenRemoteModal: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  workspaces,
  systemInfo,
  capturesInfo,
  onClearCaptures,
  isOpen,
  onToggle,
  onSelectSession,
  onCreateSession,
  onCloseSession,
  onOpenRemoteModal,
  theme,
  onToggleTheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({
    default: true,
  });

  const toggleWorkspace = (id: string) => {
    setExpandedWorkspaces((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.cwd.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.shell.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isDark = theme === 'dark';

  if (!isOpen) {
    return (
      <div
        className={`w-12 flex flex-col items-center py-3 border-r transition-all duration-200 select-none ${
          isDark ? 'bg-[#0d0e12] border-white/[0.06]' : 'bg-zinc-100 border-zinc-200'
        }`}
      >
        <button
          onClick={onToggle}
          title="Expand Sidebar"
          className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-white/[0.05] transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="w-5 h-[1px] bg-white/[0.06] my-3" />

        <button
          onClick={() => onCreateSession()}
          title="New Terminal Instance"
          className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-white/[0.05] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="mt-auto flex flex-col items-center gap-2">
          <button
            onClick={onOpenRemoteModal}
            title="Mobile Wi-Fi Remote"
            className="p-2 rounded-lg text-amber-400 hover:bg-amber-400/10 transition-colors"
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleTheme}
            title="Toggle Theme"
            className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-white/[0.05] transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-64 flex flex-col h-full border-r select-none transition-all duration-200 shrink-0 ${
        isDark ? 'bg-[#0d0e12] border-white/[0.06] text-zinc-200' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
      }`}
    >
      {/* Brand Header */}
      <div className="h-11 px-3.5 flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-black text-[11px] shadow-sm shadow-amber-500/20">
            V
          </div>
          <span className="font-semibold text-xs tracking-wider uppercase text-zinc-100 font-mono">
            Veron
          </span>
        </div>

        <button
          onClick={onToggle}
          title="Collapse Sidebar"
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-white/[0.04]">
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
            isDark
              ? 'bg-[#12141a] border-white/[0.06] text-zinc-200 focus-within:border-amber-400/60'
              : 'bg-white border-zinc-200 text-zinc-700 focus-within:border-amber-500'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-xs placeholder:text-zinc-500 font-sans"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-zinc-300">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Workspaces & Session Groupings */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        <div className="flex items-center justify-between px-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            Workspaces
          </span>
          <button
            onClick={() => onCreateSession()}
            title="Create Session"
            className="p-1 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-amber-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {workspaces.map((ws) => {
          const wsSessions = filteredSessions.filter(
            (s) => s.workspace_id === ws.id || (!s.workspace_id && ws.id === 'default')
          );
          const isExpanded = expandedWorkspaces[ws.id] ?? true;

          return (
            <div key={ws.id} className="space-y-1">
              <button
                onClick={() => toggleWorkspace(ws.id)}
                className="w-full flex items-center justify-between px-2 py-1 rounded text-xs font-medium text-zinc-300 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                  <span className="truncate">{ws.name}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.06] text-zinc-400 font-mono">
                  {wsSessions.length}
                </span>
              </button>

              {isExpanded && (
                <div className="space-y-1 pl-2">
                  {wsSessions.map((session) => {
                    const isSelected = activeSessionId === session.id;
                    return (
                      <div
                        key={session.id}
                        onClick={() => onSelectSession(session.id)}
                        className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? isDark
                              ? 'bg-white/[0.06] text-white border-l-2 border-amber-400 rounded-l-none font-medium'
                              : 'bg-amber-50 text-amber-950 border-l-2 border-amber-500 rounded-l-none font-medium'
                            : isDark
                            ? 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
                            : 'text-zinc-600 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              session.is_alive ? 'bg-amber-400' : 'bg-zinc-600'
                            }`}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs font-medium tracking-tight">
                              {session.name}
                            </span>
                            <span className="truncate text-[10px] text-zinc-500 flex items-center gap-1">
                              <Folder className="w-2.5 h-2.5 shrink-0 text-zinc-500" />
                              {session.cwd.split('\\').pop() || session.cwd}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCloseSession(session.id);
                          }}
                          title="Close Session"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-red-400 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Panel */}
      <div className="p-2.5 border-t border-white/[0.06] flex flex-col gap-2">
        {/* Captures Folder Info Widget */}
        {capturesInfo && capturesInfo.count > 0 && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs">
            <div className="flex items-center gap-1.5 text-zinc-300 text-[11px] truncate">
              <Image className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                {capturesInfo.count} capture{capturesInfo.count > 1 ? 's' : ''} ({capturesInfo.size_formatted})
              </span>
            </div>
            <button
              onClick={onClearCaptures}
              title="Clear all screenshots"
              className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Mobile Remote Launcher */}
        <button
          onClick={onOpenRemoteModal}
          title="Open Mobile Remote Control"
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-amber-400/[0.08] border border-amber-400/20 hover:bg-amber-400/[0.14] text-amber-300 text-xs transition-all duration-150"
        >
          <div className="flex items-center gap-2 truncate">
            <Smartphone className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <div className="flex flex-col items-start truncate">
              <span className="font-medium text-[11px] text-amber-200">Phone Remote</span>
              <span className="text-[10px] text-zinc-400 truncate font-mono">
                {systemInfo?.lan_url ? systemInfo.lan_url.replace('http://', '').split('?')[0] : '192.168.x.x:4567'}
              </span>
            </div>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        </button>

        {/* Theme Action */}
        <div className="flex items-center justify-between pt-0.5">
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-white/[0.04] transition-colors"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
