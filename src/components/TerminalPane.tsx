import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Maximize2, Minimize2, X, Plus, Terminal as TermIcon, Image, ImagePlus, Folder, Check } from 'lucide-react';
import { SessionInfo } from '../types';
import { getWsUrl, uploadScreenshot, uploadBatchScreenshots } from '../services/api';

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
  onToast: (msg: string) => void;
  onCaptureSaved?: () => void;
  agyMode?: boolean;
  onToggleAgyMode?: () => void;
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
  onToast,
  onCaptureSaved,
  agyMode = true,
  onToggleAgyMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isUploadingRef = useRef(false);
  const lastPasteHandledTimeRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCopiedPath, setIsCopiedPath] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(session?.name || '');

  useEffect(() => {
    setNewName(session?.name || '');
  }, [session?.name]);

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
      fitAddon.fit();
    } catch {}

    // Key handler: Ctrl+Enter (multiline newline), Ctrl+C (copy when selected), Ctrl+Shift+C/V
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type === 'keydown') {
        // 1. Ctrl+Enter or Shift+Enter -> Newline (\n) for multi-line prompts (agy, Claude CLI, REPL)
        if (event.key === 'Enter' && (event.ctrlKey || event.shiftKey)) {
          event.preventDefault();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data: '\n' }));
          }
          return false;
        }

        // 2. Ctrl+C with active selection -> Copy text to clipboard without sending SIGINT
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === 'c' &&
          !event.altKey &&
          !event.shiftKey
        ) {
          if (term.hasSelection()) {
            const selection = term.getSelection();
            if (selection) {
              navigator.clipboard.writeText(selection);
              return false; // Prevent sending SIGINT when copying!
            }
          }
          return true; // No selection -> let Ctrl+C pass through to send SIGINT
        }

        // 3. Ctrl+Shift+C -> Always copy selection
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
          if (term.hasSelection()) {
            const selection = term.getSelection();
            if (selection) {
              navigator.clipboard.writeText(selection);
            }
          }
          return false;
        }

        // 4. Ctrl+Shift+V -> Always paste from clipboard
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v') {
          navigator.clipboard
            .readText()
            .then((text) => {
              if (text && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'input', data: text }));
              }
            })
            .catch(() => {});
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
            const res = await uploadScreenshot(base64, session.id, undefined, shouldPaste);
            const relPath = res.relative_path || res.file_path;
            
            if (agyMode) {
              onToast(`Archived: ${relPath} (AGY attached)`);
            } else {
              onToast(`Captured: ${relPath}`);
              try {
                await navigator.clipboard.writeText(relPath);
              } catch {}
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

  useEffect(() => {
    if (!session) return;

    const handleNativePaste = async (event: ClipboardEvent) => {
      // 1. Check for image first
      const imageFile = extractImageFile(event.clipboardData);
      if (imageFile) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        lastPasteHandledTimeRef.current = Date.now();
        await processAndUploadImage(imageFile);
        return;
      }

      // 2. Check for text (Ctrl+V, Win+V, context menu)
      const text =
        event.clipboardData?.getData('text/plain') ||
        event.clipboardData?.getData('text');
      if (text) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        lastPasteHandledTimeRef.current = Date.now();

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
        } else if (termRef.current) {
          termRef.current.paste(text);
        }
        return;
      }
    };

    const handleNativeDrop = async (event: DragEvent) => {
      const imageFile = extractImageFile(event.dataTransfer);
      if (imageFile) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        await processAndUploadImage(imageFile);
      }
    };

    const handleNativeDragOver = (event: DragEvent) => {
      if (event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files')) {
        event.preventDefault();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('paste', handleNativePaste, { capture: true });
      container.addEventListener('drop', handleNativeDrop, { capture: true });
      container.addEventListener('dragover', handleNativeDragOver, { capture: true });
    }

    // Global listener for active pane
    const handleWindowPaste = async (event: ClipboardEvent) => {
      if (!isActive) return;
      if (container && container.contains(event.target as Node)) {
        return;
      }
      const imageFile = extractImageFile(event.clipboardData);
      if (imageFile) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        lastPasteHandledTimeRef.current = Date.now();
        await processAndUploadImage(imageFile);
        return;
      }

      const text =
        event.clipboardData?.getData('text/plain') ||
        event.clipboardData?.getData('text');
      if (text) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        lastPasteHandledTimeRef.current = Date.now();

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
        } else if (termRef.current) {
          termRef.current.paste(text);
        }
        return;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isActive) return;
      const isPasteKey =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && !event.altKey;
      const isShiftInsert = event.shiftKey && event.key === 'Insert';
      if (isPasteKey || isShiftInsert) {
        setTimeout(async () => {
          if (Date.now() - lastPasteHandledTimeRef.current > 80) {
            const handled = await tryReadClipboardImage();
            if (!handled) {
              try {
                const text = await navigator.clipboard.readText();
                if (text && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
                }
              } catch {}
            }
          }
        }, 50);
      }
    };

    window.addEventListener('paste', handleWindowPaste, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      if (container) {
        container.removeEventListener('paste', handleNativePaste, { capture: true });
        container.removeEventListener('drop', handleNativeDrop, { capture: true });
        container.removeEventListener('dragover', handleNativeDragOver, { capture: true });
      }
      window.removeEventListener('paste', handleWindowPaste, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [session?.id, isActive]);

  const handlePasteOrDrop = async (event: React.ClipboardEvent | React.DragEvent) => {
    let dataTransfer: DataTransfer | null = null;
    if ('clipboardData' in event) {
      dataTransfer = event.clipboardData;
    } else if ('dataTransfer' in event) {
      dataTransfer = event.dataTransfer;
    }
    const imageFile = extractImageFile(dataTransfer);
    if (imageFile && session) {
      event.preventDefault();
      event.stopPropagation();
      await processAndUploadImage(imageFile);
      return;
    }

    const text =
      dataTransfer?.getData('text/plain') ||
      dataTransfer?.getData('text');
    if (text && session) {
      event.preventDefault();
      event.stopPropagation();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
      } else if (termRef.current) {
        termRef.current.paste(text);
      }
    }
  };

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

      const res = await uploadBatchScreenshots(items, session.id);
      onToast(`Attached ${res.count} image${res.count > 1 ? 's' : ''}`);

      try {
        await navigator.clipboard.writeText(res.paths_string);
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
              className="text-xs font-medium bg-[#090a0d] border border-amber-400/60 rounded px-1.5 py-0.5 text-zinc-100 outline-none w-28"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditingName(true)}
              title="Double click to rename session"
              className="text-xs font-medium truncate max-w-[150px] text-zinc-100 tracking-tight cursor-pointer hover:text-amber-400 transition-colors"
            >
              {session.name}
            </span>
          )}
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
        <div className="flex items-center gap-1">
          {/* AGY Mode Toggle Pill */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleAgyMode?.();
            }}
            title={
              agyMode
                ? 'AGY Mode Active: AGY attaches images natively from clipboard. Terminal path injection muted. Click to toggle Direct Path mode.'
                : 'Direct Path Mode Active: Pastes relative file path into terminal prompt on Ctrl+V. Click to toggle AGY mode.'
            }
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-all duration-150 cursor-pointer select-none ${
              agyMode
                ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 hover:bg-amber-400/20'
                : 'bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:text-zinc-200 hover:bg-white/[0.08]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                agyMode ? 'bg-amber-400 shadow-[0_0_5px_rgba(245,158,11,0.8)]' : 'bg-zinc-500'
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
                ? 'Archive screenshot from clipboard (Ctrl+V) [AGY Mode: path muted]'
                : 'Paste screenshot from clipboard (Ctrl+V) [Direct Path Mode: injects path]'
            }
            className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-white/[0.06] cursor-pointer transition-colors"
          >
            <Image className="w-3.5 h-3.5" />
          </button>

          {/* Input images from Explorer */}
          <button
            onClick={handleOpenFileDialog}
            title="Input images (Select multiple from Explorer and insert relative paths)"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-zinc-400 hover:text-amber-400 hover:bg-white/[0.06] cursor-pointer transition-colors"
          >
            <ImagePlus className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline text-[11px] font-medium">Input images</span>
          </button>

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

      {/* Hidden file input for Explorer multi-image selection */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Terminal Viewport */}
      <div className="flex-1 relative w-full h-full overflow-hidden p-1">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
