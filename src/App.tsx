import React, { useEffect, useState, useRef } from 'react';
import {
  CapturesInfo,
  SessionInfo,
  SystemInfo,
  Workspace,
  LayoutMode,
  GitStatusResponse,
  DetectedPort,
} from './types';
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
  updateActiveState,
  fetchGitStatus,
  fetchListeningPorts,
} from './services/api';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TerminalPane } from './components/TerminalPane';
import { RemoteModal } from './components/RemoteModal';
import { SettingsModal } from './components/SettingsModal';
import { QuickScriptsModal } from './components/QuickScriptsModal';
import { CreateWorkspaceModal } from './components/CreateWorkspaceModal';
import { GitDiffModal } from './components/GitDiffModal';
import { MobileView } from './components/MobileView';
import { PaneSplitter } from './components/PaneSplitter';
import { KeyRound, ShieldAlert } from 'lucide-react';
import {
  loadThemeSettings,
  saveThemeSettings,
  resolveTheme,
  applyThemeToDOM,
  ThemeSettings,
} from './services/theme';

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

  // Dynamic Split Ratios per Workspace (Mode 2 - Mode 6)
  const [workspaceRatios, setWorkspaceRatios] = useState<Record<string, Record<string, number>>>(() => {
    try {
      const saved = localStorage.getItem('veron_layout_ratios');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Window Drag & Drop Reordering State
  const [draggingSlot, setDraggingSlot] = useState<{
    slotIndex: number;
    sessionName: string;
    isAgy: boolean;
    x: number;
    y: number;
  } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const [activePaneIndex, setActivePaneIndex] = useState<number>(0);
  const [maximizedPaneIndex, setMaximizedPaneIndex] = useState<number | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isQuickScriptsOpen, setIsQuickScriptsOpen] = useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);

  // Theme Settings & Engine
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    const initial = loadThemeSettings();
    const resolved = resolveTheme(initial);
    applyThemeToDOM(resolved);
    return initial;
  });

  const activeTheme = resolveTheme(themeSettings);
  const theme = themeSettings.mode;

  const handleSelectTheme = (themeId: string) => {
    setThemeSettings((prev) => {
      const next: ThemeSettings = {
        ...prev,
        selectedThemeId: themeId,
        customAccent: null,
      };
      const resolved = resolveTheme(next);
      applyThemeToDOM(resolved);
      saveThemeSettings(next);
      showToast(`Theme: ${resolved.name}`);
      return next;
    });
  };

  const handleSetCustomAccent = (customAccent: string | null) => {
    setThemeSettings((prev) => {
      const next: ThemeSettings = {
        ...prev,
        selectedThemeId: customAccent ? 'custom' : prev.selectedThemeId === 'custom' ? 'cybran-amber' : prev.selectedThemeId,
        customAccent,
      };
      const resolved = resolveTheme(next);
      applyThemeToDOM(resolved);
      saveThemeSettings(next);
      if (customAccent) {
        showToast(`Accent: ${customAccent.toUpperCase()}`);
      } else {
        showToast('Accent reset to theme default');
      }
      return next;
    });
  };

  const handleToggleTheme = () => {
    setThemeSettings((prev) => {
      const newMode = prev.mode === 'dark' ? 'light' : 'dark';
      let newThemeId = prev.selectedThemeId;
      if (newMode === 'light') {
        if (prev.selectedThemeId === 'cybran-amber') newThemeId = 'light-amber';
        else if (!prev.selectedThemeId.startsWith('light-') && prev.selectedThemeId !== 'custom') newThemeId = 'light-amber';
      } else {
        if (prev.selectedThemeId === 'light-amber') newThemeId = 'cybran-amber';
        else if (prev.selectedThemeId.startsWith('light-')) newThemeId = 'cybran-amber';
      }

      const next: ThemeSettings = {
        ...prev,
        mode: newMode,
        selectedThemeId: newThemeId,
      };
      const resolved = resolveTheme(next);
      applyThemeToDOM(resolved);
      saveThemeSettings(next);
      showToast(`${newMode === 'dark' ? 'Dark Obsidian' : 'Light Workspace'} Mode`);
      return next;
    });
  };

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

  // Git & Dev Server Ports state
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null);
  const [isGitDiffOpen, setIsGitDiffOpen] = useState(false);
  const [activePorts, setActivePorts] = useState<DetectedPort[]>([]);

  // Derived Active Workspace & Sessions
  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeWsId = activeWorkspace?.id || 'default';

  const refreshGitStatus = async () => {
    if (!activeWorkspace?.path) return;
    try {
      const status = await fetchGitStatus(activeWorkspace.path);
      setGitStatus(status);
    } catch {
      setGitStatus(null);
    }
  };

  const refreshPorts = async () => {
    if (!activeWsId) return;
    try {
      const ports = await fetchListeningPorts(activeWsId);
      setActivePorts(ports);
    } catch {
      setActivePorts([]);
    }
  };

  useEffect(() => {
    refreshGitStatus();
    refreshPorts();

    const gitInterval = setInterval(refreshGitStatus, 4000);
    const portsInterval = setInterval(refreshPorts, 3000);

    return () => {
      clearInterval(gitInterval);
      clearInterval(portsInterval);
    };
  }, [activeWorkspace?.path, activeWsId]);

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

  const saveRatiosTimeoutRef = useRef<any>(null);

  const updateRatio = (key: string, value: number, min = 15, max = 85) => {
    const clamped = Math.max(min, Math.min(max, value));
    setWorkspaceRatios((prev) => {
      const next = {
        ...prev,
        [activeWsId]: {
          ...(prev[activeWsId] || {}),
          [key]: clamped,
        },
      };
      clearTimeout(saveRatiosTimeoutRef.current);
      saveRatiosTimeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem('veron_layout_ratios', JSON.stringify(next));
        } catch {}
      }, 300);
      return next;
    });
  };

  const resetRatio = (key: string, defaultValue = 50) => {
    setWorkspaceRatios((prev) => {
      const next = {
        ...prev,
        [activeWsId]: {
          ...(prev[activeWsId] || {}),
          [key]: defaultValue,
        },
      };
      try {
        localStorage.setItem('veron_layout_ratios', JSON.stringify(next));
      } catch {}
      return next;
    });
    showToast('Reset pane layout');
  };

  const handleSelectWorkspace = (wsId: string) => {
    setActiveWorkspaceId(wsId);
    localStorage.setItem('veron_active_workspace', wsId);
    setMaximizedPaneIndex(null);
    setActivePaneIndex(0);
    updateActiveState(wsId, undefined);
  };

  // Resize listener for mobile mode
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  // Helper to synchronize slots with incoming sessions for a workspace (guarantees strict uniqueness & zero duplication)
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

        // 1. Remove session IDs that no longer exist or are duplicates
        const seen = new Set<string>();
        for (let i = 0; i < 6; i++) {
          const sid = existingSlots[i];
          if (sid) {
            if (seen.has(sid) || !wsSessions.some((s) => s.id === sid)) {
              existingSlots[i] = null;
            } else {
              seen.add(sid);
            }
          }
        }

        // 2. Add unassigned sessions to empty slots without creating duplicates
        for (const sess of wsSessions) {
          if (!seen.has(sess.id)) {
            const emptyIdx = existingSlots.findIndex((s) => s === null);
            if (emptyIdx !== -1) {
              existingSlots[emptyIdx] = sess.id;
              seen.add(sess.id);
            }
          }
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
          const savedWsId = localStorage.getItem('veron_active_workspace');
          // If on mobile OR no saved workspace OR saved is default, sync with server's active_workspace_id
          if ((window.innerWidth < 768 || !savedWsId || savedWsId === 'default') && sys?.active_workspace_id) {
            if (ws.some((w) => w.id === sys.active_workspace_id)) {
              setActiveWorkspaceId(sys.active_workspace_id);
              localStorage.setItem('veron_active_workspace', sys.active_workspace_id);
            }
          } else if (!ws.some((w) => w.id === activeWorkspaceId)) {
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

      updateActiveState(targetWsId, newSession.id);
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
    windowCount: LayoutMode = 1,
    useWorktree?: boolean,
    branch?: string
  ) => {
    try {
      const newWs = await createWorkspace({
        name,
        path,
        kind,
        create_worktree: useWorktree,
        branch,
      });
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
          cwd: newWs.path,
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
        newWs.is_worktree
          ? `Created Git Worktree "${newWs.name}" on branch "${newWs.branch}"`
          : `Created ${isAgy ? 'Antigravity ' : ''}workspace "${newWs.name}" (${count} ${
              count === 1 ? 'окно' : count < 5 ? 'окна' : 'окон'
            })`
      );
    } catch (e: any) {
      showToast(e?.message || 'Failed to create workspace');
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

      const targetSession = sessions.find((s) => s.id === id);
      const targetWsId = targetSession?.workspace_id || activeWsId;

      setSessions((prev) => prev.filter((s) => s.id !== id));

      // 1. Compact slots for this workspace (shift remaining sessions to slots 0, 1, ...)
      setWorkspaceSlots((prev) => {
        const next = { ...prev };
        for (const wsId in next) {
          const remaining = next[wsId].filter((sid) => sid && sid !== id);
          const compacted: (string | null)[] = [null, null, null, null, null, null];
          remaining.forEach((sid, idx) => {
            if (idx < 6) compacted[idx] = sid;
          });
          next[wsId] = compacted;
        }
        return next;
      });

      // 2. Automatically reduce layout mode: if 2 open and 1 closed -> becomes 1!
      const remainingCount = sessions.filter(
        (s) =>
          (s.workspace_id === targetWsId || (!s.workspace_id && targetWsId === 'default')) &&
          s.id !== id
      ).length;

      const adaptedMode = Math.max(1, Math.min(6, remainingCount)) as LayoutMode;
      setWorkspaceLayouts((prev) => ({
        ...prev,
        [targetWsId]: adaptedMode,
      }));

      // 3. Reset activePaneIndex and maximizedPaneIndex
      setActivePaneIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, remainingCount - 1))));
      if (maximizedPaneIndex !== null) {
        setMaximizedPaneIndex(null);
      }

      showToast('Session closed');
    } catch {
      showToast('Failed to close session');
    }
  };

  // Window Drag & Drop Handler (Dragging window header to reorder / swap panes)
  const handleStartDrag = (
    slotIdx: number,
    session: SessionInfo,
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let isDraggingActive = false;

    const isAgy =
      session.name.toLowerCase().includes('agy') ||
      session.name.toLowerCase().includes('antigravity');

    const handlePointerMove = (moveEv: PointerEvent) => {
      const dist = Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY);
      if (!isDraggingActive && dist > 5) {
        isDraggingActive = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }

      if (isDraggingActive) {
        setDraggingSlot({
          slotIndex: slotIdx,
          sessionName: session.name,
          isAgy,
          x: moveEv.clientX,
          y: moveEv.clientY,
        });

        // Detect which terminal slot the cursor is currently over
        const elements = document.elementsFromPoint(moveEv.clientX, moveEv.clientY);
        let foundSlot: number | null = null;
        for (const el of elements) {
          const slotAttr = el.getAttribute('data-slot-index');
          if (slotAttr !== null) {
            foundSlot = parseInt(slotAttr, 10);
            break;
          }
        }
        setDragOverSlot(foundSlot);
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (isDraggingActive) {
        setDragOverSlot((targetSlot) => {
          if (targetSlot !== null && targetSlot !== slotIdx) {
            // Swap slots in current workspace
            setWorkspaceSlots((prev) => {
              const current = prev[activeWsId]
                ? [...prev[activeWsId]]
                : [null, null, null, null, null, null];
              const temp = current[slotIdx];
              current[slotIdx] = current[targetSlot];
              current[targetSlot] = temp;
              return { ...prev, [activeWsId]: current };
            });
            setActivePaneIndex(targetSlot);
            showToast(`Moved ${session.name} to Pane ${targetSlot + 1}`);
          }
          return null;
        });
        setDraggingSlot(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Global Keyboard Shortcuts:
  // - Ctrl+K / Cmd+K: Quick Scripts modal
  // - Ctrl+Shift+T / Ctrl+Shift+D: Instant split / new terminal pane
  // - Alt+1..6: Focus quadrant / pane 1..6
  // - Alt+M: Toggle maximize / restore current active pane
  // - Alt+W: Close active session in current slot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Quick Scripts: Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickScriptsOpen((prev) => !prev);
        return;
      }

      // 2. Instant Split / New Pane: Ctrl+Shift+T / Ctrl+Shift+D
      const isTKey =
        e.key.toLowerCase() === 't' ||
        e.code === 'KeyT' ||
        e.key === 'е' ||
        e.key === 'Е';
      const isDKey =
        e.key.toLowerCase() === 'd' ||
        e.code === 'KeyD' ||
        e.key === 'в' ||
        e.key === 'В';
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (isTKey || isDKey)) {
        e.preventDefault();
        handleSplitPane();
        return;
      }

      // 3. Alt + 1..6: Switch active pane
      if (e.altKey && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const slotIdx = parseInt(e.key, 10) - 1;
        setActivePaneIndex(slotIdx);
        if (maximizedPaneIndex !== null) {
          setMaximizedPaneIndex(slotIdx);
        }
        showToast(`Focused pane ${slotIdx + 1}`);
        return;
      }

      // 4. Alt + M: Toggle maximize active pane
      if (e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setMaximizedPaneIndex((prev) => (prev === activePaneIndex ? null : activePaneIndex));
        showToast(
          maximizedPaneIndex === activePaneIndex
            ? 'Restored layout'
            : `Maximized pane ${activePaneIndex + 1}`
        );
        return;
      }

      // 5. Alt + W: Close active session in current slot
      if (e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        const sid = currentSlots[activePaneIndex];
        if (sid) {
          handleCloseSession(sid);
        } else {
          showToast(`No active session in pane ${activePaneIndex + 1}`);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePaneIndex, maximizedPaneIndex, currentSlots, activeWorkspaceSessions.length, currentLayoutMode]);

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
            <div className="p-3 rounded-xl bg-accent/15 border border-accent/30 text-accent">
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
            className="w-full bg-[#090a0d] border border-white/[0.1] rounded-lg px-3 py-2 text-center text-lg tracking-widest font-mono uppercase text-accent outline-none focus:border-accent transition-colors"
            autoFocus
          />

          <button
            type="submit"
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-[var(--veron-accent-fg,#000)] font-semibold rounded-lg text-sm transition-all duration-150 shadow-sm shadow-accent"
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
        workspaces={workspaces}
        activeWorkspaceId={activeWsId}
        onSelectWorkspace={(wsId) => handleSelectWorkspace(wsId)}
        sessions={activeWorkspaceSessions}
        allSessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id, wsId) => {
          const targetWsId = wsId || activeWsId;
          if (targetWsId !== activeWsId) {
            handleSelectWorkspace(targetWsId);
          }
          setWorkspaceSlots((prev) => {
            const existing = prev[targetWsId]
              ? [...prev[targetWsId]]
              : [null, null, null, null, null, null];
            existing[0] = id;
            return { ...prev, [targetWsId]: existing };
          });
          updateActiveState(targetWsId, id);
        }}
        onCreateSession={(shell, wsId) => handleCreateSession(shell, wsId || activeWsId)}
        theme={theme}
        activeTheme={activeTheme}
      />
    );
  }

  // Helper to render a terminal pane for slot index
  const isAntigravityWorkspace =
    activeWorkspace?.kind === 'antigravity' ||
    activeWorkspace?.name.toLowerCase().includes('antigravity') ||
    activeWorkspace?.name.toLowerCase().includes('agy');

  const renderPane = (idx: number) => {
    const s = getSessionForSlot(idx);
    return (
      <div
        key={`${activeWsId}-pane-${idx}-${s?.id || 'empty'}`}
        data-slot-index={idx}
        className="flex-1 flex w-full h-full min-w-0 min-h-0 p-1 relative"
      >
        <TerminalPane
          session={s}
          isActive={activePaneIndex === idx}
          isMaximized={maximizedPaneIndex === idx}
          onFocus={() => {
            setActivePaneIndex(idx);
            if (s) {
              updateActiveState(activeWsId, s.id);
            }
          }}
          onClose={() => {
            if (s) handleCloseSession(s.id);
          }}
          onMaximize={() => setMaximizedPaneIndex(maximizedPaneIndex === idx ? null : idx)}
          onSplit={handleSplitPane}
          onRename={(name) => {
            if (s) handleRenameSession(s.id, name);
          }}
          theme={theme}
          activeTheme={activeTheme}
          onToast={showToast}
          agyMode={agyMode}
          onToggleAgyMode={() => handleToggleAgyMode()}
          isAntigravity={Boolean(isAntigravityWorkspace)}
          slotIndex={idx}
          onStartDrag={handleStartDrag}
          isDragOver={dragOverSlot === idx}
        />
      </div>
    );
  };

  // Render desktop grid layout based on 1 to 6 windows with interactive resizing
  const renderGridLayout = () => {
    if (maximizedPaneIndex !== null) {
      return renderPane(maximizedPaneIndex);
    }

    const ratios = workspaceRatios[activeWsId] || {};

    switch (currentLayoutMode) {
      case 1:
        return (
          <div className="flex-1 flex w-full h-full min-h-0 min-w-0">
            {renderPane(0)}
          </div>
        );

      case 2: {
        const colRatio = ratios.mode2_col ?? 50;
        return (
          <div className="flex-1 flex w-full h-full min-h-0 min-w-0 overflow-hidden">
            <div style={{ width: `${colRatio}%` }} className="flex h-full min-w-0 min-h-0">
              {renderPane(0)}
            </div>
            <PaneSplitter
              direction="vertical"
              onResizePercent={(p) => updateRatio('mode2_col', p)}
              onReset={() => resetRatio('mode2_col')}
            />
            <div style={{ width: `${100 - colRatio}%` }} className="flex h-full min-w-0 min-h-0">
              {renderPane(1)}
            </div>
          </div>
        );
      }

      case 3: {
        // 1 tall left + 2 stacked right
        const colRatio = ratios.mode3_col ?? 50;
        const rowRatio = ratios.mode3_row ?? 50;
        return (
          <div className="flex-1 flex w-full h-full min-h-0 min-w-0 overflow-hidden">
            <div style={{ width: `${colRatio}%` }} className="flex h-full min-w-0 min-h-0">
              {renderPane(0)}
            </div>
            <PaneSplitter
              direction="vertical"
              onResizePercent={(p) => updateRatio('mode3_col', p)}
              onReset={() => resetRatio('mode3_col')}
            />
            <div style={{ width: `${100 - colRatio}%` }} className="flex flex-col h-full min-w-0 min-h-0 overflow-hidden">
              <div style={{ height: `${rowRatio}%` }} className="flex w-full min-w-0 min-h-0">
                {renderPane(1)}
              </div>
              <PaneSplitter
                direction="horizontal"
                onResizePercent={(p) => updateRatio('mode3_row', p)}
                onReset={() => resetRatio('mode3_row')}
              />
              <div style={{ height: `${100 - rowRatio}%` }} className="flex w-full min-w-0 min-h-0">
                {renderPane(2)}
              </div>
            </div>
          </div>
        );
      }

      case 4: {
        // 2x2 Grid
        const colRatio = ratios.mode4_col ?? 50;
        const rowRatio = ratios.mode4_row ?? 50;
        return (
          <div className="flex-1 flex flex-col w-full h-full min-h-0 min-w-0 overflow-hidden">
            {/* Top row: Panes 0 & 1 */}
            <div style={{ height: `${rowRatio}%` }} className="flex w-full min-w-0 min-h-0 overflow-hidden">
              <div style={{ width: `${colRatio}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(0)}
              </div>
              <PaneSplitter
                direction="vertical"
                onResizePercent={(p) => updateRatio('mode4_col', p)}
                onReset={() => resetRatio('mode4_col')}
              />
              <div style={{ width: `${100 - colRatio}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(1)}
              </div>
            </div>
            <PaneSplitter
              direction="horizontal"
              onResizePercent={(p) => updateRatio('mode4_row', p)}
              onReset={() => resetRatio('mode4_row')}
            />
            {/* Bottom row: Panes 2 & 3 */}
            <div style={{ height: `${100 - rowRatio}%` }} className="flex w-full min-w-0 min-h-0 overflow-hidden">
              <div style={{ width: `${colRatio}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(2)}
              </div>
              <PaneSplitter
                direction="vertical"
                onResizePercent={(p) => updateRatio('mode4_col', p)}
                onReset={() => resetRatio('mode4_col')}
              />
              <div style={{ width: `${100 - colRatio}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(3)}
              </div>
            </div>
          </div>
        );
      }

      case 5: {
        // 2 on top, 3 on bottom
        const rowRatio = ratios.mode5_row ?? 50;
        const topCol = ratios.mode5_topCol ?? 50;
        const botDiv1 = ratios.mode5_bot_div1 ?? (ratios.mode5_bot1 ?? 33.33);
        const botDiv2 = ratios.mode5_bot_div2 ?? (botDiv1 + (ratios.mode5_bot2 ?? 33.33));
        const safeBotDiv1 = Math.max(10, Math.min(botDiv2 - 10, botDiv1));
        const safeBotDiv2 = Math.max(safeBotDiv1 + 10, Math.min(90, botDiv2));

        const botCol1 = safeBotDiv1;
        const botCol2 = safeBotDiv2 - safeBotDiv1;
        const botCol3 = Math.max(10, 100 - safeBotDiv2);

        return (
          <div className="flex-1 flex flex-col w-full h-full min-h-0 min-w-0 overflow-hidden">
            {/* Top row */}
            <div style={{ height: `${rowRatio}%` }} className="flex w-full min-w-0 min-h-0 overflow-hidden">
              <div style={{ width: `${topCol}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(0)}
              </div>
              <PaneSplitter
                direction="vertical"
                onResizePercent={(p) => updateRatio('mode5_topCol', p)}
                onReset={() => resetRatio('mode5_topCol')}
              />
              <div style={{ width: `${100 - topCol}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(1)}
              </div>
            </div>
            <PaneSplitter
              direction="horizontal"
              onResizePercent={(p) => updateRatio('mode5_row', p)}
              onReset={() => resetRatio('mode5_row')}
            />
            {/* Bottom row */}
            <div style={{ height: `${100 - rowRatio}%` }} className="flex w-full min-w-0 min-h-0 overflow-hidden">
              <div style={{ width: `${botCol1}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(2)}
              </div>
              <PaneSplitter
                direction="vertical"
                minPercent={10}
                maxPercent={safeBotDiv2 - 10}
                onResizePercent={(p) => updateRatio('mode5_bot_div1', p, 10, safeBotDiv2 - 10)}
                onReset={() => resetRatio('mode5_bot_div1', 33.33)}
              />
              <div style={{ width: `${botCol2}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(3)}
              </div>
              <PaneSplitter
                direction="vertical"
                minPercent={safeBotDiv1 + 10}
                maxPercent={90}
                onResizePercent={(p) => updateRatio('mode5_bot_div2', p, safeBotDiv1 + 10, 90)}
                onReset={() => resetRatio('mode5_bot_div2', 66.67)}
              />
              <div style={{ width: `${botCol3}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(4)}
              </div>
            </div>
          </div>
        );
      }

      case 6: {
        // 2 rows of 3 columns (2x3 Grid)
        const rowRatio = ratios.mode6_row ?? 50;
        const div1 = ratios.mode6_div1 ?? (ratios.mode6_col1 ?? 33.33);
        const div2 = ratios.mode6_div2 ?? (div1 + (ratios.mode6_col2 ?? 33.33));
        const safeDiv1 = Math.max(10, Math.min(div2 - 10, div1));
        const safeDiv2 = Math.max(safeDiv1 + 10, Math.min(90, div2));

        const col1 = safeDiv1;
        const col2 = safeDiv2 - safeDiv1;
        const col3 = Math.max(10, 100 - safeDiv2);

        return (
          <div className="flex-1 flex flex-col w-full h-full min-h-0 min-w-0 overflow-hidden">
            {/* Top row */}
            <div style={{ height: `${rowRatio}%` }} className="flex w-full min-w-0 min-h-0 overflow-hidden">
              <div style={{ width: `${col1}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(0)}
              </div>
              <PaneSplitter
                direction="vertical"
                minPercent={10}
                maxPercent={safeDiv2 - 10}
                onResizePercent={(p) => updateRatio('mode6_div1', p, 10, safeDiv2 - 10)}
                onReset={() => resetRatio('mode6_div1', 33.33)}
              />
              <div style={{ width: `${col2}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(1)}
              </div>
              <PaneSplitter
                direction="vertical"
                minPercent={safeDiv1 + 10}
                maxPercent={90}
                onResizePercent={(p) => updateRatio('mode6_div2', p, safeDiv1 + 10, 90)}
                onReset={() => resetRatio('mode6_div2', 66.67)}
              />
              <div style={{ width: `${col3}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(2)}
              </div>
            </div>
            <PaneSplitter
              direction="horizontal"
              onResizePercent={(p) => updateRatio('mode6_row', p)}
              onReset={() => resetRatio('mode6_row')}
            />
            {/* Bottom row */}
            <div style={{ height: `${100 - rowRatio}%` }} className="flex w-full min-w-0 min-h-0 overflow-hidden">
              <div style={{ width: `${col1}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(3)}
              </div>
              <PaneSplitter
                direction="vertical"
                minPercent={10}
                maxPercent={safeDiv2 - 10}
                onResizePercent={(p) => updateRatio('mode6_div1', p, 10, safeDiv2 - 10)}
                onReset={() => resetRatio('mode6_div1', 33.33)}
              />
              <div style={{ width: `${col2}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(4)}
              </div>
              <PaneSplitter
                direction="vertical"
                minPercent={safeDiv1 + 10}
                maxPercent={90}
                onResizePercent={(p) => updateRatio('mode6_div2', p, safeDiv1 + 10, 90)}
                onReset={() => resetRatio('mode6_div2', 66.67)}
              />
              <div style={{ width: `${col3}%` }} className="flex h-full min-w-0 min-h-0">
                {renderPane(5)}
              </div>
            </div>
          </div>
        );
      }
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden select-none transition-colors duration-300 ease-apple ${
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
          onToggleTheme={handleToggleTheme}
          gitStatus={gitStatus}
          onOpenGitDiff={() => setIsGitDiffOpen(true)}
          activePorts={activePorts}
          onToast={showToast}
          onSplit={handleSplitPane}
        />

        {/* Dynamic Card Grid for Active Workspace (1 to 6 Panes) */}
        <main className="flex-1 flex p-2 min-h-0 min-w-0 overflow-hidden transition-all duration-300 ease-apple">
          {renderGridLayout()}
        </main>
      </div>

      {/* Live Git Diff Modal */}
      <GitDiffModal
        isOpen={isGitDiffOpen}
        onClose={() => setIsGitDiffOpen(false)}
        gitStatus={gitStatus}
        workspacePath={activeWorkspace?.path}
        onRefresh={refreshGitStatus}
      />

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
        onToggleTheme={handleToggleTheme}
        activeTheme={activeTheme}
        themeSettings={themeSettings}
        onSelectTheme={handleSelectTheme}
        onSetCustomAccent={handleSetCustomAccent}
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

      {/* Floating Ghost Window Thumbnail when dragging header */}
      {draggingSlot && (
        <div
          style={{
            position: 'fixed',
            left: draggingSlot.x - 90,
            top: draggingSlot.y - 35,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="w-56 p-2.5 rounded-xl bg-[#0e1017]/95 border border-accent/80 shadow-accent backdrop-blur-md flex flex-col gap-1.5 transition-transform duration-75 scale-95 rotate-1 select-none"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
            <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_var(--veron-accent-glow)]" />
            <span className="truncate">{draggingSlot.sessionName}</span>
            {draggingSlot.isAgy && (
              <span className="text-[9px] px-1 py-0.2 bg-accent/20 text-accent rounded font-mono font-bold">
                AGY
              </span>
            )}
          </div>
          <div className="h-9 rounded bg-black/60 border border-white/[0.06] flex items-center justify-center text-[10px] text-accent/80 font-mono">
            {dragOverSlot !== null && dragOverSlot !== draggingSlot.slotIndex
              ? `Swap with Pane ${dragOverSlot + 1}`
              : 'Drag over another pane'}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-3.5 py-2 rounded-lg bg-[#0f1015]/95 border border-accent/40 text-accent text-xs shadow-2xl backdrop-blur-md animate-toast-in">
          {toast}
        </div>
      )}
    </div>
  );
};

export default App;
