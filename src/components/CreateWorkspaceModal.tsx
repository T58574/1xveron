import React, { useState } from 'react';
import { Layers, Folder, Terminal, X } from 'lucide-react';
import { ShellOption } from '../types';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, path?: string, shell?: string) => Promise<void>;
  availableShells?: ShellOption[];
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  availableShells,
}) => {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [selectedShell, setSelectedShell] = useState(
    availableShells?.[0]?.cmd || 'powershell.exe'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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
      await onCreate(trimmedName, path.trim() || undefined, selectedShell);
      setName('');
      setPath('');
      onClose();
    } catch (err) {
      setError('Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#0e1015] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#12141a]">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400">
              <Layers className="w-4 h-4" />
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <span>Workspace Name</span>
              <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Backend API, Frontend, DevOps"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#141720] border border-white/[0.08] text-zinc-100 text-xs focus:outline-none focus:border-amber-400/70 transition-colors font-medium placeholder:text-zinc-500"
              autoFocus
            />
            <p className="text-[11px] text-zinc-500">
              Each workspace holds an independent group of up to 6 terminal sessions.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-zinc-400" />
              <span>Working Directory (Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. C:\Users\user\Documents\dev\my-app"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#141720] border border-white/[0.08] text-zinc-100 text-xs focus:outline-none focus:border-amber-400/70 transition-colors font-mono placeholder:text-zinc-500"
            />
            <p className="text-[11px] text-zinc-500">
              Terminals launched in this workspace will automatically start in this folder.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-zinc-400" />
              <span>Initial Terminal Shell</span>
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

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
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
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:pointer-events-none text-black transition-all shadow-sm flex items-center gap-1.5"
            >
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
