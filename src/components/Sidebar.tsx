import React, { useState } from 'react';
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Folder,
  PanelLeftClose,
  PanelLeft,
  X,
  Layers,
  Edit2,
  Check,
  Settings,
  Trash2,
  GitBranch,
} from 'lucide-react';
import { SessionInfo, Workspace } from '../types';
import { AntigravityIcon } from './AntigravityIcon';

interface SidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onOpenCreateWorkspaceModal: () => void;
  onDeleteWorkspace: (id: string) => void;
  onRenameWorkspace: (id: string, newName: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onSelectSession: (id: string, workspaceId: string) => void;
  onCreateSession: (shell?: string, workspaceId?: string) => void;
  onCloseSession: (id: string) => void;
  onOpenSettingsModal: () => void;
  theme: 'dark' | 'light';
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenCreateWorkspaceModal,
  onDeleteWorkspace,
  onRenameWorkspace,
  isOpen,
  onToggle,
  onSelectSession,
  onCreateSession,
  onCloseSession,
  onOpenSettingsModal,
  theme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({
    default: true,
  });
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('');

  const toggleWorkspace = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedWorkspaces((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const startRenaming = (ws: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWorkspaceId(ws.id);
    setEditingWorkspaceName(ws.name);
  };

  const saveWorkspaceName = (id: string) => {
    if (editingWorkspaceName.trim()) {
      onRenameWorkspace(id, editingWorkspaceName.trim());
    }
    setEditingWorkspaceId(null);
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.cwd.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.shell.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isDark = theme === 'dark';

  return (
    <aside
      className={`flex flex-col h-full border-r select-none transition-[width] duration-300 ease-apple shrink-0 overflow-hidden ${
        isOpen ? 'w-64' : 'w-14'
      } ${
        isDark ? 'bg-[#0d0e12] border-white/[0.06] text-zinc-200' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
      }`}
    >
      {/* Brand Header */}
      <div className="h-11 px-3 flex items-center justify-between border-b border-white/[0.06] shrink-0">
        <div
          className={`flex items-center gap-2.5 overflow-hidden transition-all duration-300 ease-apple ${
            isOpen ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0 pointer-events-none'
          }`}
        >
          <div className="w-5 h-5 rounded bg-accent flex items-center justify-center font-bold text-[var(--veron-accent-fg,#000)] text-[11px] shadow-sm shadow-accent shrink-0">
            V
          </div>
          <span className="font-semibold text-xs tracking-wider uppercase text-zinc-100 font-mono truncate">
            Veron
          </span>
        </div>

        <button
          onClick={onToggle}
          title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          className={`p-1.5 rounded-lg text-zinc-400 hover:text-accent hover:bg-white/[0.06] transition-colors shrink-0 press-scale ${
            !isOpen ? 'mx-auto' : ''
          }`}
        >
          {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
        </button>
      </div>

      {!isOpen ? (
        <div className="flex-1 flex flex-col items-center py-3 gap-1 overflow-y-auto custom-scrollbar">
          {workspaces.map((ws) => {
            const isCurrent = ws.id === activeWorkspaceId;
            const isWsAgy =
              ws.kind === 'antigravity' ||
              ws.name.toLowerCase().includes('antigravity') ||
              ws.name.toLowerCase().includes('agy');

            return (
              <button
                key={ws.id}
                onClick={() => onSelectWorkspace(ws.id)}
                title={ws.name}
                className={`p-2 rounded-xl transition-all press-scale relative group ${
                  isCurrent
                    ? 'bg-accent/15 text-accent ring-1 ring-accent/40'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
              >
                {isWsAgy ? (
                  <AntigravityIcon size={16} mode={isCurrent ? 'gradient' : 'accent'} />
                ) : ws.is_worktree ? (
                  <GitBranch className="w-4 h-4 text-accent" />
                ) : (
                  <Layers className="w-4 h-4" />
                )}
              </button>
            );
          })}

          <div className="w-5 h-[1px] bg-white/[0.06] my-2" />

          <button
            onClick={onOpenCreateWorkspaceModal}
            title="New Workspace Group"
            className="p-2 rounded-xl text-zinc-400 hover:text-accent hover:bg-white/[0.05] transition-all press-scale"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={() => onCreateSession(undefined, activeWorkspaceId)}
            title="New Terminal in Active Workspace"
            className="p-2 rounded-xl text-zinc-400 hover:text-accent hover:bg-white/[0.05] transition-all press-scale mt-1"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div className="mt-auto flex flex-col items-center pt-2">
            <button
              onClick={onOpenSettingsModal}
              title="Settings"
              className="p-2 rounded-xl text-zinc-400 hover:text-accent hover:bg-white/[0.05] transition-all press-scale"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>

      {/* Search Input */}
      <div className="p-2.5 border-b border-white/[0.04]">
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
            isDark
              ? 'bg-[#12141a] border-white/[0.06] text-zinc-200 focus-within:border-accent/60'
              : 'bg-white border-zinc-200 text-zinc-700 focus-within:border-accent'
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
            <Layers className="w-3.5 h-3.5 text-accent" />
            Workspace Groups
          </span>
          <button
            onClick={onOpenCreateWorkspaceModal}
            title="Create New Workspace Group"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-accent transition-colors text-[10px] lowercase font-normal"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>new</span>
          </button>
        </div>

        {workspaces.map((ws) => {
          const wsSessions = filteredSessions.filter(
            (s) => s.workspace_id === ws.id || (!s.workspace_id && ws.id === 'default')
          );
          const isExpanded = expandedWorkspaces[ws.id] ?? true;
          const isActiveWs = activeWorkspaceId === ws.id;
          const isRenaming = editingWorkspaceId === ws.id;
          const isFull = wsSessions.length >= 6;
          const isAntigravity =
            ws.kind === 'antigravity' ||
            ws.name.toLowerCase().includes('antigravity') ||
            ws.name.toLowerCase().includes('agy');

          return (
            <div
              key={ws.id}
              className={`rounded-lg transition-all duration-150 border ${
                isActiveWs
                  ? isDark
                    ? isAntigravity
                      ? 'bg-[#12141c]/90 border-accent/50 shadow-sm shadow-accent'
                      : 'bg-[#12141c]/90 border-accent/40 shadow-sm shadow-accent'
                    : 'bg-accent/10 border-accent/50 shadow-sm'
                  : isDark
                  ? 'bg-transparent border-transparent hover:bg-white/[0.02]'
                  : 'bg-transparent border-transparent hover:bg-zinc-100/60'
              }`}
            >
              {/* Workspace Group Header Card */}
              <div
                onClick={() => {
                  onSelectWorkspace(ws.id);
                  setExpandedWorkspaces((prev) => ({ ...prev, [ws.id]: true }));
                }}
                className="group w-full flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                  <button
                    onClick={(e) => toggleWorkspace(ws.id, e)}
                    className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <div className="flex flex-col min-w-0 flex-1">
                    {isRenaming ? (
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingWorkspaceName}
                          onChange={(e) => setEditingWorkspaceName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveWorkspaceName(ws.id);
                            if (e.key === 'Escape') setEditingWorkspaceId(null);
                          }}
                          onBlur={() => saveWorkspaceName(ws.id)}
                          className="w-24 px-1 py-0.5 text-xs bg-[#090a0d] border border-accent rounded text-zinc-100 outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => saveWorkspaceName(ws.id)}
                          className="text-accent hover:text-accent/80"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isAntigravity ? (
                          <AntigravityIcon
                            size={14}
                            mode={isActiveWs ? 'gradient' : 'accent'}
                            className="shrink-0"
                          />
                        ) : ws.is_worktree ? (
                          <GitBranch className="w-3.5 h-3.5 text-accent shrink-0" />
                        ) : (
                          <Layers className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        )}
                        <span
                          onDoubleClick={(e) => startRenaming(ws, e)}
                          title="Click to switch workspace, double-click to rename"
                          className={`truncate text-xs font-semibold tracking-tight min-w-0 flex-1 ${
                            isActiveWs
                              ? 'text-accent'
                              : 'text-zinc-300 group-hover:text-zinc-100'
                          }`}
                        >
                          {ws.name}
                        </span>
                        {ws.branch && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono text-cyan-300 bg-cyan-500/15 border border-cyan-400/20 truncate max-w-[65px] shrink-0">
                             {ws.branch}
                          </span>
                        )}
                        {isAntigravity && !ws.name.toLowerCase().includes('antigravity') && !ws.name.toLowerCase().includes('agy') && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold bg-accent/20 text-accent border border-accent/30 shrink-0">
                            AGY
                          </span>
                        )}
                        {isActiveWs && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 shadow-[0_0_6px_var(--veron-accent-glow)]" />
                        )}
                      </div>
                    )}

                    <span className="truncate text-[10px] text-zinc-500 flex items-center gap-1">
                      <Folder className="w-2.5 h-2.5 shrink-0" />
                      {ws.path ? ws.path.split('\\').pop() || ws.path : 'veron'}
                    </span>
                  </div>
                </div>

                {/* Right controls on workspace item */}
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    title={`${wsSessions.length} of max 6 sessions`}
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isActiveWs
                        ? 'bg-accent/20 text-accent font-semibold'
                        : 'bg-white/[0.06] text-zinc-400'
                    }`}
                  >
                    {wsSessions.length}/6
                  </span>

                  {/* Add session to this workspace */}
                  <button
                    disabled={isFull}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectWorkspace(ws.id);
                      onCreateSession(undefined, ws.id);
                    }}
                    title={isFull ? 'Workspace limit reached (6 max)' : 'Add terminal to this workspace'}
                    className={`p-1 rounded transition-colors ${
                      isFull
                        ? 'opacity-30 cursor-not-allowed text-zinc-600'
                        : 'text-zinc-400 hover:text-accent hover:bg-white/[0.08]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* Rename workspace */}
                  <button
                    onClick={(e) => startRenaming(ws, e)}
                    title="Rename Workspace"
                    className="hidden group-hover:block p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 transition-all"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  {/* Delete workspace (only if more than 1 workspace exists) */}
                  {workspaces.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            `Delete workspace "${ws.name}" and terminate all its ${wsSessions.length} terminal sessions?`
                          )
                        ) {
                          onDeleteWorkspace(ws.id);
                        }
                      }}
                      title="Delete Workspace Group"
                      className="hidden group-hover:block p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sessions list inside this workspace group */}
              {isExpanded && (
                <div className="space-y-0.5 px-1.5 pb-1.5 pt-0.5">
                  {wsSessions.length === 0 ? (
                    <div className="px-3 py-2 text-center">
                      <p className="text-[11px] text-zinc-500 mb-1.5">No terminal windows</p>
                      <button
                        onClick={() => {
                          onSelectWorkspace(ws.id);
                          onCreateSession(undefined, ws.id);
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded bg-white/[0.04] hover:bg-accent/10 hover:text-accent text-zinc-400 transition-colors"
                      >
                        {isAntigravity ? <AntigravityIcon size={12} mode="gradient" /> : <Plus className="w-3 h-3" />}
                        <span>{isAntigravity ? 'Launch AGY Session' : 'Launch Terminal'}</span>
                      </button>
                    </div>
                  ) : (
                    wsSessions.map((session) => {
                      const isSelected = activeSessionId === session.id;
                      return (
                        <div
                          key={session.id}
                          onClick={() => onSelectSession(session.id, ws.id)}
                          className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-all duration-150 ${
                            isSelected
                              ? isDark
                                ? 'bg-accent/10 text-white border-l-2 border-accent font-medium'
                                : 'bg-accent/15 text-zinc-950 border-l-2 border-accent font-medium'
                              : isDark
                              ? 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
                              : 'text-zinc-600 hover:bg-zinc-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            {isAntigravity ? (
                              <AntigravityIcon
                                size={13}
                                mode={session.is_alive ? 'gradient' : 'monochrome'}
                                className="shrink-0"
                              />
                            ) : (
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  session.is_alive
                                    ? 'bg-accent shadow-[0_0_4px_var(--veron-accent-glow)]'
                                    : 'bg-zinc-600'
                                }`}
                              />
                            )}
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
                            title="Close Terminal"
                            className="hidden group-hover:block p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-red-400 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Panel */}
      <div className="p-2.5 border-t border-white/[0.06] shrink-0">
        <button
          onClick={onOpenSettingsModal}
          title="Open Settings"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-all duration-150 group press-scale"
        >
          <Settings className="w-4 h-4 text-zinc-400 group-hover:text-accent transition-colors" />
          <span>Settings</span>
        </button>
      </div>
        </>
      )}
    </aside>
  );
};
