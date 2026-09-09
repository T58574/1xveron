import React, { useEffect, useState } from 'react';
import { CapturesInfo, SessionInfo, SystemInfo, Workspace, LayoutMode } from './types';
import {
  fetchSessions,
  fetchSystemInfo,
  fetchWorkspaces,
  fetchCapturesInfo,
  clearCaptures,
  openCapturesFolder,
  sendSessionInput,
  renameSession,
  createSession,
  closeSession,
  getAuthToken,
  setAuthToken,
  verifyToken,
} from './services/api';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TerminalPane } from './components/TerminalPane';
import { RemoteModal } from './components/RemoteModal';
import { QuickScriptsModal } from './components/QuickScriptsModal';
import { MobileView } from './components/MobileView';
import { KeyRound, ShieldAlert } from 'lucide-react';

export const App: React.FC = () => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [capturesInfo, setCapturesInfo] = useState<CapturesInfo | null>(null);

  // Slot-to-Session Persistence: 6 fixed slots
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const [activePaneIndex, setActivePaneIndex] = useState<number>(0);

  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    const saved = localStorage.getItem('veron_layout_mode');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 1 && parsed <= 6) return parsed as LayoutMode;
    }
    return 1;
  });

  const handleSetLayoutMode = (mode: LayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem('veron_layout_mode', String(mode));
  };

  const [maximizedPaneIndex, setMaximizedPaneIndex] = useState<number | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [isQuickScriptsOpen, setIsQuickScriptsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toast, setToast] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [pinInput, setPinInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Resize listener for mobile mode
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global Keyboard Shortcut: Ctrl+K / Cmd+K for Quick Scripts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickScriptsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Theme synchronization
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      try {
        const sys = await fetchSystemInfo().catch(() => null);
        if (sys) {
          setSystemInfo(sys);
          setIsAuthenticated(true);
          if (sys.auth_token) {
            setAuthToken(sys.auth_token);
          }
        }

        const [sess, ws, caps] = await Promise.all([
          fetchSessions().catch((e) => {
            if (e.message?.includes('401') || !getAuthToken()) {
              setIsAuthenticated(false);
            }
            return [];
          }),
          fetchWorkspaces().catch(() => []),
          fetchCapturesInfo().catch(() => null),
        ]);

        if (ws) setWorkspaces(ws);
        if (caps) setCapturesInfo(caps);
        if (sess && sess.length > 0) {
          setSessions(sess);
          setSlots((prev) => {
            const next = [...prev];
            let sIdx = 0;
            for (let i = 0; i < 6; i++) {
              if (!next[i] && sIdx < sess.length) {
                if (!next.includes(sess[sIdx].id)) {
                  next[i] = sess[sIdx].id;
                }
                sIdx++;
              }
            }
            if (!next[0] && sess.length > 0) {
              next[0] = sess[0].id;
            }
            return next;
          });
        }
      } catch (e) {
        console.error('Initial load error:', e);
      }
    };

    loadData();

    const interval = setInterval(async () => {
      try {
        const sess = await fetchSessions();
        if (sess && sess.length > 0) {
          setSessions(sess);
          setSlots((prev) => {
            if (!prev[0] && sess.length > 0) {
              const next = [...prev];
              next[0] = sess[0].id;
              return next;
            }
            return prev;
          });
        }
        const caps = await fetchCapturesInfo();
        setCapturesInfo(caps);
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const valid = await verifyToken(pinInput.trim());
    if (valid) {
      setIsAuthenticated(true);
      showToast('Authenticated successfully!');
      try {
        const sess = await fetchSessions();
        setSessions(sess);
      } catch {}
    } else {
      setAuthError('Invalid PIN / Auth Token. Check PC screen.');
    }
  };

  const handleCreateSession = async (shell?: string) => {
    try {
      const newSession = await createSession({ shell });
      setSessions((prev) => [...prev, newSession]);

      // Assign new session to the active pane if empty, or first available slot
      setSlots((prev) => {
        const next = [...prev];
        if (!next[activePaneIndex]) {
          next[activePaneIndex] = newSession.id;
        } else {
          const firstEmpty = next.findIndex((s) => s === null);
          if (firstEmpty !== -1) {
            next[firstEmpty] = newSession.id;
            setActivePaneIndex(firstEmpty);
          }
        }
        return next;
      });

      showToast(`Started ${newSession.name}`);
    } catch (e) {
      showToast('Failed to start session');
    }
  };

  const handleCloseSession = async (id: string) => {
    try {
      await closeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      // Set slot to null without shifting other slots
      setSlots((prev) => prev.map((sid) => (sid === id ? null : sid)));
      showToast('Session closed');
    } catch {
      showToast('Failed to close session');
    }
  };

  const handleClearCaptures = async () => {
    try {
      const count = await clearCaptures();
      setCapturesInfo({ count: 0, size_bytes: 0, size_formatted: '0 KB' });
      showToast(`Deleted ${count} screenshot files`);
    } catch {
      showToast('Failed to clear screenshots');
    }
  };

  const handleOpenCapturesFolder = async () => {
    try {
      await openCapturesFolder();
      showToast('Opened captures in Windows Explorer');
    } catch {
      showToast('Failed to open captures folder');
    }
  };

  // Helper to get session for a slot index
  const getSessionForSlot = (idx: number): SessionInfo | undefined => {
    const sid = slots[idx];
    if (!sid) return undefined;
    return sessions.find((s) => s.id === sid);
  };

  // Active session and ID in the currently focused active pane
  const activeSession = getSessionForSlot(activePaneIndex) || sessions[0] || null;
  const activeSessionId = activeSession?.id || null;

  const handleExecuteScript = async (command: string, autoExecute: boolean = true) => {
    if (!activeSessionId) {
      showToast('No active terminal session to execute script');
      return;
    }
    const dataToSend = autoExecute ? `${command}\r` : command;
    try {
      await sendSessionInput(activeSessionId, dataToSend);
      const preview = command.length > 30 ? `${command.slice(0, 30)}...` : command;
      showToast(`Ran: ${preview}`);
    } catch {
      showToast('Failed to send command to terminal');
    }
  };

  const handleRenameSession = async (id: string, newName: string) => {
    try {
      await renameSession(id, newName);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, name: newName } : s))
      );
      showToast(`Renamed to "${newName}"`);
    } catch {
      showToast('Failed to rename session');
    }
  };

  const handleSplitPane = async () => {
    if (layoutMode < 6) {
      const nextMode = (layoutMode + 1) as LayoutMode;
      handleSetLayoutMode(nextMode);
    }
    await handleCreateSession();
  };

  // If unauthenticated (e.g. mobile client connecting over LAN without token)
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#090a0d] text-white p-4">
        <form
          onSubmit={handleAuthSubmit}
          className="w-full max-w-sm bg-[#0f1015] border border-white/[0.08] rounded-2xl p-6 shadow-2xl flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Veron Authorization</h2>
              <p className="text-xs text-zinc-400">Enter PIN / Auth Token shown on PC</p>
            </div>
          </div>

          {authError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <input
            type="text"
            placeholder="e.g. A3F91B2C"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.toUpperCase())}
            className="w-full bg-[#090a0d] border border-white/[0.1] rounded-lg px-3 py-2 text-center text-lg tracking-widest font-mono uppercase text-amber-400 outline-none focus:border-amber-400 transition-colors"
            autoFocus
          />

          <button
            type="submit"
            className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-semibold rounded-lg text-sm transition-all duration-150 shadow-sm"
          >
            Connect to Veron
          </button>
        </form>
      </div>
    );
  }

  // Mobile Couch Mode
  if (isMobile) {
    return (
      <MobileView
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          // Set in slot 0 for mobile
          setSlots((prev) => {
            const next = [...prev];
            next[0] = id;
            return next;
          });
        }}
        onCreateSession={handleCreateSession}
        theme={theme}
      />
    );
  }

  // Helper to render a terminal pane for slot index
  const renderPane = (idx: number) => {
    const s = getSessionForSlot(idx);
    return (
      <TerminalPane
        key={idx}
        session={s}
        isActive={activePaneIndex === idx}
        isMaximized={maximizedPaneIndex === idx}
        onFocus={() => setActivePaneIndex(idx)}
        onClose={() => {
          if (s) handleCloseSession(s.id);
        }}
        onMaximize={() => setMaximizedPaneIndex(maximizedPaneIndex === idx ? null : idx)}
        onSplit={handleSplitPane}
        onRename={(name) => {
          if (s) handleRenameSession(s.id, name);
        }}
        theme={theme}
        onToast={showToast}
      />
    );
  };

  // Render desktop grid layout based on 1 to 6 windows
  const renderGridLayout = () => {
    if (maximizedPaneIndex !== null) {
      return renderPane(maximizedPaneIndex);
    }

    switch (layoutMode) {
      case 1:
        return (
          <div className="flex-1 flex w-full h-full min-h-0 min-w-0">
            {renderPane(0)}
          </div>
        );

      case 2:
        return (
          <div className="flex-1 flex gap-2 w-full h-full min-h-0 min-w-0">
            {[0, 1].map(renderPane)}
          </div>
        );

      case 3:
        // BridgeMind style: 1 tall left + 2 stacked right
        return (
          <div className="flex-1 flex gap-2 w-full h-full min-h-0 min-w-0">
            <div className="flex-1 flex min-w-0 min-h-0">
              {renderPane(0)}
            </div>
            <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
              {[1, 2].map(renderPane)}
            </div>
          </div>
        );

      case 4:
        // 2x2 Grid
        return (
          <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 w-full h-full min-h-0 min-w-0">
            {[0, 1, 2, 3].map(renderPane)}
          </div>
        );

      case 5:
        // 2 on top, 3 on bottom
        return (
          <div className="flex-1 flex flex-col gap-2 w-full h-full min-h-0 min-w-0">
            <div className="flex-1 flex gap-2 min-h-0 min-w-0">
              {[0, 1].map(renderPane)}
            </div>
            <div className="flex-1 flex gap-2 min-h-0 min-w-0">
              {[2, 3, 4].map(renderPane)}
            </div>
          </div>
        );

      case 6:
        // 2 rows of 3 columns (2x3 Grid)
        return (
          <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-2 w-full h-full min-h-0 min-w-0">
            {[0, 1, 2, 3, 4, 5].map(renderPane)}
          </div>
        );
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden select-none transition-colors ${
        isDark ? 'bg-[#090a0d] text-[#f1f5f9]' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Left Sidebar (BridgeMind & Warp Session Manager) */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        workspaces={workspaces}
        systemInfo={systemInfo}
        capturesInfo={capturesInfo}
        onClearCaptures={handleClearCaptures}
        onOpenCapturesFolder={handleOpenCapturesFolder}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onSelectSession={(id) => {
          // If clicked session is already in one of the active slots, focus it!
          const slotIdx = slots.findIndex((sid, i) => sid === id && i < layoutMode);
          if (slotIdx !== -1) {
            setActivePaneIndex(slotIdx);
          } else {
            // Otherwise place it into the currently focused active pane
            setSlots((prev) => {
              const next = [...prev];
              next[activePaneIndex] = id;
              return next;
            });
          }
        }}
        onCreateSession={handleCreateSession}
        onCloseSession={handleCloseSession}
        onOpenRemoteModal={() => setIsRemoteModalOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Top Bar with 1-6 layout switcher */}
        <TopBar
          layoutMode={layoutMode}
          onChangeLayout={handleSetLayoutMode}
          systemInfo={systemInfo}
          onOpenRemoteModal={() => setIsRemoteModalOpen(true)}
          onOpenQuickScripts={() => setIsQuickScriptsOpen(true)}
          onCreateSession={handleCreateSession}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        />

        {/* Dynamic Card Grid (1 to 6 Panes) */}
        <main className="flex-1 flex p-2 min-h-0 min-w-0 overflow-hidden">
          {renderGridLayout()}
        </main>
      </div>

      {/* Local Wi-Fi Remote Modal */}
      <RemoteModal
        isOpen={isRemoteModalOpen}
        onClose={() => setIsRemoteModalOpen(false)}
        systemInfo={systemInfo}
      />

      {/* Quick Scripts / Command Palette Modal */}
      <QuickScriptsModal
        isOpen={isQuickScriptsOpen}
        onClose={() => setIsQuickScriptsOpen(false)}
        onExecuteScript={handleExecuteScript}
        activeSessionName={activeSession?.name}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-3.5 py-2 rounded-lg bg-[#0f1015]/95 border border-amber-400/40 text-amber-200 text-xs shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150">
          {toast}
        </div>
      )}
    </div>
  );
};
export default App;
