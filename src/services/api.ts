import {
  ActiveState,
  CapturesInfo,
  DetectedPort,
  GitStatusResponse,
  SessionInfo,
  SystemInfo,
  Workspace,
} from '../types';

const SERVER_PORT = 4567;

// Token extraction from URL query or localStorage
let currentToken: string = (() => {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  if (urlToken) {
    localStorage.setItem('veron_token', urlToken);
    return urlToken;
  }
  return localStorage.getItem('veron_token') || '';
})();

export function setAuthToken(token: string) {
  currentToken = token;
  localStorage.setItem('veron_token', token);
}

export function getAuthToken(): string {
  return currentToken;
}

export function getBaseUrl(): string {
  const { protocol, hostname, port } = window.location;
  if (port === String(SERVER_PORT)) {
    return `${protocol}//${hostname}:${port}`;
  }
  return `${protocol}//${hostname}:${SERVER_PORT}`;
}

export function getWsUrl(sessionId: string): string {
  const { hostname, port } = window.location;
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const targetPort = port === String(SERVER_PORT) ? port : String(SERVER_PORT);
  const tokenQuery = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  return `${wsProto}//${hostname}:${targetPort}/ws/terminal/${sessionId}${tokenQuery}`;
}

const API_BASE = getBaseUrl();

function getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
    headers['X-Veron-Token'] = currentToken;
  }
  return headers;
}

export async function copyToGlobalClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Layer 1: Modern async navigator.clipboard.writeText
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('[Veron] navigator.clipboard.writeText failed, trying fallback:', e);
    }
  }

  // Layer 2: document.execCommand('copy') with offscreen textarea
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (success) {
      return true;
    }
  } catch (e) {
    console.warn('[Veron] document.execCommand copy failed:', e);
  }

  // Layer 3: Veron Backend Native Win32 SetClipboardData
  try {
    const res = await fetch(`${API_BASE}/api/clipboard`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return true;
    }
  } catch (e) {
    console.warn('[Veron] Backend /api/clipboard failed:', e);
  }

  return false;
}

export async function readFromGlobalClipboard(): Promise<string> {
  // Layer 1: Modern async navigator.clipboard.readText
  if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
    try {
      const text = await navigator.clipboard.readText();
      if (text) return text;
    } catch (e) {
      console.warn('[Veron] navigator.clipboard.readText failed, trying backend fallback:', e);
    }
  }

  // Layer 2: Veron Backend Native Win32 GetClipboardData
  try {
    const res = await fetch(`${API_BASE}/api/clipboard`, {
      headers: getHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && typeof data.text === 'string') {
        return data.text;
      }
    }
  } catch (e) {
    console.warn('[Veron] Backend GET /api/clipboard failed:', e);
  }

  return '';
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.valid) {
      setAuthToken(token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function fetchSystemInfo(): Promise<SystemInfo> {
  const res = await fetch(`${API_BASE}/api/system`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch system info');
  const data: SystemInfo = await res.json();
  if (data.auth_token && !currentToken) {
    setAuthToken(data.auth_token);
  }
  return data;
}

export async function fetchSessions(): Promise<SessionInfo[]> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/sessions${tokenParam}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function createSession(params: {
  shell?: string;
  cwd?: string;
  name?: string;
  workspace_id?: string;
  init_cmd?: string;
  rows?: number;
  cols?: number;
}): Promise<SessionInfo> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/sessions${tokenParam}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

export async function closeSession(id: string): Promise<void> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/sessions/${id}${tokenParam}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error('Failed to close session');
}

export async function resizeSession(id: string, rows: number, cols: number): Promise<void> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  await fetch(`${API_BASE}/api/sessions/${id}/resize${tokenParam}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ rows, cols }),
  });
}

export async function uploadScreenshot(
  base64Data: string,
  sessionId?: string,
  filename?: string,
  pasteToTerminal: boolean = true
): Promise<{ success: boolean; file_path: string; relative_path: string }> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/upload${tokenParam}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      image: base64Data,
      filename,
      session_id: sessionId,
      paste_to_terminal: pasteToTerminal,
    }),
  });
  if (!res.ok) throw new Error('Failed to upload image');
  return res.json();
}

export async function uploadBatchScreenshots(
  items: { image: string; filename?: string }[],
  sessionId?: string
): Promise<{
  success: boolean;
  count: number;
  files: { file_path: string; relative_path: string }[];
  relative_paths: string[];
  paths_string: string;
}> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/upload/batch${tokenParam}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      images: items,
      session_id: sessionId,
    }),
  });
  if (!res.ok) throw new Error('Failed to upload batch images');
  return res.json();
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/workspaces${tokenParam}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  return res.json();
}

export async function createWorkspace(params: {
  name: string;
  path?: string;
  kind?: 'antigravity' | 'terminal';
  create_worktree?: boolean;
  branch?: string;
}): Promise<Workspace> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/workspaces${tokenParam}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let msg = 'Failed to create workspace';
    try {
      const err = await res.json();
      if (err?.message) msg = err.message;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteWorkspace(id: string): Promise<void> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/workspaces/${id}${tokenParam}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete workspace');
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/workspaces/${id}${tokenParam}`, {
    method: 'PATCH',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to rename workspace');
}

export async function fetchCapturesInfo(): Promise<CapturesInfo> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/captures${tokenParam}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch captures info');
  return res.json();
}

export async function clearCaptures(): Promise<number> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/captures${tokenParam}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to clear captures');
  const data = await res.json();
  return data.deleted || 0;
}

export async function openCapturesFolder(): Promise<void> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  await fetch(`${API_BASE}/api/captures/open${tokenParam}`, {
    method: 'POST',
    headers: getHeaders(),
  });
}

export async function sendSessionInput(sessionId: string, data: string): Promise<void> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/input${tokenParam}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error('Failed to send input to session');
}

export async function renameSession(sessionId: string, name: string): Promise<void> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}${tokenParam}`, {
    method: 'PATCH',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to rename session');
}

export async function fetchActiveState(): Promise<ActiveState> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/active${tokenParam}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch active state');
  return res.json();
}

export async function updateActiveState(
  workspace_id?: string,
  session_id?: string
): Promise<void> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  await fetch(`${API_BASE}/api/active${tokenParam}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ workspace_id, session_id }),
  }).catch(() => {});
}

export async function fetchGitStatus(path?: string): Promise<GitStatusResponse> {
  const tokenParam = currentToken ? `token=${encodeURIComponent(currentToken)}` : '';
  const pathParam = path ? `path=${encodeURIComponent(path)}` : '';
  const query = [tokenParam, pathParam].filter(Boolean).join('&');
  const url = `${API_BASE}/api/git/status${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch git status');
  return res.json();
}

export async function fetchGitDiff(path?: string, file?: string): Promise<{ diff: string }> {
  const params = new URLSearchParams();
  if (currentToken) params.set('token', currentToken);
  if (path) params.set('path', path);
  if (file) params.set('file', file);
  const q = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/git/diff${q}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch git diff');
  return res.json();
}

export async function fetchGitBranches(path?: string): Promise<string[]> {
  const params = new URLSearchParams();
  if (currentToken) params.set('token', currentToken);
  if (path) params.set('path', path);
  const q = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/git/branches${q}`, {
    headers: getHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchListeningPorts(workspaceId?: string): Promise<DetectedPort[]> {
  const params = new URLSearchParams();
  if (currentToken) params.set('token', currentToken);
  if (workspaceId) params.set('workspace_id', workspaceId);
  const q = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/ports${q}`, {
    headers: getHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function openBrowserUrl(url: string): Promise<void> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  await fetch(`${API_BASE}/api/open-url${tokenParam}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ url }),
  }).catch(() => {
    window.open(url, '_blank');
  });
}
