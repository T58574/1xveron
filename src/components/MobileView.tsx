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
  Layers,
} from 'lucide-react';
import { SessionInfo, Workspace } from '../types';
import { getWsUrl, copyToGlobalClipboard, readFromGlobalClipboard } from '../services/api';
import { AntigravityIcon } from './AntigravityIcon';

interface MobileViewProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  sessions: SessionInfo[];
  allSessions: SessionInfo[];
  activeSessionId: string | null;
  onSelectSession: (id: string, wsId?: string) => void;
  onCreateSession: (shell?: string, wsId?: string) => void;
  theme: 'dark' | 'light';
}

export const MobileView: React.FC<MobileViewProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  sessions,
  allSessions,
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

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const isAgyWorkspace =
    activeWorkspace?.kind === 'antigravity' ||
    activeWorkspace?.name.toLowerCase().includes('antigravity') ||
    activeWorkspace?.name.toLowerCase().includes('agy');

  // Find active session in current workspace, or fallback to any matching in allSessions
  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ||
    sessions[0] ||
    allSessions.find((s) => s.id === activeSessionId) ||
    allSessions[0];

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
            background: '#090a0d',
            foreground: '#f4f4f5',
            cursor: '#f59e0b',
            selectionBackground: 'rgba(245, 158, 11, 0.28)',
          }
        : {
            background: '#ffffff',
            foreground: '#09090b',
            cursor: '#d97706',
            selectionBackground: 'rgba(217, 119, 6, 0.2)',
          },
    });

    // Key handler: allow native Ctrl+C / Ctrl+V without sending ASCII \x16
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type === 'keydown') {
        const isCKey =
          event.key.toLowerCase() === 'c' ||
          event.code === 'KeyC' ||
          event.key === 'с' ||
          event.key === 'С';
        const isVKey =
          event.key.toLowerCase() === 'v' ||
          event.code === 'KeyV' ||
          event.key === 'м' ||
          event.key === 'М';

        if ((event.ctrlKey || event.metaKey) && isCKey && !event.altKey) {
          if (term.hasSelection()) {
            const selection = term.getSelection();
            if (selection) {
              copyToGlobalClipboard(selection);
              return false;
            }
          }
          return true;
        }

        if (
          ((event.ctrlKey || event.metaKey) && isVKey && !event.altKey) ||
          (event.shiftKey && event.key === 'Insert')
        ) {
          event.preventDefault();
          readFromGlobalClipboard()
            .then((text) => {
              if (text && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
              }
            })
            .catch(() => {});
          return false;
        }
      }
      return true;
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

    // Handle native paste in mobile terminal
    const handleNativePaste = (event: ClipboardEvent) => {
      const text =
        event.clipboardData?.getData('text/plain') ||
        event.clipboardData?.getData('text');
      if (text) {
        event.preventDefault();
        event.stopPropagation();
        term.paste(text);
      }
    };

    const handleNativeCopy = (event: ClipboardEvent) => {
      if (termRef.current?.hasSelection()) {
        const selection = termRef.current.getSelection();
        if (selection) {
          if (event.clipboardData) {
            event.clipboardData.setData('text/plain', selection);
            event.preventDefault();
          }
          copyToGlobalClipboard(selection).catch(() => {});
        }
      }
    };

    const handleMouseUp = () => {
      setTimeout(() => {
        if (termRef.current?.hasSelection()) {
          const selection = termRef.current.getSelection();
          if (selection) {
            copyToGlobalClipboard(selection).catch(() => {});
          }
        }
      }, 30);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('paste', handleNativePaste, { capture: true });
      container.addEventListener('copy', handleNativeCopy, { capture: true });
      container.addEventListener('mouseup', handleMouseUp);
    }

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
      if (container) {
        container.removeEventListener('paste', handleNativePaste, { capture: true });
        container.removeEventListener('copy', handleNativeCopy, { capture: true });
        container.removeEventListener('mouseup', handleMouseUp);
      }
      if (ws.readyState === WebSocket.OPEN) ws.close();
      term.dispose();
    };
  }, [activeSession?.id, theme]);

  const sendKey = (seq: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: seq }));
    }
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: quickInput + '\r' }));
      setQuickInput('');
    }
  };

  const isCurrentSessionAgy =
    isAgyWorkspace ||
    activeSession?.name.toLowerCase().includes('antigravity') ||
    activeSession?.name.toLowerCase().includes('agy');

  return (
    <div
      style={{ height: `${viewportHeight}px` }}
      className="flex flex-col w-full bg-[#090a0d] text-zinc-100 overflow-hidden select-none"
    >
      {/* Top Mobile Bar */}
      <div className="h-11 px-3 flex items-center justify-between border-b border-white/[0.06] bg-[#0d0e12] shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-black text-[10px]">
            V
          </div>
          <span className="font-semibold text-xs tracking-wider uppercase font-mono text-zinc-200">
            Veron
          </span>
          {activeWorkspace && (
            <span className="hidden xs:inline text-[11px] px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-zinc-400 max-w-[100px] truncate">
              {activeWorkspace.name}
            </span>
          )}
        </div>

        {/* Session Switcher Pill */}
        <div className="relative">
          <button
            onClick={() => setIsSessionPickerOpen(!isSessionPickerOpen)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/[0.1] border border-amber-400/25 text-xs font-medium text-amber-300 max-w-[190px]"
          >
            {isCurrentSessionAgy ? (
              <AntigravityIcon size={13} mode="gradient" className="shrink-0" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            )}
            <span className="truncate">{activeSession?.name || 'Session'}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
          </button>

          {isSessionPickerOpen && (
            <div className="fixed inset-x-3 top-13 bg-[#12141a] border border-white/[0.08] rounded-xl shadow-2xl p-3 z-50 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] font-semibold text-zinc-400">
                <span className="text-zinc-200">Workspaces & Sessions</span>
                <button
                  onClick={() => setIsSessionPickerOpen(false)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Workspace Selector Horizontal Bar */}
              {workspaces.length > 0 && (
                <div className="pt-2 pb-2">
                  <div className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 mb-1.5 px-0.5">
                    Workspace Groups
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {workspaces.map((w) => {
                      const isSelected = w.id === activeWorkspaceId;
                      const count = allSessions.filter(
                        (s) => s.workspace_id === w.id || (!s.workspace_id && w.id === 'default')
                      ).length;
                      const isWsAgy =
                        w.kind === 'antigravity' ||
                        w.name.toLowerCase().includes('antigravity') ||
                        w.name.toLowerCase().includes('agy');

                      return (
                        <button
                          key={w.id}
                          onClick={() => onSelectWorkspace(w.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs shrink-0 transition-all ${
                            isSelected
                              ? 'bg-amber-400 text-black font-semibold shadow'
                              : 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300'
                          }`}
                        >
                          {isWsAgy ? (
                            <AntigravityIcon size={12} mode={isSelected ? 'monochrome' : 'gradient'} />
                          ) : (
                            <Layers className="w-3 h-3" />
                          )}
                          <span className="truncate max-w-[110px]">{w.name}</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded-full font-mono ${
                              isSelected ? 'bg-black/25 text-black font-bold' : 'bg-white/[0.1] text-zinc-400'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sessions List */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-[10px] uppercase font-semibold tracking-wider text-zinc-500 mb-1 px-0.5">
                  <span>Sessions in {activeWorkspace?.name || 'Workspace'}</span>
                  <span>{sessions.length} active</span>
                </div>

                <div className="max-h-52 overflow-y-auto py-1 space-y-1">
                  {sessions.length === 0 ? (
                    <div className="py-4 text-center text-zinc-500 text-xs">
                      No active sessions in this workspace
                    </div>
                  ) : (
                    sessions.map((s) => {
                      const isSessAgy =
                        isAgyWorkspace ||
                        s.name.toLowerCase().includes('antigravity') ||
                        s.name.toLowerCase().includes('agy');
                      const isSelected = s.id === activeSession?.id;

                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            onSelectSession(s.id, s.workspace_id);
                            setIsSessionPickerOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                            isSelected
                              ? 'bg-amber-400/15 text-amber-300 font-medium border border-amber-400/30'
                              : 'hover:bg-white/[0.04] text-zinc-300 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isSessAgy ? (
                              <AntigravityIcon size={14} mode="gradient" className="shrink-0" />
                            ) : (
                              <TermIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            <span className="truncate">{s.name}</span>
                            {isSessAgy && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold bg-gradient-to-r from-blue-500/20 via-emerald-500/20 to-amber-500/20 text-amber-300 border border-amber-400/30">
                                AGY
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {s.cwd.split('\\').pop() || s.cwd}
                            </span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                s.is_alive
                                  ? 'bg-amber-400 shadow-[0_0_5px_rgba(245,158,11,0.8)]'
                                  : 'bg-zinc-600'
                              }`}
                            />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Create Session Button */}
              <div className="pt-2 mt-1 border-t border-white/[0.06]">
                <button
                  onClick={() => {
                    onCreateSession(undefined, activeWorkspaceId);
                    setIsSessionPickerOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-amber-400 hover:bg-amber-300 text-black font-semibold rounded-lg shadow transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAgyWorkspace ? 'New AGY Session' : 'New Shell Instance'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 relative w-full overflow-hidden p-1 bg-[#090a0d]">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Mobile Developer Toolbar */}
      <div className="shrink-0 bg-[#0d0e12] border-t border-white/[0.06] px-2 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => sendKey('\x1b')}
          className="px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 rounded text-[11px] font-mono shrink-0 active:bg-amber-400 active:text-black transition-colors"
        >
          ESC
        </button>
        <button
          onClick={() => sendKey('\t')}
          className="px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 rounded text-[11px] font-mono shrink-0 active:bg-amber-400 active:text-black transition-colors"
        >
          TAB
        </button>
        <button
          onClick={() => sendKey('\x03')}
          className="px-2.5 py-1 bg-red-950/50 border border-red-800/50 hover:bg-red-900/60 text-red-300 rounded text-[11px] font-mono shrink-0 active:scale-95 transition-all"
        >
          CTRL+C
        </button>
        <button
          onClick={() => sendKey('\x1a')}
          className="px-2 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 rounded text-[11px] font-mono shrink-0"
        >
          CTRL+Z
        </button>
        <button
          onClick={() => sendKey('\x1b[A')}
          className="px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 rounded text-[11px] font-mono shrink-0"
        >
          ▲
        </button>
        <button
          onClick={() => sendKey('\x1b[B')}
          className="px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 rounded text-[11px] font-mono shrink-0"
        >
          ▼
        </button>
        <button
          onClick={() => sendKey('\x1b[D')}
          className="px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 rounded text-[11px] font-mono shrink-0"
        >
          ◀
        </button>
        <button
          onClick={() => sendKey('\x1b[C')}
          className="px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 rounded text-[11px] font-mono shrink-0"
        >
          ▶
        </button>
        <button
          onClick={() => sendKey('clear\r')}
          className="px-2 py-1 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 rounded text-[11px] font-mono shrink-0"
        >
          Clear
        </button>
        <button
          onClick={() => sendKey('\r')}
          className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-black font-semibold rounded text-[11px] font-mono shrink-0 flex items-center gap-1"
        >
          <CornerDownLeft className="w-3 h-3" />
        </button>
      </div>

      {/* Direct Mobile Command Line Input */}
      <form
        onSubmit={handleQuickSubmit}
        className="shrink-0 flex items-center gap-2 p-2 bg-[#090a0d] border-t border-white/[0.04]"
      >
        <input
          type="text"
          placeholder="Type command (e.g. agy, ls, git status)..."
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          className="flex-1 bg-[#12141a] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-zinc-600 outline-none focus:border-amber-400 transition-colors"
        />
        <button
          type="submit"
          disabled={!quickInput.trim()}
          className="p-2 bg-amber-400 disabled:opacity-30 hover:bg-amber-300 text-black font-semibold rounded-lg transition-all"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
