import { CapturesInfo, SessionInfo, SystemInfo, Workspace } from '../types';

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
  sessionId?: string
): Promise<{ success: boolean; file_path: string }> {
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const res = await fetch(`${API_BASE}/api/upload${tokenParam}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      image: base64Data,
      session_id: sessionId,
    }),
  });
  if (!res.ok) throw new Error('Failed to upload image');
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
