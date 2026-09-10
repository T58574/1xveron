import React, { useEffect, useState } from 'react';
import { CapturesInfo, SessionInfo, SystemInfo, Workspace, LayoutMode } from './types';
import {
  fetchSessions,
  fetchSystemInfo,
  fetchWorkspaces,
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
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
import { SettingsModal } from './components/SettingsModal';
import { QuickScriptsModal } from './components/QuickScriptsModal';
import { CreateWorkspaceModal } from './components/CreateWorkspaceModal';
import { MobileView } from './components/MobileView';
import { KeyRound, ShieldAlert } from 'lucide-react';

export const App: React.FC = () => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [capturesInfo, setCapturesInfo] = useState<CapturesInfo | null>(null);

  // Active Workspace Group State
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('veron_active_workspace') || 'default';
  });

  // Slot-to-Session Persistence per Workspace: 6 fixed slots per workspace
  const [workspaceSlots, setWorkspaceSlots] = useState<Record<string, (string | null)[]>>({});
  // Layout Mode (1-6) per Workspace
  const [workspaceLayouts, setWorkspaceLayouts] = useState<Record<string, LayoutMode>>({});

  const [activePaneIndex, setActivePaneIndex] = useState<number>(0);
  const [maximizedPaneIndex, setMaximizedPaneIndex] = useState<number | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isQuickScriptsOpen, setIsQuickScriptsOpen] = useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toast, setToast] = useState<string | null>(null);

  // AGY Mode (native clipboard media attachments without terminal path injection)
  const [agyMode, setAgyMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('veron_agy_mode');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleAgyMode = (enabled?: boolean) => {
    setAgyMode((prev) => {
      const next = enabled !== undefined ? enabled : !prev;
      localStorage.setItem('veron_agy_mode', String(next));
      showToast(next ? 'AGY Mode enabled (Path paste muted)' : 'Direct Path Mode enabled');
      return next;
    });
  };

  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [pinInput, setPinInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Derived Active Workspace & Sessions
  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeWsId = activeWorkspace?.id || 'default';

  const activeWorkspaceSessions = sessions.filter(
    (s) => s.workspace_id === activeWsId || (!s.workspace_id && activeWsId === 'default')
  );

  const currentSlots = workspaceSlots[activeWsId] || [null, null, null, null, null, null];
  const currentLayoutMode: LayoutMode =
    workspaceLayouts[activeWsId] ||
    (Math.min(Math.max(activeWorkspaceSessions.length, 1), 6) as LayoutMode);

  const handleSetLayoutMode = (mode: LayoutMode) => {
    setWorkspaceLayouts((prev) => ({
      ...prev,
      [activeWsId]: mode,
    }));
  };

  const handleSelectWorkspace = (wsId: string) => {
    setActiveWorkspaceId(wsId);
    localStorage.setItem('veron_active_workspace', wsId);
    setMaximizedPaneIndex(null);
    setActivePaneIndex(0);
  };

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

  // Helper to synchronize slots with incoming sessions for a workspace
  const syncWorkspaceSlots = (
    currentWorkspaces: Workspace[],
    allSessions: SessionInfo[]
  ) => {
    setWorkspaceSlots((prev) => {
      const next: Record<string, (string | null)[]> = { ...prev };

      for (const ws of currentWorkspaces) {
        const wsSessions = allSessions.filter(
          (s) => s.workspace_id === ws.id || (!s.workspace_id && ws.id === 'default')
        );
        const existingSlots = next[ws.id]
          ? [...next[ws.id]]
          : [null, null, null, null, null, null];

        // 1. Remove session IDs that no longer exist
        for (let i = 0; i < 6; i++) {
          if (existingSlots[i] && !wsSessions.some((s) => s.id === existingSlots[i])) {
            existingSlots[i] = null;
          }
        }

        // 2. Add unassigned sessions to empty slots
        let wsIdx = 0;
        for (let i = 0; i < 6; i++) {
          if (!existingSlots[i] && wsIdx < wsSessions.length) {
            const candidate = wsSessions[wsIdx];
            if (!existingSlots.includes(candidate.id)) {
              existingSlots[i] = candidate.id;
            }
            wsIdx++;
          }
        }

        // Ensure slot 0 has first session if available
        if (!existingSlots[0] && wsSessions.length > 0) {
          existingSlots[0] = wsSessions[0].id;
        }

        next[ws.id] = existingSlots;
      }

      return next;
    });
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

        if (ws && ws.length > 0) {
          setWorkspaces(ws);
          // Verify active workspace exists
          if (!ws.some((w) => w.id === activeWorkspaceId)) {
            setActiveWorkspaceId(ws[0].id);
          }
        }
        if (caps) setCapturesInfo(caps);
        if (sess) {
          setSessions(sess);
          if (ws) {
            syncWorkspaceSlots(ws, sess);
          }
        }
      } catch (e) {
        console.error('Initial load error:', e);
      }
    };

    loadData();

    const interval = setInterval(async () => {
      try {
        const [sess, caps, ws] = await Promise.all([
          fetchSessions().catch(() => null),
          fetchCapturesInfo().catch(() => null),
          fetchWorkspaces().catch(() => null),
        ]);
        if (ws && ws.length > 0) {
          setWorkspaces(ws);
        }
        if (sess) {
          setSessions(sess);
          if (ws) {
            syncWorkspaceSlots(ws, sess);
          }
        }
        if (caps) setCapturesInfo(caps);
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

  const handleCreateSession = async (shell?: string, wsId?: string) => {
    const targetWsId = wsId || activeWsId;
    const targetWs = workspaces.find((w) => w.id === targetWsId) || activeWorkspace;
    const isAgy =
      targetWs?.kind === 'antigravity' ||
      targetWs?.name.toLowerCase().includes('antigravity') ||
      targetWs?.name.toLowerCase().includes('agy');
    const targetSessions = sessions.filter(
      (s) => s.workspace_id === targetWsId || (!s.workspace_id && targetWsId === 'default')
    );

    if (targetSessions.length >= 6) {
      showToast('Workspace limit reached (max 6 windows per group)');
      return;
    }

    try {
      const nextIndex = targetSessions.length + 1;
      const sessionName = isAgy ? `Antigravity ${nextIndex}` : undefined;
      const initCmd = isAgy ? 'agy\r' : undefined;

      const newSession = await createSession({
        shell,
        workspace_id: targetWsId,
        cwd: targetWs?.path,
        name: sessionName,
        init_cmd: initCmd,
      });

      setSessions((prev) => [...prev, newSession]);

      setWorkspaceSlots((prev) => {
        const existing = prev[targetWsId]
          ? [...prev[targetWsId]]
          : [null, null, null, null, null, null];
        const emptyIdx = existing.findIndex((s) => s === null);
        if (emptyIdx !== -1) {
          existing[emptyIdx] = newSession.id;
          if (targetWsId === activeWsId) {
            setActivePaneIndex(emptyIdx);
          }
        }
        return { ...prev, [targetWsId]: existing };
      });

      // Auto-bump layout mode if creating in active workspace
      if (targetWsId === activeWsId) {
        const newCount = targetSessions.length + 1;
        const targetMode = Math.min(Math.max(currentLayoutMode, newCount), 6) as LayoutMode;
        setWorkspaceLayouts((prev) => ({ ...prev, [targetWsId]: targetMode }));
      }

      showToast(`Started ${newSession.name}`);
    } catch (e) {
      showToast('Failed to start session');
    }
  };

  const handleCreateWorkspace = async (
    name: string,
    path?: string,
    shell?: string,
    kind?: 'antigravity' | 'terminal',
    windowCount: LayoutMode = 1
  ) => {
    try {
      const newWs = await createWorkspace({ name, path, kind });
      setWorkspaces((prev) => [...prev, newWs]);

      const isAgy = kind === 'antigravity';
      const createdSessions: SessionInfo[] = [];

      // Auto-launch requested number of initial windows in this new workspace group (1 to 6)
      const count = Math.min(Math.max(windowCount, 1), 6);
      for (let i = 1; i <= count; i++) {
        const sessionName = isAgy
          ? (count === 1 ? 'Antigravity' : `Antigravity ${i}`)
          : (count === 1 ? undefined : `Terminal ${i}`);
        const sess = await createSession({
          shell,
          workspace_id: newWs.id,
          cwd: path,
          name: sessionName,
          init_cmd: isAgy ? 'agy\r' : undefined,
        });
        createdSessions.push(sess);
      }

      setSessions((prev) => [...prev, ...createdSessions]);

      const initialSlots: (string | null)[] = [null, null, null, null, null, null];
      createdSessions.forEach((sess, idx) => {
        if (idx < 6) {
          initialSlots[idx] = sess.id;
        }
      });

      setWorkspaceSlots((prev) => ({
        ...prev,
        [newWs.id]: initialSlots,
      }));
      setWorkspaceLayouts((prev) => ({
        ...prev,
        [newWs.id]: count as LayoutMode,
      }));

      handleSelectWorkspace(newWs.id);
      showToast(
        `Created ${isAgy ? 'Antigravity ' : ''}workspace "${newWs.name}" (${count} ${
          count === 1 ? 'окно' : count < 5 ? 'окна' : 'окон'
        })`
      );
    } catch (e) {
      showToast('Failed to create workspace');
    }
  };

  const handleDeleteWorkspace = async (id: string) => {
    try {
      await deleteWorkspace(id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      setSessions((prev) => prev.filter((s) => s.workspace_id !== id));
      setWorkspaceSlots((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setWorkspaceLayouts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      if (activeWorkspaceId === id) {
        const remaining = workspaces.filter((w) => w.id !== id);
        const fallbackId = remaining[0]?.id || 'default';
        handleSelectWorkspace(fallbackId);
      }
      showToast('Workspace deleted');
    } catch {
      showToast('Failed to delete workspace');
    }
  };

  const handleRenameWorkspace = async (id: string, newName: string) => {
    try {
      await renameWorkspace(id, newName);
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === id ? { ...w, name: newName } : w))
      );
      showToast(`Renamed workspace to "${newName}"`);
    } catch {
      showToast('Failed to rename workspace');
    }
  };

  const handleCloseSession = async (id: string) => {
    try {
      await closeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setWorkspaceSlots((prev) => {
        const next = { ...prev };
        for (const wsId in next) {
          next[wsId] = next[wsId].map((sid) => (sid === id ? null : sid));
        }
        return next;
      });
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

  // Helper to get session for a slot index in active workspace
  const getSessionForSlot = (idx: number): SessionInfo | undefined => {
    const sid = currentSlots[idx];
    if (!sid) return undefined;
    return sessions.find((s) => s.id === sid);
  };

  // Active session and ID in the currently focused active pane
  const activeSession =
    getSessionForSlot(activePaneIndex) || activeWorkspaceSessions[0] || null;
  const activeSessionId = activeSession?.id || null;

  const handleExecuteScript = async (command: string, autoExecute: boolean = true) => {
    if (!activeSessionId) {
      showToast('No active terminal session in this workspace');
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
    if (activeWorkspaceSessions.length >= 6) {
      showToast('Workspace limit reached (max 6 windows per group)');
      return;
    }
    if (currentLayoutMode < 6) {
      handleSetLayoutMode((currentLayoutMode + 1) as LayoutMode);
    }
    await handleCreateSession();
  };

  const handleSelectSessionFromSidebar = (sessionId: string, wsId: string) => {
    if (wsId !== activeWsId) {
      handleSelectWorkspace(wsId);
    }
    const targetSlots = workspaceSlots[wsId] || [];
    const slotIdx = targetSlots.findIndex((sid) => sid === sessionId);
    if (slotIdx !== -1 && slotIdx < currentLayoutMode) {
      setActivePaneIndex(slotIdx);
    } else if (slotIdx !== -1) {
      const neededMode = Math.min(slotIdx + 1, 6) as LayoutMode;
      handleSetLayoutMode(neededMode);
      setActivePaneIndex(slotIdx);
    } else {
      setWorkspaceSlots((prev) => {
        const existing = prev[wsId] ? [...prev[wsId]] : [null, null, null, null, null, null];
        existing[activePaneIndex] = sessionId;
        return { ...prev, [wsId]: existing };
      });
    }
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
        sessions={activeWorkspaceSessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setWorkspaceSlots((prev) => {
            const existing = prev[activeWsId]
              ? [...prev[activeWsId]]
              : [null, null, null, null, null, null];
            existing[0] = id;
            return { ...prev, [activeWsId]: existing };
          });
        }}
        onCreateSession={(shell) => handleCreateSession(shell, activeWsId)}
        theme={theme}
      />
    );
  }

  // Helper to render a terminal pane for slot index
  const renderPane = (idx: number) => {
    const s = getSessionForSlot(idx);
    return (
      <TerminalPane
        key={`${activeWsId}-pane-${idx}-${s?.id || 'empty'}`}
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
        agyMode={agyMode}
        onToggleAgyMode={() => handleToggleAgyMode()}
      />
    );
  };

  // Render desktop grid layout based on 1 to 6 windows
  const renderGridLayout = () => {
    if (maximizedPaneIndex !== null) {
      return renderPane(maximizedPaneIndex);
    }

    switch (currentLayoutMode) {
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
        // 1 tall left + 2 stacked right
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
      {/* Left Sidebar (Workspaces & Session Groupings) */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        workspaces={workspaces}
        activeWorkspaceId={activeWsId}
        onSelectWorkspace={handleSelectWorkspace}
        onOpenCreateWorkspaceModal={() => setIsCreateWorkspaceModalOpen(true)}
        onDeleteWorkspace={handleDeleteWorkspace}
        onRenameWorkspace={handleRenameWorkspace}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onSelectSession={handleSelectSessionFromSidebar}
        onCreateSession={(shell, wsId) => handleCreateSession(shell, wsId)}
        onCloseSession={handleCloseSession}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        theme={theme}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Top Bar with Active Workspace switcher and 1-6 layout buttons */}
        <TopBar
          layoutMode={currentLayoutMode}
          onChangeLayout={handleSetLayoutMode}
          systemInfo={systemInfo}
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          activeWorkspaceSessionCount={activeWorkspaceSessions.length}
          onSelectWorkspace={handleSelectWorkspace}
          onOpenCreateWorkspaceModal={() => setIsCreateWorkspaceModalOpen(true)}
          onOpenRemoteModal={() => setIsRemoteModalOpen(true)}
          onOpenQuickScripts={() => setIsQuickScriptsOpen(true)}
          onCreateSession={(shell) => handleCreateSession(shell, activeWsId)}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        />

        {/* Dynamic Card Grid for Active Workspace (1 to 6 Panes) */}
        <main className="flex-1 flex p-2 min-h-0 min-w-0 overflow-hidden">
          {renderGridLayout()}
        </main>
      </div>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceModalOpen}
        onClose={() => setIsCreateWorkspaceModalOpen(false)}
        onCreate={handleCreateWorkspace}
        availableShells={systemInfo?.available_shells}
        defaultPath={activeWorkspace?.path || 'C:\\Users\\user\\Documents\\dev\\veron'}
      />

      {/* Local Wi-Fi Remote Modal */}
      <RemoteModal
        isOpen={isRemoteModalOpen}
        onClose={() => setIsRemoteModalOpen(false)}
        systemInfo={systemInfo}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        capturesInfo={capturesInfo}
        onClearCaptures={handleClearCaptures}
        onOpenCapturesFolder={handleOpenCapturesFolder}
        systemInfo={systemInfo}
        onOpenRemoteModal={() => setIsRemoteModalOpen(true)}
        agyMode={agyMode}
        onToggleAgyMode={handleToggleAgyMode}
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
