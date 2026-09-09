import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Terminal as TermIcon,
  ChevronDown,
  Plus,
  Send,
  CornerDownLeft,
  X,
} from 'lucide-react';
import { SessionInfo } from '../types';
import { getWsUrl } from '../services/api';

interface MobileViewProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: (shell?: string) => void;
  theme: 'dark' | 'light';
}

export const MobileView: React.FC<MobileViewProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  theme,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [isSessionPickerOpen, setIsSessionPickerOpen] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [viewportHeight, setViewportHeight] = useState<number>(window.innerHeight);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Adapt to mobile visualViewport (soft keyboard opening/closing)
  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        try {
          fitAddonRef.current?.fit();
        } catch {}
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, []);

  // Initialize terminal for mobile
  useEffect(() => {
    if (!containerRef.current || !activeSession) return;

    const isDark = theme === 'dark';
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
      lineHeight: 1.2,
      theme: isDark
        ? {
            background: '#121316',
            foreground: '#e2e8f0',
            cursor: '#38bdf8',
            selectionBackground: 'rgba(56, 189, 248, 0.3)',
          }
        : {
            background: '#ffffff',
            foreground: '#0f172a',
            cursor: '#0284c7',
            selectionBackground: 'rgba(2, 132, 199, 0.2)',
          },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const wsUrl = getWsUrl(activeSession.id);
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
      }, 100);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data));
      }
    };

    term.onData((data) => {
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
      if (ws.readyState === WebSocket.OPEN) ws.close();
      term.dispose();
    };
  }, [activeSession?.id]);

  // Send raw sequence (like Ctrl+C, Esc, Tab, arrows)
  const sendKey = (seq: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: seq }));
    }
  };

  // Submit text from mobile input box
  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: quickInput + '\r' }));
      setQuickInput('');
    }
  };

  return (
    <div
      style={{ height: `${viewportHeight}px` }}
      className="flex flex-col w-full bg-[#121316] text-zinc-100 overflow-hidden select-none"
    >
      {/* Top Mobile Bar */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-zinc-800 bg-[#16171d] shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white text-xs">
            V
          </div>
          <span className="font-semibold text-xs text-zinc-200">Veron Mobile</span>
        </div>

        {/* Session Switcher Pill */}
        <div className="relative">
          <button
            onClick={() => setIsSessionPickerOpen(!isSessionPickerOpen)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800/90 border border-zinc-700/60 text-xs font-medium text-sky-300 max-w-[170px]"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 active-pulse shrink-0" />
            <span className="truncate">{activeSession?.name || 'Session'}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
          </button>

          {isSessionPickerOpen && (
            <div className="fixed inset-x-4 top-14 bg-[#1a1c24] border border-zinc-700 rounded-xl shadow-2xl p-2 z-50 text-xs">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-zinc-800 font-semibold text-zinc-400">
                <span>Select Session</span>
                <button
                  onClick={() => setIsSessionPickerOpen(false)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto py-1 space-y-1">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSelectSession(s.id);
                      setIsSessionPickerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                      s.id === activeSession?.id
                        ? 'bg-sky-500/20 text-sky-300 font-medium'
                        : 'hover:bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <TermIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">{s.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {s.cwd.split('\\').pop() || s.cwd}
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <button
                  onClick={() => {
                    onCreateSession();
                    setIsSessionPickerOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>New PowerShell Instance</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 relative w-full overflow-hidden p-1 bg-[#121316]">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Mobile Developer Quick Toolbar */}
      <div className="shrink-0 bg-[#16171d] border-t border-zinc-800 px-2 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => sendKey('\x1b')}
          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] font-mono shrink-0 active:bg-sky-600 active:text-white"
        >
          ESC
        </button>
        <button
          onClick={() => sendKey('\t')}
          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] font-mono shrink-0 active:bg-sky-600 active:text-white"
        >
          TAB
        </button>
        <button
          onClick={() => sendKey('\x03')}
          className="px-2.5 py-1 bg-red-950/60 border border-red-800/60 hover:bg-red-900 text-red-300 rounded text-[11px] font-mono shrink-0 active:scale-95"
        >
          CTRL+C
        </button>
        <button
          onClick={() => sendKey('\x1a')}
          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] font-mono shrink-0"
        >
          CTRL+Z
        </button>
        <button
          onClick={() => sendKey('\x1b[A')}
          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] font-mono shrink-0"
        >
          ▲
        </button>
        <button
          onClick={() => sendKey('\x1b[B')}
          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] font-mono shrink-0"
        >
          ▼
        </button>
        <button
          onClick={() => sendKey('\x1b[D')}
          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] font-mono shrink-0"
        >
          ◀
        </button>
        <button
          onClick={() => sendKey('\x1b[C')}
          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] font-mono shrink-0"
        >
          ▶
        </button>
        <button
          onClick={() => sendKey('clear\r')}
          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-[11px] font-mono shrink-0"
        >
          Clear
        </button>
        <button
          onClick={() => sendKey('\r')}
          className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-mono shrink-0 flex items-center gap-1"
        >
          <CornerDownLeft className="w-3 h-3" />
        </button>
      </div>

      {/* Direct Mobile Command Line Input */}
      <form
        onSubmit={handleQuickSubmit}
        className="shrink-0 flex items-center gap-2 p-2 bg-[#121316] border-t border-zinc-800/80"
      >
        <input
          type="text"
          placeholder="Type command (e.g. ls, cargo run)..."
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-zinc-600 outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={!quickInput.trim()}
          className="p-2 bg-sky-600 disabled:opacity-40 hover:bg-sky-500 text-white rounded-lg transition-all"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
