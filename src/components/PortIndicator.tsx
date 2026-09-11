import React, { useState } from 'react';
import { ExternalLink, ChevronDown } from 'lucide-react';
import { DetectedPort } from '../types';
import { openBrowserUrl } from '../services/api';

interface PortIndicatorProps {
  ports: DetectedPort[];
  onToast?: (msg: string) => void;
}

export const PortIndicator: React.FC<PortIndicatorProps> = ({ ports, onToast }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!ports || ports.length === 0) return null;

  const handleOpenPort = async (port: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = `http://localhost:${port}`;
    try {
      await openBrowserUrl(url);
      onToast?.(`Opened ${url}`);
    } catch {
      window.open(url, '_blank');
    }
  };

  if (ports.length === 1) {
    const p = ports[0];
    return (
      <button
        onClick={(e) => handleOpenPort(p.port, e)}
        title={`Dev Server: ${p.process_name} (PID ${p.pid}) on port ${p.port} • Click to open`}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono font-semibold bg-emerald-500/[0.12] hover:bg-emerald-500/[0.22] text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.15)] transition-all duration-150 cursor-pointer select-none"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>:{p.port}</span>
        <ExternalLink className="w-3 h-3 text-emerald-400 opacity-80" />
      </button>
    );
  }

  // Multiple ports detected: Dropdown
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={`${ports.length} active ports detected`}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono font-semibold bg-emerald-500/[0.12] hover:bg-emerald-500/[0.22] text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.15)] transition-all duration-150 cursor-pointer select-none"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>:{ports[0].port}</span>
        <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-200">
          +{ports.length - 1}
        </span>
        <ChevronDown className="w-3 h-3 text-emerald-400 opacity-80" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-48 rounded-xl bg-[#11131a] border border-white/[0.08] shadow-2xl py-1.5 z-50 text-xs backdrop-blur-md"
          onClick={() => setIsOpen(false)}
        >
          <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Detected Dev Servers
          </div>
          {ports.map((p) => (
            <button
              key={p.port}
              onClick={(e) => handleOpenPort(p.port, e)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.06] text-zinc-200 hover:text-emerald-300 transition-colors text-left"
            >
              <div className="flex items-center gap-2 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="font-semibold">:{p.port}</span>
                <span className="text-[10px] text-zinc-400">({p.process_name})</span>
              </div>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
