import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Terminal,
  Play,
  Plus,
  Trash2,
  Sparkles,
  Command,
  Cpu,
  GitBranch,
  Wrench,
  CornerDownLeft,
} from 'lucide-react';
import { QuickScript } from '../types';

interface QuickScriptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteScript: (command: string, autoExecute?: boolean) => void;
  activeSessionName?: string;
}

const DEFAULT_SCRIPTS: QuickScript[] = [
  // System
  {
    id: 'sys-clear-screen',
    title: 'Clear Screen / Reset Terminal',
    command: 'Clear-Host',
    category: 'system',
    description: 'Clears terminal display and resets buffer',
    autoExecute: true,
  },
  {
    id: 'sys-top-cpu',
    title: 'Top 5 CPU Heavy Processes',
    command: 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 ProcessName, CPU, WorkingSet64',
    category: 'system',
    description: 'List most demanding Windows processes',
    autoExecute: true,
  },
  {
    id: 'sys-ipconfig',
    title: 'IPv4 Network Config',
    command: 'ipconfig | Select-String "IPv4 Address"',
    category: 'system',
    description: 'Display local network IP addresses',
    autoExecute: true,
  },
  {
    id: 'sys-flush-dns',
    title: 'Flush DNS Resolver Cache',
    command: 'ipconfig /flushdns',
    category: 'system',
    description: 'Clears Windows DNS cache',
    autoExecute: true,
  },
  // Git
  {
    id: 'git-status',
    title: 'Git Status (Short)',
    command: 'git status -s',
    category: 'git',
    description: 'Compact view of modified files',
    autoExecute: true,
  },
  {
    id: 'git-pull',
    title: 'Git Pull Origin',
    command: 'git pull',
    category: 'git',
    description: 'Pull latest changes from remote',
    autoExecute: true,
  },
  {
    id: 'git-log',
    title: 'Git Recent Commits (Graph)',
    command: 'git log --oneline -n 6 --graph --decorate',
    category: 'git',
    description: 'Show last 6 commits cleanly',
    autoExecute: true,
  },
  {
    id: 'git-diff',
    title: 'Git Diff Summary',
    command: 'git diff --stat',
    category: 'git',
    description: 'Summary of changed files and lines',
    autoExecute: true,
  },
  // Dev & Veron
  {
    id: 'dev-cargo-check',
    title: 'Cargo Check (Backend)',
    command: 'cargo check',
    category: 'dev',
    description: 'Fast compile validation for Rust',
    autoExecute: true,
  },
  {
    id: 'dev-npm-build',
    title: 'NPM Build (Frontend)',
    command: 'npm run build',
    category: 'dev',
    description: 'Compile TypeScript and Vite bundle',
    autoExecute: true,
  },
  {
    id: 'veron-open-captures',
    title: 'Open Captures in Explorer',
    command: 'Invoke-Item .veron/captures',
    category: 'dev',
    description: 'Reveal screenshot captures folder in Windows Explorer',
    autoExecute: true,
  },
  {
    id: 'veron-list-captures',
    title: 'List Screenshot Captures',
    command: 'Get-ChildItem .veron/captures',
    category: 'dev',
    description: 'Display files saved in .veron/captures',
    autoExecute: true,
  },
  {
    id: 'veron-clear',
    title: 'Clear Screen',
    command: 'Clear-Host',
    category: 'dev',
    description: 'Clear the terminal screen buffer',
    autoExecute: true,
  },
];

const STORAGE_KEY = 'veron_custom_scripts_v1';

export const QuickScriptsModal: React.FC<QuickScriptsModalProps> = ({
  isOpen,
  onClose,
  onExecuteScript,
  activeSessionName,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customScripts, setCustomScripts] = useState<QuickScript[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newAutoExecute, setNewAutoExecute] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load custom scripts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCustomScripts(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load custom scripts:', e);
    }
  }, []);

  // Save custom scripts to localStorage
  const saveCustomScripts = (scripts: QuickScript[]) => {
    setCustomScripts(scripts);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
    } catch (e) {
      console.error('Failed to save custom scripts:', e);
    }
  };

  const allScripts = useMemo(() => {
    return [...DEFAULT_SCRIPTS, ...customScripts];
  }, [customScripts]);

  const filteredScripts = useMemo(() => {
    return allScripts.filter((s) => {
      const matchesCategory =
        selectedCategory === 'all' || s.category === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.command.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [allScripts, selectedCategory, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search, selectedCategory]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setIsAddingNew(false);
      setSearch('');
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (isAddingNew) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredScripts.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? Math.max(0, filteredScripts.length - 1) : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredScripts[selectedIndex]) {
        runScript(filteredScripts[selectedIndex]);
      }
    }
  };

  const runScript = (script: QuickScript) => {
    onExecuteScript(script.command, script.autoExecute ?? true);
    onClose();
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCommand.trim()) return;

    const newScript: QuickScript = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      command: newCommand.trim(),
      category: 'custom',
      autoExecute: newAutoExecute,
    };

    const updated = [...customScripts, newScript];
    saveCustomScripts(updated);
    setNewTitle('');
    setNewCommand('');
    setIsAddingNew(false);
    setSelectedCategory('custom');
  };

  const handleDeleteCustom = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = customScripts.filter((s) => s.id !== id);
    saveCustomScripts(updated);
  };

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All', icon: <Command className="w-3 h-3" /> },
    { id: 'system', label: 'System', icon: <Cpu className="w-3 h-3" /> },
    { id: 'git', label: 'Git', icon: <GitBranch className="w-3 h-3" /> },
    { id: 'dev', label: 'Dev', icon: <Wrench className="w-3 h-3" /> },
    { id: 'custom', label: 'Custom', icon: <Sparkles className="w-3 h-3 text-amber-400" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/75 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#0c0d12] border border-white/[0.09] shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[82vh] animate-in zoom-in-95 duration-150 ring-1 ring-amber-400/20"
      >
        {/* Header with Search */}
        <div className="p-3.5 border-b border-white/[0.06] flex items-center gap-3 bg-[#0f1016]">
          <Search className="w-4 h-4 text-amber-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a script name or command... (↑ ↓ to navigate, Enter to run)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-100 placeholder:text-zinc-500 font-sans"
          />
          {activeSessionName && (
            <span className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-amber-400/[0.08] border border-amber-400/20 text-[11px] text-amber-300 font-mono">
              <Terminal className="w-3 h-3" />
              <span className="truncate max-w-[120px]">{activeSessionName}</span>
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filter Pills & Add Button */}
        <div className="px-3.5 py-2 border-b border-white/[0.04] bg-[#090a0d] flex items-center justify-between gap-2 overflow-x-auto select-none">
          <div className="flex items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                  selectedCategory === cat.id
                    ? 'bg-amber-400 text-black shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-300 bg-amber-400/[0.08] hover:bg-amber-400/[0.16] border border-amber-400/20 transition-all duration-150 shrink-0"
          >
            <Plus className="w-3 h-3" />
            <span>{isAddingNew ? 'Cancel' : 'New Script'}</span>
          </button>
        </div>

        {/* New Script Inline Form */}
        {isAddingNew && (
          <form
            onSubmit={handleCreateCustom}
            className="p-3.5 bg-[#13151d] border-b border-amber-400/20 flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-150"
          >
            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create Custom Script</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Script Title (e.g. Restart API)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-[#0c0d12] border border-white/[0.08] focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs text-zinc-100 outline-none"
                autoFocus
              />
              <input
                type="text"
                placeholder="Command (e.g. npm run dev)"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                className="bg-[#0c0d12] border border-white/[0.08] focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-100 outline-none"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newAutoExecute}
                  onChange={(e) => setNewAutoExecute(e.target.checked)}
                  className="rounded border-zinc-700 text-amber-400 focus:ring-0 focus:ring-offset-0 bg-zinc-900"
                />
                <span>Auto-run immediately (Press Enter)</span>
              </label>

              <button
                type="submit"
                disabled={!newTitle.trim() || !newCommand.trim()}
                className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-semibold rounded-lg text-xs transition-all shadow-sm"
              >
                Save Script
              </button>
            </div>
          </form>
        )}

        {/* Scripts List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredScripts.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
              <Terminal className="w-6 h-6 opacity-40 text-amber-400" />
              <span>No scripts match your search</span>
            </div>
          ) : (
            filteredScripts.map((script, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={script.id}
                  onClick={() => runScript(script)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-150 border ${
                    isSelected
                      ? 'bg-amber-400/[0.08] border-amber-400/40 text-amber-100'
                      : 'border-transparent hover:bg-white/[0.04] text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2 rounded-lg shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-amber-400 text-black'
                          : 'bg-white/[0.05] text-zinc-400 group-hover:text-amber-400'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate text-zinc-200 group-hover:text-white">
                          {script.title}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500 border border-white/[0.04]">
                          {script.category}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400 truncate opacity-80 mt-0.5">
                        {script.command}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {script.category === 'custom' && (
                      <button
                        onClick={(e) => handleDeleteCustom(e, script.id)}
                        title="Delete custom script"
                        className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <span
                      className={`px-2 py-1 rounded text-[10px] font-mono transition-opacity flex items-center gap-1 ${
                        isSelected
                          ? 'opacity-100 bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'opacity-0 group-hover:opacity-100 bg-white/[0.05] text-zinc-400'
                      }`}
                    >
                      <span>Run</span>
                      <CornerDownLeft className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-2.5 bg-[#090a0d] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400 select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.08] rounded text-[10px] font-mono text-zinc-300">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.08] rounded text-[10px] font-mono text-zinc-300">
                ↓
              </kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.08] rounded text-[10px] font-mono text-zinc-300">
                ↵ Enter
              </kbd>
              <span>Execute</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.08] rounded text-[10px] font-mono text-zinc-300">
                ESC
              </kbd>
              <span>Close</span>
            </span>
          </div>

          <div className="text-zinc-400 font-mono">
            {filteredScripts.length} script{filteredScripts.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>
    </div>
  );
};
