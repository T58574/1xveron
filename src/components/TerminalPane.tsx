import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Maximize2, Minimize2, X, Plus, Terminal as TermIcon, Image, Folder, Check } from 'lucide-react';
import { SessionInfo } from '../types';
import { getWsUrl, uploadScreenshot } from '../services/api';

interface TerminalPaneProps {
  session: SessionInfo | undefined;
  isActive: boolean;
  isMaximized: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMaximize: () => void;
  onSplit: () => void;
  theme: 'dark' | 'light';
  onToast: (msg: string) => void;
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({
  session,
  isActive,
  isMaximized,
  onFocus,
  onClose,
  onMaximize,
  onSplit,
  theme,
  onToast,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isCopiedPath, setIsCopiedPath] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !session) return;

    const isDark = theme === 'dark';
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
      lineHeight: 1.25,
      allowProposedApi: true,
      theme: isDark
        ? {
            background: '#0c0d12',
            foreground: '#f4f4f5',
            cursor: '#f59e0b',
            selectionBackground: 'rgba(245, 158, 11, 0.28)',
            black: '#14161f',
            red: '#f87171',
            green: '#4ade80',
            yellow: '#fbbf24',
            blue: '#38bdf8',
            magenta: '#e879f9',
            cyan: '#22d3ee',
            white: '#f4f4f5',
            brightBlack: '#52525b',
            brightRed: '#ef4444',
            brightGreen: '#22c55e',
            brightYellow: '#f59e0b',
            brightBlue: '#60a5fa',
            brightMagenta: '#d946ef',
            brightCyan: '#06b6d4',
            brightWhite: '#ffffff',
          }
        : {
            background: '#ffffff',
            foreground: '#09090b',
            cursor: '#d97706',
            selectionBackground: 'rgba(217, 119, 6, 0.2)',
            black: '#09090b',
            red: '#dc2626',
            green: '#16a34a',
            yellow: '#d97706',
            blue: '#2563eb',
            magenta: '#9333ea',
            cyan: '#0891b2',
            white: '#fafafa',
            brightBlack: '#71717a',
            brightRed: '#b91c1c',
            brightGreen: '#15803d',
            brightYellow: '#b45309',
            brightBlue: '#1d4ed8',
            brightMagenta: '#7e22ce',
            brightCyan: '#0e7490',
            brightWhite: '#09090b',
          },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    } catch {}

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const wsUrl = getWsUrl(session.id);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setTimeout(() => {
        try {
          fitAddon.fit();
          if (term.rows && term.cols) {
            ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }));
          }
        } catch {}
      }, 50);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data));
      }
    };

    const onDataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN && term.rows && term.cols) {
          ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }));
        }
      } catch {}
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      term.dispose();
    };
  }, [session?.id, theme]);

  const handlePasteOrDrop = async (event: React.ClipboardEvent | React.DragEvent) => {
    let items: DataTransferItemList | null = null;
    let files: FileList | null = null;

    if ('clipboardData' in event) {
      items = event.clipboardData?.items || null;
      files = event.clipboardData?.files || null;
    } else if ('dataTransfer' in event) {
      items = event.dataTransfer?.items || null;
      files = event.dataTransfer?.files || null;
    }

    let imageFile: File | null = null;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          imageFile = files[i];
          break;
        }
      }
    }

    if (!imageFile && items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          imageFile = items[i].getAsFile();
          break;
        }
      }
    }

    if (imageFile && session) {
      event.preventDefault();
      event.stopPropagation();
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        if (base64) {
          try {
            onToast('Saving capture...');
            const res = await uploadScreenshot(base64, session.id);
            onToast(`Captured: ${res.file_path.split('\\').pop()}`);
          } catch {
            onToast('Failed to save image');
          }
        }
      };
      reader.readAsDataURL(imageFile);
    }
  };

  const copyCwd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (session?.cwd) {
      navigator.clipboard.writeText(session.cwd);
      setIsCopiedPath(true);
      setTimeout(() => setIsCopiedPath(false), 2000);
      onToast(`Path copied`);
    }
  };

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/[0.08] rounded-xl m-1 p-6 text-zinc-500 bg-[#0d0e13]/60 transition-all duration-200">
        <TermIcon className="w-8 h-8 mb-2 opacity-30 text-amber-400" />
        <p className="text-xs font-medium text-zinc-400">Empty Slot</p>
        <button
          onClick={onSplit}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] hover:text-amber-400 text-xs text-zinc-300 rounded-lg transition-all duration-150 border border-white/[0.06]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Launch Shell</span>
        </button>
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <div
      onClick={onFocus}
      onPaste={handlePasteOrDrop}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handlePasteOrDrop}
      className={`relative flex flex-col flex-1 min-w-0 min-h-0 rounded-xl overflow-hidden transition-all duration-200 ${
        isDark
          ? 'bg-[#0c0d12] border border-white/[0.07] shadow-card'
          : 'bg-white border border-zinc-200 shadow-sm'
      } ${
        isActive
          ? 'ring-1 ring-amber-400/70 border-amber-400/40 shadow-pane-active'
          : 'hover:border-white/[0.15]'
      }`}
    >
      {/* Precision Pane Header */}
      <div
        className={`h-9 px-3 flex items-center justify-between select-none border-b transition-colors duration-150 ${
          isDark
            ? 'bg-[#121319] border-white/[0.06] text-zinc-300'
            : 'bg-zinc-50 border-zinc-200 text-zinc-700'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Restrained Amber Pip */}
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              session.is_alive ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]' : 'bg-zinc-600'
            }`}
          />
          <span className="text-xs font-medium truncate max-w-[150px] text-zinc-100 tracking-tight">
            {session.name}
          </span>
          <button
            onClick={copyCwd}
            title={`Copy: ${session.cwd}`}
            className="hidden sm:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-amber-400 truncate max-w-[180px] transition-all duration-150"
          >
            <Folder className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="truncate">{session.cwd.split('\\').pop() || session.cwd}</span>
            {isCopiedPath ? <Check className="w-2.5 h-2.5 text-amber-400" /> : null}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-0.5">
          <div
            title="Paste images (Ctrl+V) to auto-save and insert path"
            className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-white/[0.06] cursor-pointer transition-colors"
          >
            <Image className="w-3.5 h-3.5" />
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSplit();
            }}
            title="Split pane"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onMaximize();
            }}
            title={isMaximized ? 'Restore pane' : 'Maximize pane'}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close session"
            className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 relative w-full h-full overflow-hidden p-1">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
