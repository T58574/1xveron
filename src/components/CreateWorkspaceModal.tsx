import React, { useState, useEffect } from 'react';
import { Terminal, Folder, X, Sparkles, LayoutGrid, GitBranch } from 'lucide-react';
import { LayoutMode, ShellOption } from '../types';
import { AntigravityIcon } from './AntigravityIcon';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    path?: string,
    shell?: string,
    kind?: 'antigravity' | 'terminal',
    windowCount?: LayoutMode,
    useWorktree?: boolean,
    branch?: string
  ) => Promise<void>;
  availableShells?: ShellOption[];
  defaultPath?: string;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  availableShells,
  defaultPath = '',
}) => {
  const [selectedKind, setSelectedKind] = useState<'antigravity' | 'terminal'>('antigravity');
  const [name, setName] = useState('Antigravity');
  const [path, setPath] = useState('');
  const [windowCount, setWindowCount] = useState<LayoutMode>(1);
  const [useWorktree, setUseWorktree] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [selectedShell, setSelectedShell] = useState(
    availableShells?.[0]?.cmd || 'powershell.exe'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSelectKind = (kind: 'antigravity' | 'terminal') => {
    setSelectedKind(kind);
    if (kind === 'antigravity') {
      setName('Antigravity');
      setPath(defaultPath);
    } else {
      setName('Terminal Workspace');
      setPath('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Workspace name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const generatedBranch = branchName.trim() || trimmedName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      await onCreate(
        trimmedName,
        path.trim() || undefined,
        selectedShell,
        selectedKind,
        windowCount,
        useWorktree,
        useWorktree ? generatedBranch : undefined
      );
      setName('Antigravity');
      setPath('');
      setBranchName('');
      setUseWorktree(false);
      setWindowCount(1);
      setSelectedKind('antigravity');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLayoutLabel = (count: LayoutMode) => {
    switch (count) {
      case 1:
        return '1 окно (Single)';
      case 2:
        return '2 окна (2 Columns)';
      case 3:
        return '3 окна (1 Left + 2 Stacked)';
      case 4:
        return '4 окна (2x2 Grid)';
      case 5:
        return '5 окон (2 Top + 3 Bottom)';
      case 6:
        return '6 окон (2x3 Grid)';
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-overlay-in select-none"
    >
      <div className="w-full max-w-lg bg-[#0d0e13] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-dialog-in will-change-transform">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-[#12141a]">
          <div className="flex items-center gap-2.5 text-zinc-100 font-semibold text-sm">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/25 text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>New Workspace Group</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-colors press-scale"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Type Selection Cards: Antigravity vs Terminal */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Select Workspace Type
            </label>
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Option 1: Antigravity */}
              <div
                onClick={() => handleSelectKind('antigravity')}
                className={`relative flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                  selectedKind === 'antigravity'
                    ? 'bg-amber-400/[0.08] border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.15)] ring-1 ring-amber-400/40'
                    : 'bg-[#12141c] border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-black/40 border border-white/[0.08] flex items-center justify-center">
                    <AntigravityIcon size={20} mode="gradient" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    AI Agent
                  </span>
                </div>

                <div className="font-semibold text-xs text-zinc-100 mb-1 flex items-center gap-1.5">
                  <span>Antigravity</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight">
                  Автоматически запускает <span className="font-mono text-amber-300">agy</span> в консоли. Все окна группы работают с AI агентом.
                </p>
              </div>

              {/* Option 2: Standard Terminal */}
              <div
                onClick={() => handleSelectKind('terminal')}
                className={`relative flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                  selectedKind === 'terminal'
                    ? 'bg-amber-400/[0.08] border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.15)] ring-1 ring-amber-400/40'
                    : 'bg-[#12141c] border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-black/40 border border-white/[0.08] flex items-center justify-center text-zinc-300">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-400 border border-white/[0.06]">
                    Shell
                  </span>
                </div>

                <div className="font-semibold text-xs text-zinc-100 mb-1">
                  Terminal
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight">
                  Обычные консольные сессии (PowerShell, CMD, Bash, WSL). До 6 окон в группе.
                </p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                <span>Workspace Name</span>
                <span className="text-zinc-500 text-[11px]">до 6 окон на экран</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={selectedKind === 'antigravity' ? 'Antigravity' : 'My Project'}
                className="w-full px-3 py-2 rounded-lg bg-[#141720] border border-white/[0.08] text-zinc-100 text-xs focus:outline-none focus:border-amber-400/70 transition-colors font-medium"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-zinc-400" />
                <span>Working Directory (Base Repo)</span>
              </label>
              <input
                type="text"
                placeholder={defaultPath || 'C:\\Users\\user\\Documents\\dev\\veron'}
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141720] border border-white/[0.08] text-zinc-100 text-xs focus:outline-none focus:border-amber-400/70 transition-colors font-mono placeholder:text-zinc-600"
              />
            </div>

            {/* Git Worktree Isolation Card */}
            <div className="p-3 rounded-xl bg-[#131622] border border-white/[0.08] space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg border transition-colors ${
                      useWorktree
                        ? 'bg-amber-400/20 border-amber-400/40 text-amber-300'
                        : 'bg-black/40 border-white/[0.08] text-zinc-400'
                    }`}
                  >
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                      <span>Git Worktree Isolation</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/15 text-amber-300 font-mono font-bold">
                        NEW BRANCH
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Изолированная ветка в <span className="font-mono text-zinc-300">.veron/worktrees/</span>
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={useWorktree}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseWorktree(checked);
                    if (checked && !branchName) {
                      setBranchName(name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
                    }
                  }}
                  className="w-4 h-4 rounded border-white/20 bg-black/40 text-amber-400 focus:ring-amber-400/40 cursor-pointer accent-amber-400"
                />
              </label>

              {useWorktree && (
                <div className="pt-2 border-t border-white/[0.05] space-y-1 animate-in fade-in duration-150">
                  <label className="text-[11px] font-medium text-zinc-300 block">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder={name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'feat/agent-branch'}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0d0e14] border border-amber-400/50 text-amber-300 text-xs focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Агенты в этой группе не смогут случайно перезаписать или сломать основную ветку репозитория.
                  </p>
                </div>
              )}
            </div>

            {selectedKind === 'antigravity' ? (
              <div className="p-2.5 rounded-lg bg-[#12141c] border border-amber-400/20 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Команда автозапуска:</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-black/60 font-mono text-amber-400 font-semibold border border-amber-400/30">
                  agy
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Default Shell</span>
                </label>
                <select
                  value={selectedShell}
                  onChange={(e) => setSelectedShell(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#141720] border border-white/[0.08] text-zinc-100 text-xs focus:outline-none focus:border-amber-400/70 transition-colors font-sans"
                >
                  {availableShells?.map((shell) => (
                    <option key={shell.cmd} value={shell.cmd} className="bg-[#141720] text-zinc-100">
                      {shell.name} ({shell.cmd})
                    </option>
                  )) || (
                    <option value="powershell.exe" className="bg-[#141720] text-zinc-100">
                      PowerShell
                    </option>
                  )}
                </select>
              </div>
            )}

            {/* Initial Windows Count Selector (1 to 6) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-zinc-300 flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-amber-400" />
                  <span>Сколько окон открыть сразу</span>
                </label>
                <span className="text-amber-400 font-semibold font-mono text-[11px]">
                  {getLayoutLabel(windowCount)}
                </span>
              </div>

              <div className="grid grid-cols-6 gap-1.5 p-1 bg-[#141720] border border-white/[0.08] rounded-xl">
                {([1, 2, 3, 4, 5, 6] as LayoutMode[]).map((count) => {
                  const isSelected = windowCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setWindowCount(count)}
                      className={`flex flex-col items-center justify-center py-2 rounded-lg text-xs transition-all duration-150 ${
                        isSelected
                          ? 'bg-amber-400 text-black shadow-md font-bold'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="font-mono text-sm">{count}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-500">
                {selectedKind === 'antigravity'
                  ? `При создании откроется сразу ${windowCount} ${windowCount === 1 ? 'окно' : windowCount < 5 ? 'окна' : 'окон'} с запущенными сессиями agy.`
                  : `При создании сразу откроется сетка из ${windowCount} ${windowCount === 1 ? 'терминала' : windowCount < 5 ? 'терминалов' : 'терминалов'}.`}
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black transition-all shadow-sm flex items-center gap-1.5"
            >
              {isSubmitting ? (
                'Creating...'
              ) : selectedKind === 'antigravity' ? (
                <>
                  <AntigravityIcon size={14} mode="monochrome" />
                  <span>Create Antigravity Workspace ({windowCount})</span>
                </>
              ) : (
                <>
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Create Workspace ({windowCount})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
