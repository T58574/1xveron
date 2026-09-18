import React from 'react';
import { GitBranch } from 'lucide-react';
import { GitStatusResponse } from '../types';

interface GitDiffPillProps {
  status: GitStatusResponse | null;
  onClick: () => void;
}

export const GitDiffPill: React.FC<GitDiffPillProps> = ({ status, onClick }) => {
  if (!status || !status.is_git) return null;

  const hasChanges = (status.insertions > 0 || status.deletions > 0 || status.files_count > 0);

  return (
    <button
      onClick={onClick}
      title={
        hasChanges
          ? `Git: +${status.insertions} -${status.deletions} in ${status.files_count} files • Click to view live diff`
          : `Git: Clean repository (${status.branch || 'main'}) • Click to view`
      }
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 border select-none cursor-pointer ${
        hasChanges
          ? 'bg-accent/[0.08] hover:bg-accent/[0.16] border-accent/30 hover:border-accent/60 shadow-[0_0_8px_var(--veron-glow)]'
          : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.06] text-zinc-400 hover:text-zinc-200'
      }`}
    >
      <GitBranch className={`w-3.5 h-3.5 shrink-0 ${hasChanges ? 'text-accent' : 'text-zinc-500'}`} />
      <span className="font-mono text-[11px] max-w-[100px] truncate text-zinc-200">
        {status.branch || 'git'}
      </span>
      {hasChanges ? (
        <div className="flex items-center gap-1 font-mono text-[11px]">
          {status.insertions > 0 && <span className="text-emerald-400 font-semibold">+{status.insertions}</span>}
          {status.deletions > 0 && <span className="text-red-400 font-semibold">-{status.deletions}</span>}
        </div>
      ) : (
        <span className="text-[10px] text-zinc-500 font-mono">clean</span>
      )}
    </button>
  );
};
