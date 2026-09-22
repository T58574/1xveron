import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import {
  Maximize2,
  Minimize2,
  X,
  Plus,
  Terminal as TermIcon,
  Image,
  ImagePlus,
  Folder,
  Check,
  Search,
  ChevronUp,
  ChevronDown,
  Download,
  ArrowDown,
} from 'lucide-react';
import { CapturePathFormat, SessionInfo } from '../types';
import {
  getWsUrl,
  uploadScreenshot,
  uploadBatchScreenshots,
  copyToGlobalClipboard,
  readFromGlobalClipboard,
  openBrowserUrl,
  exportSessionLog,
} from '../services/api';
import { AntigravityIcon } from './AntigravityIcon';
import { VeronTheme } from '../services/theme';
import { playVeronChime } from '../services/sound';

interface TerminalPaneProps {
  session: SessionInfo | undefined;
  isActive: boolean;
  isMaximized: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMaximize: () => void;
  onSplit: () => void;
  onRename?: (newName: string) => void;
  theme: 'dark' | 'light';
  activeTheme?: VeronTheme;
  onToast: (msg: string) => void;
  onCaptureSaved?: () => void;
  agyMode?: boolean;
  onToggleAgyMode?: () => void;
  capturePathFormat?: CapturePathFormat;
  isAntigravity?: boolean;
  slotIndex?: number;
  onStartDrag?: (slotIdx: number, session: SessionInfo, e: React.PointerEvent) => void;
  isDragOver?: boolean;
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({
  session,
  isActive,
  isMaximized,
  onFocus,
  onClose,
  onMaximize,
  onSplit,
  onRename,
  theme,
  activeTheme,
  onToast,
  onCaptureSaved,
  agyMode = true,
  onToggleAgyMode,
  capturePathFormat = 'absolute',
  isAntigravity = false,
  slotIndex,
  onStartDrag,
  isDragOver = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isUploadingRef = useRef(false);
  const isPastingRef = useRef(false);
  const lastPasteTimeRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const performPasteRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const [isCopiedPath, setIsCopiedPath] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(session?.name || '');
  const [isBelling, setIsBelling] = useState(false);
  const [isAwaitingInput, setIsAwaitingInput] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchRegex, setSearchRegex] = useState(false);
  const [searchMatchIndex, setSearchMatchIndex] = useState(-1);
  const [searchMatchTotal, setSearchMatchTotal] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [linesScrolledUp, setLinesScrolledUp] = useState(0);

  const handleScrollToBottom = () => {
    if (termRef.current) {
      termRef.current.scrollToBottom();
      termRef.current.focus();
      setIsScrolledUp(false);
      setLinesScrolledUp(0);
    }
  };

  const getSearchOptions = (caseSens: boolean, regex: boolean) => ({
    caseSensitive: caseSens,
    regex: regex,
    incremental: true,
    decorations: {
      matchBackground: 'rgba(245, 158, 11, 0.25)',
      matchBorder: 'rgba(245, 158, 11, 0.6)',
      matchOverviewRuler: '#f59e0b',
      activeMatchBackground: '#f59e0b',
      activeMatchBorder: '#fbbf24',
      activeMatchColorOverviewRuler: '#fbbf24',
    },
  });

  const handleSearchNext = (
    query = searchQuery,
    caseSens = searchCaseSensitive,
    regex = searchRegex
  ) => {
    if (!query || !searchAddonRef.current) return;
    searchAddonRef.current.findNext(query, getSearchOptions(caseSens, regex));
  };

  const handleSearchPrev = (
    query = searchQuery,
    caseSens = searchCaseSensitive,
    regex = searchRegex
  ) => {
    if (!query || !searchAddonRef.current) return;
    searchAddonRef.current.findPrevious(query, getSearchOptions(caseSens, regex));
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    searchAddonRef.current?.clearDecorations();
    termRef.current?.focus();
  };

  const handleExportSession = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.id) return;
    setIsExporting(true);
    try {
      await exportSessionLog(session.id, session.name, 'text');
      onToast(`Exported ${session.name} log`);
    } catch (err) {
      console.error('Failed to export log', err);
      onToast('Failed to export session log');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!session) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [session?.id]);

  useEffect(() => {
    setNewName(session?.name || '');
  }, [session?.name]);

  useEffect(() => {
    if (!containerRef.current || !session) return;

    const isDark = theme === 'dark';
    const handleLinkActivation = (uri: string) => {
      openBrowserUrl(uri);
      const display = uri.length > 40 ? `${uri.slice(0, 37)}...` : uri;
      onToast(`Opened ${display}`);
    };

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
      lineHeight: 1.25,
      allowProposedApi: true,
      linkHandler: {
        activate: (_event: MouseEvent, uri: string) => {
          handleLinkActivation(uri);
        },
      },
      windowsPty: {
        backend: 'conpty',
      },
      scrollback: 10000,
      scrollOnUserInput: true,
      smoothScrollDuration: 0,
      theme: activeTheme
        ? activeTheme.xterm
        : isDark
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

    const webLinksAddon = new WebLinksAddon((_event: MouseEvent, uri: string) => {
      handleLinkActivation(uri);
    });
    term.loadAddon(webLinksAddon);

    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    searchAddon.onDidChangeResults((e) => {
      setSearchMatchIndex(e.resultIndex);
      setSearchMatchTotal(e.resultCount);
    });

    term.open(containerRef.current);
    try {
      fitAddon.fit();
    } catch {}

    // Key handler: Ctrl+Enter (multiline newline), Ctrl+C (copy when selected), Ctrl+Shift+C/V, Ctrl+V
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

        // 1. Ctrl+Enter or Shift+Enter -> Newline (\n) for multi-line prompts (agy, Claude CLI, REPL)
        if (event.key === 'Enter' && (event.ctrlKey || event.shiftKey)) {
          event.preventDefault();
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', data: '\n' }));
          }
          return false;
        }

        // 2. Ctrl+C with active selection -> Copy text to clipboard without sending SIGINT
        if (
          (event.ctrlKey || event.metaKey) &&
          isCKey &&
          !event.altKey &&
          !event.shiftKey
        ) {
          if (term.hasSelection()) {
            const selection = term.getSelection();
            if (selection) {
              copyToGlobalClipboard(selection);
              onToast('Copied to clipboard');
              return false; // Prevent sending SIGINT when copying!
            }
          }
          return true; // No selection -> let Ctrl+C pass through to send SIGINT
        }

        // 3. Ctrl+Shift+C -> Always copy selection
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && isCKey) {
          if (term.hasSelection()) {
            const selection = term.getSelection();
            if (selection) {
              copyToGlobalClipboard(selection);
              onToast('Copied to clipboard');
            }
          }
          return false;
        }

        // 4. Enter with active selection -> Classic Windows conhost/PowerShell behavior: copy and unselect
        if (event.key === 'Enter' && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          if (term.hasSelection()) {
            const selection = term.getSelection();
            if (selection) {
              event.preventDefault();
              copyToGlobalClipboard(selection);
              term.clearSelection();
              onToast('Copied to clipboard');
              return false;
            }
          }
        }

        // 4. Ctrl+V, Ctrl+Shift+V, Shift+Insert -> Direct paste without sending \x16 (SYN)
        const isPasteKey =
          ((event.ctrlKey || event.metaKey) && isVKey && !event.altKey) ||
          (event.shiftKey && event.key === 'Insert');

        if (isPasteKey) {
          event.preventDefault();
          performPasteRef.current();
          return false;
        }

        // 5. Ctrl+Shift+T or Ctrl+Shift+D -> propagate to window for instant split / new pane
        const isTKey =
          event.key.toLowerCase() === 't' ||
          event.code === 'KeyT' ||
          event.key === 'е' ||
          event.key === 'Е';
        const isDKey =
          event.key.toLowerCase() === 'd' ||
          event.code === 'KeyD' ||
          event.key === 'в' ||
          event.key === 'В';
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && (isTKey || isDKey)) {
          return false;
        }

        // 6. Alt+1..6, Alt+W, Alt+M -> propagate to window for global quadrant switching & closing
        if (event.altKey) {
          const isQuadrant = event.key >= '1' && event.key <= '6';
          const isAction = event.key.toLowerCase() === 'w' || event.key.toLowerCase() === 'm';
          if (isQuadrant || isAction) {
            return false;
          }
        }

        // 7. Ctrl+F / Cmd+F -> In-buffer terminal search
        const isFKey =
          event.key.toLowerCase() === 'f' ||
          event.code === 'KeyF' ||
          event.key === 'а' ||
          event.key === 'А';
        if ((event.ctrlKey || event.metaKey) && isFKey && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          setIsSearchOpen(true);
          const sel = term.getSelection()?.trim();
          if (sel) {
            setSearchQuery(sel);
            setTimeout(() => {
              searchAddon.findNext(sel, getSearchOptions(searchCaseSensitive, searchRegex));
            }, 10);
          }
          setTimeout(() => searchInputRef.current?.focus(), 50);
          return false;
        }

        // 8. Shift+PageUp / Shift+PageDown / Shift+Home / Shift+End -> Scroll navigation
        if (event.shiftKey && event.key === 'PageUp') {
          term.scrollPages(-1);
          return false;
        }
        if (event.shiftKey && event.key === 'PageDown') {
          term.scrollPages(1);
          return false;
        }
        if (event.shiftKey && event.key === 'End') {
          term.scrollToBottom();
          return false;
        }
        if (event.shiftKey && event.key === 'Home') {
          term.scrollToTop();
          return false;
        }
      }
      return true;
    });

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    } catch {}

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    let isDisposed = false;
    let reconnectTimeout: any = null;
    let retryCount = 0;
    let resizeTimeout: any = null;
    let isFirstConnect = true;
    let checkInputTimer: any = null;
    let isExecutingRef = false;
    let executionStartRef = 0;
    let lastChimeRef = 0;

    const triggerCompletionChime = () => {
      const now = Date.now();
      if (now - lastChimeRef < 3000) return;
      lastChimeRef = now;
      playVeronChime();

      if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Veron Terminal', {
            body: `${session.name}: Task finished`,
            silent: true,
          });
        } catch {}
      }
    };

    const checkAwaitingInputOrCompletion = () => {
      try {
        const buffer = term.buffer.active;
        const line = buffer.getLine(buffer.cursorY)?.translateToString().trim() || '';
        const prevLine = buffer.cursorY > 0 ? buffer.getLine(buffer.cursorY - 1)?.translateToString().trim() || '' : '';
        const combined = `${prevLine} ${line}`.toLowerCase();

        const isAgentPrompt =
          line.endsWith('?') ||
          line.endsWith('›') ||
          line.endsWith('>') ||
          line.endsWith('❯') ||
          line.includes('[y/n]') ||
          line.includes('(y/n)') ||
          combined.includes('confirm?') ||
          combined.includes('select an option') ||
          combined.includes('what would you like to do') ||
          combined.includes('claude is ready') ||
          combined.includes('cost:') ||
          combined.includes('agy ›') ||
          combined.includes('antigravity ›');

        if (isAntigravity) {
          setIsAwaitingInput(Boolean(isAgentPrompt));
        }

        const isShellPrompt =
          line.endsWith('>') ||
          line.endsWith('$') ||
          line.endsWith('#') ||
          line.endsWith('%');

        const now = Date.now();
        const duration = now - executionStartRef;

        if (isExecutingRef && (isAgentPrompt || isShellPrompt) && duration > 2000) {
          isExecutingRef = false;
          triggerCompletionChime();
        }
      } catch {}
    };

    let isFirstHistoryChunk = true;

    const safeFit = () => {
      if (isDisposed || !containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth < 40 || clientHeight < 40) return;

      const buffer = term.buffer.active;
      const wasAtBottom = buffer.viewportY >= buffer.baseY - 1;

      try {
        fitAddon.fit();
        if (wasAtBottom) {
          term.scrollToBottom();
        }
      } catch {}
    };

    const connectWs = () => {
      if (isDisposed) return;
      const wsUrl = getWsUrl(session.id);
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        retryCount = 0;
        if (!isFirstConnect) {
          // Reconnection occurred: reset terminal before scrollback history is replayed
          term.reset();
        }
        isFirstConnect = false;
        isFirstHistoryChunk = true;

        setTimeout(() => {
          if (isDisposed) return;
          safeFit();
          if (term.rows && term.cols && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }));
          }
        }, 50);
      };

      ws.onmessage = (event) => {
        const buffer = term.buffer.active;
        const wasAtBottom = isFirstHistoryChunk || buffer.viewportY >= buffer.baseY - 1;

        const onWriteDone = () => {
          if (isFirstHistoryChunk) {
            isFirstHistoryChunk = false;
            term.scrollToBottom();
          } else if (wasAtBottom) {
            term.scrollToBottom();
          } else {
            const dist = term.buffer.active.baseY - term.buffer.active.viewportY;
            if (dist > 1) {
              setIsScrolledUp(true);
              setLinesScrolledUp(dist);
            }
          }
        };

        if (typeof event.data === 'string') {
          term.write(event.data, onWriteDone);
        } else if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data), onWriteDone);
        }
        if (isAntigravity) {
          setIsAwaitingInput(false);
        }
        clearTimeout(checkInputTimer);
        checkInputTimer = setTimeout(checkAwaitingInputOrCompletion, 500);
      };

      ws.onclose = (event) => {
        if (isDisposed) return;
        // If closed abnormally (e.g. sleep/wake, Wi-Fi loss, server restart), reconnect with backoff
        if (event.code !== 1000) {
          const delay = Math.min(1000 * Math.pow(1.5, retryCount), 8000);
          retryCount++;
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectWs, delay);
        }
      };

      ws.onerror = () => {
        // ws.onclose handles scheduling reconnection
      };
    };

    connectWs();

    // Reconnect immediately when user switches back to tab or device comes online
    const handleOnlineOrVisible = () => {
      if (isDisposed) return;
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          clearTimeout(reconnectTimeout);
          connectWs();
        }
      }
    };
    window.addEventListener('online', handleOnlineOrVisible);
    document.addEventListener('visibilitychange', handleOnlineOrVisible);

    const onScrollDisposable = term.onScroll(() => {
      const buffer = term.buffer.active;
      const dist = buffer.baseY - buffer.viewportY;
      const isUp = dist > 2;
      setIsScrolledUp(isUp);
      setLinesScrolledUp(isUp ? dist : 0);
    });

    const onBellDisposable = term.onBell(() => {
      setIsBelling(true);
      playVeronChime();
      setTimeout(() => setIsBelling(false), 600);
    });

    const onDataDisposable = term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
      if (data.includes('\r') || data.includes('\n')) {
        // User entered a command
        executionStartRef = Date.now();
        isExecutingRef = true;
      }
      if (isAntigravity) {
        setIsAwaitingInput(false);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      safeFit();
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (isDisposed) return;
        safeFit();
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && term.rows && term.cols) {
          wsRef.current.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }));
        }
      }, 60);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      isDisposed = true;
      clearTimeout(reconnectTimeout);
      clearTimeout(resizeTimeout);
      window.removeEventListener('online', handleOnlineOrVisible);
      document.removeEventListener('visibilitychange', handleOnlineOrVisible);
      resizeObserver.disconnect();
      clearTimeout(checkInputTimer);
      onScrollDisposable.dispose();
      onBellDisposable.dispose();
      onDataDisposable.dispose();
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close(1000);
      }
      searchAddonRef.current = null;
      term.dispose();
    };
  }, [session?.id, isAntigravity]);

  // Dynamically update terminal theme on the fly without reconnecting or buffer reset
  useEffect(() => {
    if (termRef.current && activeTheme?.xterm) {
      termRef.current.options.theme = activeTheme.xterm;
    }
  }, [activeTheme]);

  const processAndUploadImage = async (imageFile: File | Blob) => {
    if (!session || isUploadingRef.current) return;
    isUploadingRef.current = true;
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        if (base64) {
          try {
            onToast(agyMode ? 'Archiving capture (AGY Mode)...' : 'Saving capture...');
            const shouldPaste = !agyMode;
            const res = await uploadScreenshot(
              base64,
              session.id,
              undefined,
              shouldPaste,
              capturePathFormat
            );
            const baseName = res.file_path.split('/').pop() || 'screenshot.png';
            let formattedPath = res.file_path;
            if (capturePathFormat === 'relative') {
              formattedPath = res.relative_path || res.file_path;
            } else if (capturePathFormat === 'markdown') {
              formattedPath = `![screenshot](file:///${res.file_path.replace(/^\/+/, '')})`;
            }
            
            // Invariant: Always copy formatted path to global clipboard so external agents & chats receive it immediately
            try {
              await copyToGlobalClipboard(formattedPath);
            } catch {}

            if (agyMode) {
              onToast(`Archived & copied: ${baseName}`);
            } else {
              onToast(`Captured & pasted: ${baseName}`);
            }
            onCaptureSaved?.();
          } catch (err) {
            console.error('Failed to upload screenshot', err);
            onToast('Failed to save image');
          } finally {
            isUploadingRef.current = false;
          }
        } else {
          isUploadingRef.current = false;
        }
      };
      reader.onerror = () => {
        isUploadingRef.current = false;
        onToast('Failed to read image');
      };
      reader.readAsDataURL(imageFile);
    } catch {
      isUploadingRef.current = false;
    }
  };

  const extractImageFile = (dataTransfer: DataTransfer | null): File | null => {
    if (!dataTransfer) return null;
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i];
        if (
          file.type.startsWith('image/') ||
          /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name)
        ) {
          return file;
        }
      }
    }
    if (dataTransfer.items && dataTransfer.items.length > 0) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const item = dataTransfer.items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) return file;
        }
      }
    }
    return null;
  };

  const tryReadClipboardImage = async (): Promise<boolean> => {
    if (!session || isUploadingRef.current) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], `screenshot_${Date.now()}.png`, {
              type: imageType,
            });
            await processAndUploadImage(file);
            return true;
          }
        }
      }
    } catch {
      // Permission denied or clipboard does not have an image
    }
    return false;
  };

  const pasteTextToTerminal = (text: string) => {
    if (!text) return;
    if (termRef.current) {
      termRef.current.paste(text);
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
    }
  };

  const performPaste = async () => {
    const now = Date.now();
    if (isPastingRef.current || now - lastPasteTimeRef.current < 250) {
      return;
    }
    lastPasteTimeRef.current = now;
    isPastingRef.current = true;

    try {
      // 1. Check for image first (for clipboard screenshot capture)
      const handled = await tryReadClipboardImage();
      if (handled) return;

      // 2. Read text from clipboard (with native backend fallback)
      const text = await readFromGlobalClipboard();
      if (text) {
        pasteTextToTerminal(text);
      }
    } catch (err) {
      console.error('Failed to paste from clipboard:', err);
    } finally {
      setTimeout(() => {
        isPastingRef.current = false;
      }, 100);
    }
  };

  performPasteRef.current = performPaste;

  // Whenever pane becomes active, focus the terminal instance so arrow keys & keyboard input work immediately
  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus();
    }
  }, [isActive]);

  useEffect(() => {
    if (!session) return;

    const handleNativePaste = async (event: ClipboardEvent) => {
      const now = Date.now();
      if (isPastingRef.current || now - lastPasteTimeRef.current < 250) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      lastPasteTimeRef.current = now;
      isPastingRef.current = true;

      try {
        // 1. Check for image first (synchronous check via clipboardData)
        const imageFile = extractImageFile(event.clipboardData);
        if (imageFile) {
          event.preventDefault();
          event.stopPropagation();
          await processAndUploadImage(imageFile);
          return;
        }

        // 2. Check for text (Ctrl+V, Win+V, context menu)
        let text =
          event.clipboardData?.getData('text/plain') ||
          event.clipboardData?.getData('text');

        if (!text) {
          try {
            text = await readFromGlobalClipboard();
          } catch {}
        }

        if (text) {
          event.preventDefault();
          event.stopPropagation();
          pasteTextToTerminal(text);
          return;
        }
      } finally {
        setTimeout(() => {
          isPastingRef.current = false;
        }, 100);
      }
    };

    const handleNativeDrop = async (event: DragEvent) => {
      const imageFile = extractImageFile(event.dataTransfer);
      if (imageFile) {
        event.preventDefault();
        event.stopPropagation();
        await processAndUploadImage(imageFile);
        return;
      }

      const text =
        event.dataTransfer?.getData('text/plain') ||
        event.dataTransfer?.getData('text');
      if (text) {
        event.preventDefault();
        event.stopPropagation();
        pasteTextToTerminal(text);
      }
    };

    const handleNativeDragOver = (event: DragEvent) => {
      if (event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files')) {
        event.preventDefault();
      }
    };

    // Right-click context menu: copy if selection exists, paste otherwise (standard terminal behavior)
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (termRef.current?.hasSelection()) {
        const selection = termRef.current.getSelection();
        if (selection) {
          copyToGlobalClipboard(selection);
          termRef.current.clearSelection();
          onToast('Copied to clipboard');
        }
      } else {
        performPasteRef.current();
      }
    };

    // Native browser copy event handler (guaranteed synchronous clipboardData injection)
    const handleNativeCopy = (event: ClipboardEvent) => {
      if (termRef.current?.hasSelection()) {
        const selection = termRef.current.getSelection();
        if (selection) {
          if (event.clipboardData) {
            event.clipboardData.setData('text/plain', selection);
            event.preventDefault();
          }
          copyToGlobalClipboard(selection).catch(() => {});
          onToast('Copied to clipboard');
        }
      }
    };

    // Auto-copy on select when mouse button is released (PuTTY / Windows Terminal style)
    const handleMouseUp = () => {
      setTimeout(() => {
        if (termRef.current?.hasSelection()) {
          const selection = termRef.current.getSelection();
          if (selection && selection.length > 0) {
            // Silently copy to Windows global clipboard so the user can switch windows and paste immediately!
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
      container.addEventListener('contextmenu', handleContextMenu);
    }

    const pane = paneRef.current;
    if (pane) {
      pane.addEventListener('drop', handleNativeDrop);
      pane.addEventListener('dragover', handleNativeDragOver);
    }

    // Global listener for active pane when focus might be outside xterm
    const handleWindowPaste = async (event: ClipboardEvent) => {
      if (!isActive) return;
      if (container && container.contains(event.target as Node)) {
        return;
      }
      await handleNativePaste(event);
    };

    const handleWindowCopy = (event: ClipboardEvent) => {
      if (!isActive) return;
      if (container && container.contains(event.target as Node)) {
        return;
      }
      handleNativeCopy(event);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isActive) return;
      // If event happened inside terminal container, attachCustomKeyEventHandler already handled it!
      if (container && container.contains(event.target as Node)) {
        return;
      }

      const isCKey =
        event.key.toLowerCase() === 'c' ||
        event.code === 'KeyC' ||
        event.key === 'с' ||
        event.key === 'С';

      if ((event.ctrlKey || event.metaKey) && isCKey && !event.altKey) {
        if (termRef.current?.hasSelection()) {
          const selection = termRef.current.getSelection();
          if (selection) {
            event.preventDefault();
            copyToGlobalClipboard(selection);
            onToast('Copied to clipboard');
            return;
          }
        }
      }

      const isVKey =
        event.key.toLowerCase() === 'v' ||
        event.code === 'KeyV' ||
        event.key === 'м' ||
        event.key === 'М';
      const isPasteKey =
        ((event.ctrlKey || event.metaKey) && isVKey && !event.altKey) ||
        (event.shiftKey && event.key === 'Insert');

      if (isPasteKey) {
        event.preventDefault();
        performPasteRef.current();
      }
    };

    window.addEventListener('paste', handleWindowPaste, { capture: true });
    window.addEventListener('copy', handleWindowCopy, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      if (container) {
        container.removeEventListener('paste', handleNativePaste, { capture: true });
        container.removeEventListener('copy', handleNativeCopy, { capture: true });
        container.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('contextmenu', handleContextMenu);
      }
      if (pane) {
        pane.removeEventListener('drop', handleNativeDrop);
        pane.removeEventListener('dragover', handleNativeDragOver);
      }
      window.removeEventListener('paste', handleWindowPaste, { capture: true });
      window.removeEventListener('copy', handleWindowCopy, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [session?.id, isActive]);

  const handleOpenFileDialog = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !session) return;

    onToast(`Processing ${files.length} image${files.length > 1 ? 's' : ''}...`);

    try {
      const items: { image: string; filename: string }[] = await Promise.all(
        Array.from(files).map((file) => {
          return new Promise<{ image: string; filename: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                image: reader.result as string,
                filename: file.name,
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      const res = await uploadBatchScreenshots(items, session.id, capturePathFormat);
      onToast(`Attached ${res.count} image${res.count > 1 ? 's' : ''}`);

      let batchClipboard = res.paths_string;
      if (capturePathFormat === 'absolute' && res.files) {
        batchClipboard = res.files
          .map((f) => (f.file_path.includes(' ') ? `"${f.file_path}"` : f.file_path))
          .join(' ');
      } else if (capturePathFormat === 'markdown' && res.files) {
        batchClipboard = res.files
          .map((f) => `![screenshot](file:///${f.file_path.replace(/^\/+/, '')})`)
          .join('\n');
      }

      try {
        await copyToGlobalClipboard(batchClipboard);
      } catch {}

      onCaptureSaved?.();
    } catch (err) {
      console.error('Failed to upload batch images', err);
      onToast('Failed to upload images');
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
      <div
        className={`flex-1 flex flex-col items-center justify-center border border-dashed rounded-xl m-1 p-6 transition-all duration-300 ease-apple ${
          isDragOver
            ? 'border-accent bg-accent/10 ring-2 ring-accent/80 scale-[0.99]'
            : 'border-white/[0.08] hover:border-accent/30 text-zinc-500 bg-[#0d0e13]/60 hover:bg-[#0d0e13]/80'
        }`}
      >
        {isAntigravity ? (
          <AntigravityIcon size={28} mode="accent" className="mb-2 opacity-50" />
        ) : (
          <TermIcon className="w-8 h-8 mb-2 opacity-30 text-accent" />
        )}
        <p className="text-xs font-medium text-zinc-400">
          {isAntigravity ? 'Empty AGY Slot' : 'Empty Slot'}
        </p>
        <button
          onClick={onSplit}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] hover:text-accent text-xs text-zinc-300 rounded-lg transition-all duration-200 ease-apple border border-white/[0.06] press-scale"
        >
          {isAntigravity ? (
            <>
              <AntigravityIcon size={13} mode="gradient" />
              <span>Launch AGY</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Launch Shell</span>
            </>
          )}
        </button>
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <div
      ref={paneRef}
      onMouseDown={() => {
        onFocus();
      }}
      onClick={() => {
        onFocus();
        termRef.current?.focus();
      }}
      className={`relative flex flex-col flex-1 min-w-0 min-h-0 rounded-xl overflow-hidden transition-all duration-200 ease-apple ${
        isDark
          ? 'bg-[#0c0d12] shadow-card'
          : 'bg-white shadow-sm'
      } ${
        isDragOver
          ? 'ring-2 ring-amber-400 bg-amber-400/[0.04] shadow-[0_0_30px_rgba(245,158,11,0.4)] scale-[0.995] border-amber-400'
          : isBelling
          ? 'ring-2 ring-amber-400/90 shadow-[0_0_25px_rgba(245,158,11,0.5)] border-amber-400'
          : isActive
            ? 'border-amber-400 ring-1 ring-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
            : isDark
            ? 'border border-white/[0.08] hover:border-white/[0.2]'
            : 'border border-zinc-200 hover:border-zinc-300'
      }`}
    >
      {/* Precision Pane Header */}
      <div
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button, input')) return;
          if (slotIndex !== undefined && onStartDrag && session) {
            onStartDrag(slotIndex, session, e);
          }
        }}
        className={`h-9 px-3 flex items-center justify-between select-none border-b transition-colors duration-150 cursor-grab active:cursor-grabbing ${
          isDark
            ? isActive
              ? 'bg-[#141620] border-amber-400/30 text-zinc-100'
              : 'bg-[#121319] border-white/[0.06] text-zinc-400'
            : isActive
            ? 'bg-amber-50 border-amber-400/30 text-zinc-900'
            : 'bg-zinc-50 border-zinc-200 text-zinc-700'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Restrained Accent Pip */}
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors shrink-0 ${
              session.is_alive ? 'bg-accent shadow-[0_0_6px_var(--veron-accent-glow)]' : 'bg-zinc-600'
            }`}
          />
          {isEditingName ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => {
                setIsEditingName(false);
                if (newName.trim() && newName !== session.name) {
                  onRename?.(newName.trim());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingName(false);
                  if (newName.trim() && newName !== session.name) {
                    onRename?.(newName.trim());
                  }
                } else if (e.key === 'Escape') {
                  setIsEditingName(false);
                  setNewName(session.name);
                }
              }}
              className="text-xs font-medium bg-[#090a0d] border border-accent/60 rounded px-1.5 py-0.5 text-zinc-100 outline-none w-28 shrink-0"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditingName(true)}
              title="Double click to rename session (Drag header to reorder)"
              className="text-xs font-medium truncate min-w-0 flex-shrink text-zinc-100 tracking-tight cursor-pointer hover:text-accent transition-colors"
            >
              {session.name}
            </span>
          )}
          {isAntigravity && isAwaitingInput && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/15 text-accent border border-accent/30 animate-pulse shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--veron-accent-glow)]"></span>
              Needs Input
            </span>
          )}
          <button
            onClick={copyCwd}
            title={`Copy: ${session.cwd}`}
            className="hidden md:flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-accent truncate max-w-[140px] shrink-0 transition-all duration-200 ease-apple press-scale"
          >
            <Folder className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="truncate">{session.cwd.split('\\').pop() || session.cwd}</span>
            {isCopiedPath ? <Check className="w-2.5 h-2.5 text-accent shrink-0" /> : null}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {/* AGY Mode Toggle Pill */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleAgyMode?.();
            }}
            title={
              agyMode
                ? 'AGY Mode Active: AGY attaches images natively. Terminal path injection muted; formatted path copied to clipboard. Click to toggle Direct Path mode.'
                : 'Direct Path Mode Active: Types formatted file path directly into terminal prompt on Ctrl+V. Click to toggle AGY mode.'
            }
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-all duration-200 ease-apple cursor-pointer select-none press-scale ${
              agyMode
                ? 'bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20'
                : 'bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:text-zinc-200 hover:bg-white/[0.08]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                agyMode ? 'bg-accent shadow-[0_0_5px_var(--veron-accent-glow)]' : 'bg-zinc-500'
              }`}
            />
            <span>{agyMode ? 'AGY' : 'Path'}</span>
          </button>

          <button
            onClick={async (e) => {
              e.stopPropagation();
              const handled = await tryReadClipboardImage();
              if (!handled) {
                onToast('No image in clipboard');
              }
            }}
            title={
              agyMode
                ? 'Save screenshot from clipboard (Ctrl+V) [AGY Mode: copies path to clipboard]'
                : 'Paste screenshot from clipboard (Ctrl+V) [Direct Path Mode: injects path to prompt]'
            }
            className="p-1 rounded text-zinc-400 hover:text-accent hover:bg-white/[0.06] cursor-pointer transition-all duration-200 ease-apple press-scale"
          >
            <Image className="w-3.5 h-3.5" />
          </button>

          {/* Input images from Explorer */}
          <button
            onClick={handleOpenFileDialog}
            title="Input images (Select multiple from Explorer and insert relative paths)"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-zinc-400 hover:text-accent hover:bg-white/[0.06] cursor-pointer transition-all duration-200 ease-apple press-scale"
          >
            <ImagePlus className="w-3.5 h-3.5 text-accent" />
            <span className="hidden 2xl:inline text-[11px] font-medium">Input images</span>
          </button>

          {/* In-Buffer Search Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSearchOpen((prev) => {
                const next = !prev;
                if (next) {
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                } else {
                  searchAddonRef.current?.clearDecorations();
                  termRef.current?.focus();
                }
                return next;
              });
            }}
            title="Search buffer (Ctrl+F)"
            className={`p-1 rounded cursor-pointer transition-all duration-200 ease-apple press-scale ${
              isSearchOpen
                ? 'bg-accent/15 text-accent'
                : 'text-zinc-400 hover:text-accent hover:bg-white/[0.06]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Export Session Log */}
          <button
            onClick={handleExportSession}
            disabled={isExporting}
            title="Export session history log (.log / text)"
            className="p-1 rounded text-zinc-400 hover:text-accent hover:bg-white/[0.06] cursor-pointer transition-all duration-200 ease-apple press-scale disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce text-accent' : ''}`} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSplit();
            }}
            title="Split pane"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all duration-200 ease-apple press-scale"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onMaximize();
            }}
            title={isMaximized ? 'Restore pane' : 'Maximize pane'}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all duration-200 ease-apple press-scale"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close session"
            className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-white/[0.06] transition-all duration-200 ease-apple press-scale"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hidden file input for Explorer multi-image selection */}
      <input
        type="file"
        file-input="true"
        ref={fileInputRef}
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Terminal Viewport */}
      <div className="flex-1 relative w-full h-full overflow-hidden p-1">
        <div ref={containerRef} className="w-full h-full" />

        {/* Floating In-Buffer Search Bar (Ctrl+F) */}
        {isSearchOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-2 right-4 z-40 flex items-center gap-1.5 p-1.5 rounded-xl bg-[#0f1118]/95 backdrop-blur-md border border-amber-400/40 shadow-2xl text-xs text-zinc-200 select-none animate-in fade-in zoom-in-95 duration-150"
          >
            <Search className="w-3.5 h-3.5 text-accent shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                handleSearchNext(val, searchCaseSensitive, searchRegex);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    handleSearchPrev();
                  } else {
                    handleSearchNext();
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCloseSearch();
                }
              }}
              placeholder="Search buffer..."
              className="bg-black/50 border border-white/10 focus:border-amber-400/70 text-zinc-100 placeholder-zinc-500 rounded px-2 py-0.5 text-xs outline-none w-36 sm:w-48 font-mono"
              autoFocus
            />

            {/* Match Counter Badge */}
            <span className="text-[10px] font-mono text-zinc-400 min-w-8 text-center shrink-0">
              {searchQuery
                ? searchMatchTotal > 0
                  ? `${searchMatchIndex >= 0 ? searchMatchIndex + 1 : '?'}/${searchMatchTotal}`
                  : '0/0'
                : ''}
            </span>

            {/* Prev Match Button */}
            <button
              type="button"
              onClick={() => handleSearchPrev()}
              title="Previous match (Shift+Enter)"
              className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-colors press-scale"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>

            {/* Next Match Button */}
            <button
              type="button"
              onClick={() => handleSearchNext()}
              title="Next match (Enter)"
              className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-colors press-scale"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {/* Case Sensitive Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !searchCaseSensitive;
                setSearchCaseSensitive(next);
                handleSearchNext(searchQuery, next, searchRegex);
              }}
              title={searchCaseSensitive ? 'Case Sensitive: ON' : 'Case Sensitive: OFF'}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all press-scale ${
                searchCaseSensitive
                  ? 'bg-accent/20 text-accent border border-accent/40'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]'
              }`}
            >
              Aa
            </button>

            {/* Regex Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !searchRegex;
                setSearchRegex(next);
                handleSearchNext(searchQuery, searchCaseSensitive, next);
              }}
              title={searchRegex ? 'Regular Expression: ON' : 'Regular Expression: OFF'}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all press-scale ${
                searchRegex
                  ? 'bg-accent/20 text-accent border border-accent/40'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]'
              }`}
            >
              .*
            </button>

            {/* Close Search */}
            <button
              type="button"
              onClick={handleCloseSearch}
              title="Close search (Esc)"
              className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-red-400 transition-colors press-scale ml-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Pulsing Energy Sphere Loader on Launch */}
        {isLoading && (
          <div className="absolute inset-0 bg-[#0c0d12]/95 backdrop-blur-sm flex flex-col items-center justify-center z-30 transition-opacity duration-300 pointer-events-none">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-14 h-14 rounded-full bg-accent/20 animate-ping" />
              <div className="absolute w-10 h-10 rounded-full border border-accent/40 animate-pulse" />
              <div
                className="w-5 h-5 rounded-full shadow-accent animate-pulse"
                style={{
                  backgroundColor: activeTheme?.accent || 'var(--veron-accent)',
                  boxShadow: `0 0 20px var(--veron-accent), 0 0 8px var(--veron-accent-hover)`,
                }}
              />
            </div>
            <div className="mt-4 flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-accent/90 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
              <span>INITIALIZING CONPTY SHELL...</span>
            </div>
          </div>
        )}

        {/* Floating "Scroll to Bottom" Quick Action Pill */}
        {isScrolledUp && (
          <button
            type="button"
            onClick={handleScrollToBottom}
            title="Scroll to bottom (Shift+End)"
            className="absolute bottom-4 right-5 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent hover:bg-amber-400 text-zinc-950 font-semibold text-xs shadow-lg shadow-accent/25 hover:shadow-accent/40 border border-amber-300/40 transition-all duration-200 ease-apple press-scale cursor-pointer animate-in fade-in slide-in-from-bottom-2 select-none"
          >
            <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>
              {linesScrolledUp > 1 ? `Bottom (${linesScrolledUp} lines)` : 'Scroll to bottom'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
