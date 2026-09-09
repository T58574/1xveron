export interface SessionInfo {
  id: string;
  name: string;
  shell: string;
  cwd: string;
  workspace_id: string;
  created_at: number;
  is_alive: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
}

export interface ShellOption {
  name: string;
  cmd: string;
  icon: string;
}

export interface SystemInfo {
  local_ip: string;
  port: number;
  lan_url: string;
  hostname: string;
  auth_token: string;
  available_shells: ShellOption[];
}

export interface CapturesInfo {
  count: number;
  size_bytes: number;
  size_formatted: string;
}

export type LayoutMode = 1 | 2 | 3 | 4 | 5 | 6;

export interface PaneConfig {
  id: string;
  sessionId: string;
}

export interface QuickScript {
  id: string;
  title: string;
  command: string;
  category: 'system' | 'git' | 'dev' | 'custom';
  description?: string;
  autoExecute?: boolean;
}
