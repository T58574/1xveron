import React, { useState } from 'react';
import {
  Terminal as TermIcon,
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
        className={`w-12 flex flex-col items-center py-3 border-r transition-all select-none ${
          isDark ? 'bg-[#15171e] border-zinc-800/70' : 'bg-slate-100 border-slate-200'
        }`}
      >
        <button
          onClick={onToggle}
          title="Expand Sidebar"
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="w-6 h-[1px] bg-zinc-800/80 my-3" />

        <button
          onClick={() => onCreateSession()}
          title="New Terminal Instance"
          className="p-2 rounded-lg text-zinc-400 hover:text-sky-400 hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="mt-auto flex flex-col items-center gap-3">
          <button
            onClick={onOpenRemoteModal}
            title="Mobile Wi-Fi Remote"
            className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-950/40 transition-colors"
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleTheme}
            title="Toggle Dark/Light"
            className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 transition-colors"
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
        isDark ? 'bg-[#14151b] border-zinc-800/70 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}
    >
      {/* Brand & Toggle Header */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-md shadow-sky-500/20">
            V
          </div>
          <span className="font-semibold text-sm tracking-wide text-zinc-100">Veron</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-mono">
            ConPTY
          </span>
        </div>

        <button
          onClick={onToggle}
          title="Collapse Sidebar"
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-zinc-800/40">
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
            isDark
              ? 'bg-[#1a1c24] border-zinc-800 text-zinc-200 focus-within:border-sky-500/60'
              : 'bg-white border-slate-200 text-slate-700 focus-within:border-sky-500'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder="Search sessions, cwd..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-xs placeholder:text-zinc-500"
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
        <div className="flex items-center justify-between px-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            Workspaces
          </span>
          <button
            onClick={() => onCreateSession()}
            title="Create New Session"
            className="p-1 rounded hover:bg-zinc-800/80 text-zinc-400 hover:text-sky-400 transition-colors"
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
                className="w-full flex items-center justify-between px-2 py-1 rounded text-xs font-medium text-zinc-300 hover:bg-zinc-800/40 group transition-colors"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                  <span className="truncate">{ws.name}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
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
                        className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                          isSelected
                            ? isDark
                              ? 'bg-zinc-800/80 text-white font-medium shadow-sm border border-zinc-700/60'
                              : 'bg-sky-50 text-sky-900 border border-sky-200'
                            : isDark
                            ? 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              session.is_alive ? 'bg-emerald-400 active-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-zinc-600'
                            }`}
                          />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1">
                              <TermIcon className="w-3 h-3 text-sky-400 shrink-0" />
                              <span className="truncate text-xs">{session.name}</span>
                            </div>
                            <span className="truncate text-[10px] opacity-60 flex items-center gap-1">
                              <Folder className="w-2.5 h-2.5 shrink-0 text-amber-400/80" />
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
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                  {wsSessions.length === 0 && (
                    <div className="px-4 py-2 text-[11px] text-zinc-500 italic">
                      No active sessions
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Status & Remote Badge */}
      <div className="p-3 border-t border-zinc-800/60 flex flex-col gap-2">
        {/* Captures Folder Info Widget */}
        {capturesInfo && capturesInfo.count > 0 && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs">
            <div className="flex items-center gap-1.5 text-zinc-300 text-[11px] truncate">
              <Image className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">
                {capturesInfo.count} capture{capturesInfo.count > 1 ? 's' : ''} ({capturesInfo.size_formatted})
              </span>
            </div>
            <button
              onClick={onClearCaptures}
              title="Clear all screenshots"
              className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700/60 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Mobile Couch Mode Launcher */}
        <button
          onClick={onOpenRemoteModal}
          title="Open Remote Control QR & Local IP"
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 hover:bg-emerald-900/40 text-emerald-300 text-xs transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <Smartphone className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <div className="flex flex-col items-start truncate">
              <span className="font-semibold text-[11px]">Phone Remote</span>
              <span className="text-[10px] opacity-80 truncate font-mono">
                {systemInfo?.lan_url ? systemInfo.lan_url.replace('http://', '') : '192.168.x.x:4567'}
              </span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </button>

        {/* Theme and Quick Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800/50 transition-colors"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>

          <span className="text-[10px] text-zinc-500 font-mono">Veron v0.1</span>
        </div>
      </div>
    </div>
  );
};
