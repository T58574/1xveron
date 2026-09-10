import React, { useState } from 'react';
import { Terminal, Folder, X, Sparkles, LayoutGrid } from 'lucide-react';
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
    windowCount?: LayoutMode
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
  const [selectedShell, setSelectedShell] = useState(
    availableShells?.[0]?.cmd || 'powershell.exe'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await onCreate(
        trimmedName,
        path.trim() || undefined,
        selectedShell,
        selectedKind,
        windowCount
      );
      setName('Antigravity');
      setPath('');
      setWindowCount(1);
      setSelectedKind('antigravity');
      onClose();
    } catch (err) {
      setError('Failed to create workspace');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-lg bg-[#0d0e13] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
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
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-colors"
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
                <span>Working Directory</span>
              </label>
              <input
                type="text"
                placeholder={defaultPath || 'C:\\Users\\user\\Documents\\dev\\veron'}
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#141720] border border-white/[0.08] text-zinc-100 text-xs focus:outline-none focus:border-amber-400/70 transition-colors font-mono placeholder:text-zinc-600"
              />
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
