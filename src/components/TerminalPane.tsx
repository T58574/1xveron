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

    // 1. Initialize Xterm instance
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
            background: '#16171d',
            foreground: '#e2e8f0',
            cursor: '#38bdf8',
            selectionBackground: 'rgba(56, 189, 248, 0.3)',
            black: '#1e212b',
            red: '#f87171',
            green: '#4ade80',
            yellow: '#facc15',
            blue: '#38bdf8',
            magenta: '#c084fc',
            cyan: '#22d3ee',
            white: '#f1f5f9',
            brightBlack: '#475569',
            brightRed: '#ef4444',
            brightGreen: '#22c55e',
            brightYellow: '#eab308',
            brightBlue: '#0ea5e9',
            brightMagenta: '#a855f7',
            brightCyan: '#06b6d4',
            brightWhite: '#ffffff',
          }
        : {
            background: '#ffffff',
            foreground: '#0f172a',
            cursor: '#0284c7',
            selectionBackground: 'rgba(2, 132, 199, 0.2)',
            black: '#0f172a',
            red: '#dc2626',
            green: '#16a34a',
            yellow: '#ca8a04',
            blue: '#0284c7',
            magenta: '#9333ea',
            cyan: '#0891b2',
            white: '#f8fafc',
            brightBlack: '#64748b',
            brightRed: '#b91c1c',
            brightGreen: '#15803d',
            brightYellow: '#a16207',
            brightBlue: '#0369a1',
            brightMagenta: '#7e22ce',
            brightCyan: '#0e7490',
            brightWhite: '#0f172a',
          },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);

    // Try Webgl for GPU acceleration, fallback gracefully
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
    } catch {
      // Canvas fallback is automatic in xterm
    }

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // 2. Setup WebSocket connection to Veron ConPTY backend
    const wsUrl = getWsUrl(session.id);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      // Fit terminal and send initial size
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

    ws.onerror = (e) => {
      console.error('Terminal WS error:', e);
    };

    // Forward terminal user keystrokes -> backend PTY
    const onDataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle resize
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

  // Clipboard & Drag-and-Drop Image Paste Handler
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

    // Check if an image was pasted or dropped
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
            onToast('Saving clipboard image...');
            const res = await uploadScreenshot(base64, session.id);
            onToast(`Saved image! Path inserted: ${res.file_path.split('\\').pop()}`);
          } catch (err) {
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
      onToast(`Copied path: ${session.cwd}`);
    }
  };

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-700/50 rounded-xl m-1 p-6 text-zinc-500 bg-zinc-900/30">
        <TermIcon className="w-10 h-10 mb-3 opacity-40 text-sky-400" />
        <p className="text-sm font-medium">Empty Pane</p>
        <button
          onClick={onSplit}
          className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Launch Instance</span>
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
      className={`relative flex flex-col flex-1 min-w-0 min-h-0 rounded-xl overflow-hidden transition-all duration-150 ${
        isDark
          ? 'bg-[#16171d] border border-zinc-800/80 shadow-card'
          : 'bg-white border border-slate-200 shadow-sm'
      } ${
        isActive
          ? 'ring-1 ring-sky-500/70 shadow-pane-active border-sky-500/40'
          : 'hover:border-zinc-700/60'
      }`}
    >
      {/* BridgeMind-style Sleek Pane Header */}
      <div
        className={`h-9 px-3 flex items-center justify-between select-none border-b transition-colors ${
          isDark
            ? 'bg-[#1a1c24] border-zinc-800/70 text-zinc-300'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Active status pulsing green dot */}
          <span
            className={`w-2 h-2 rounded-full ${
              session.is_alive ? 'bg-emerald-400 active-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-zinc-500'
            }`}
          />
          <TermIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="text-xs font-semibold truncate max-w-[140px] text-zinc-200 dark:text-zinc-200">
            {session.name}
          </span>
          {/* CWD pill */}
          <button
            onClick={copyCwd}
            title={`Click to copy: ${session.cwd}`}
            className="hidden sm:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 truncate max-w-[180px] transition-colors"
          >
            <Folder className="w-3 h-3 text-amber-400/80 shrink-0" />
            <span className="truncate">{session.cwd.split('\\').pop() || session.cwd}</span>
            {isCopiedPath ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : null}
          </button>
        </div>

        {/* Pane Controls */}
        <div className="flex items-center gap-1">
          {/* Screenshot upload indicator */}
          <div
            title="Paste images (Ctrl+V) to auto-save and insert path"
            className="p-1 rounded text-zinc-400 hover:text-sky-400 hover:bg-zinc-700/40 cursor-pointer transition-colors"
          >
            <Image className="w-3.5 h-3.5" />
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSplit();
            }}
            title="Split pane"
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onMaximize();
            }}
            title={isMaximized ? 'Restore pane' : 'Maximize pane'}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/40 transition-colors"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close session"
            className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700/40 transition-colors"
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
