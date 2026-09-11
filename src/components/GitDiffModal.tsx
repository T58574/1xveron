import React, { useEffect, useState } from 'react';
import { GitBranch, X, Copy, Check, RefreshCw, FileText } from 'lucide-react';
import { GitStatusResponse, GitFileChange } from '../types';
import { fetchGitDiff } from '../services/api';

interface GitDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  gitStatus: GitStatusResponse | null;
  workspacePath?: string;
  onRefresh: () => void;
}

export const GitDiffModal: React.FC<GitDiffModalProps> = ({
  isOpen,
  onClose,
  gitStatus,
  workspacePath,
  onRefresh,
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffText, setDiffText] = useState<string>('');
  const [isLoadingDiff, setIsLoadingDiff] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadDiff = async () => {
      setIsLoadingDiff(true);
      try {
        const res = await fetchGitDiff(workspacePath, selectedFile || undefined);
        setDiffText(res.diff || '');
      } catch (err) {
        setDiffText('Failed to load git diff');
      } finally {
        setIsLoadingDiff(false);
      }
    };

    loadDiff();
  }, [isOpen, workspacePath, selectedFile]);

  if (!isOpen) return null;

  const handleCopyDiff = () => {
    if (!diffText) return;
    navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'modified':
        return <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">M</span>;
      case 'added':
        return <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">A</span>;
      case 'deleted':
        return <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-red-400/20 text-red-300 border border-red-400/30">D</span>;
      case 'untracked':
        return <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">?</span>;
      default:
        return <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-700 text-zinc-300">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-5xl h-[85vh] bg-[#0c0d12] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-12 px-5 border-b border-white/[0.08] bg-[#111319] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-zinc-100">Live Git Changes</span>
                {gitStatus?.branch && (
                  <span className="text-xs px-2 py-0.5 rounded font-mono bg-white/[0.06] text-amber-300 border border-white/[0.08]">
                     {gitStatus.branch}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-2 font-mono text-xs">
              <span className="text-emerald-400 font-medium">+{gitStatus?.insertions || 0}</span>
              <span className="text-red-400 font-medium">-{gitStatus?.deletions || 0}</span>
              <span className="text-zinc-500">• {gitStatus?.files_count || 0} files</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onRefresh();
                fetchGitDiff(workspacePath, selectedFile || undefined).then((res) => setDiffText(res.diff || ''));
              }}
              title="Refresh diff"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-white/[0.06] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopyDiff}
              disabled={!diffText}
              title="Copy unified diff"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-amber-400 transition-colors border border-white/[0.06]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Diff'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body: Left file sidebar + Right diff content */}
        <div className="flex-1 flex overflow-hidden">
          {/* File list sidebar */}
          <div className="w-72 border-r border-white/[0.06] bg-[#0e1016] flex flex-col shrink-0">
            <div className="px-3 py-2 border-b border-white/[0.04] flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              <span>Changed Files ({gitStatus?.files.length || 0})</span>
              {selectedFile && (
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-amber-400 hover:underline capitalize"
                >
                  Show all
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
              {gitStatus?.files.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  Clean working tree
                </div>
              ) : (
                gitStatus?.files.map((file: GitFileChange) => {
                  const isSelected = selectedFile === file.path;
                  return (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(isSelected ? null : file.path)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                        isSelected
                          ? 'bg-amber-400/15 border border-amber-400/30 text-amber-300 font-medium'
                          : 'hover:bg-white/[0.04] text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate mr-2">
                        {getStatusBadge(file.status)}
                        <span className="truncate font-mono text-[11px]" title={file.path}>
                          {file.path}
                        </span>
                      </div>
                      {(file.insertions > 0 || file.deletions > 0) && (
                        <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
                          {file.insertions > 0 && <span className="text-emerald-400">+{file.insertions}</span>}
                          {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Diff view container */}
          <div className="flex-1 flex flex-col bg-[#0a0b0f] overflow-hidden">
            {isLoadingDiff ? (
              <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400 mr-2" />
                <span>Loading git diff...</span>
              </div>
            ) : !diffText.trim() ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                <FileText className="w-8 h-8 opacity-30 text-amber-400 mb-2" />
                <p className="text-xs">No uncommitted changes in this view</p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed select-text custom-scrollbar">
                {diffText.split('\n').map((line, idx) => {
                  let lineClass = 'text-zinc-400';
                  let bgClass = '';

                  if (line.startsWith('+++') || line.startsWith('---')) {
                    lineClass = 'text-zinc-300 font-bold';
                    bgClass = 'bg-white/[0.03]';
                  } else if (line.startsWith('+')) {
                    lineClass = 'text-emerald-300';
                    bgClass = 'bg-emerald-500/[0.12]';
                  } else if (line.startsWith('-')) {
                    lineClass = 'text-red-300';
                    bgClass = 'bg-red-500/[0.12]';
                  } else if (line.startsWith('@@')) {
                    lineClass = 'text-cyan-400 font-semibold';
                    bgClass = 'bg-cyan-500/[0.08]';
                  } else if (line.startsWith('diff --git')) {
                    lineClass = 'text-amber-400 font-bold';
                    bgClass = 'bg-amber-400/[0.08] mt-3 border-t border-white/[0.06] pt-1';
                  }

                  return (
                    <div
                      key={idx}
                      className={`px-2 py-0.5 rounded-sm whitespace-pre ${lineClass} ${bgClass}`}
                    >
                      {line || ' '}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
