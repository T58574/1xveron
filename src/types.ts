export interface SessionInfo {
  id: string;
  name: string;
  shell: string;
  cwd: string;
  workspace_id: string;
  created_at: number;
  is_alive: boolean;
  pid?: number;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  kind?: 'antigravity' | 'terminal';
  branch?: string;
  is_worktree?: boolean;
}

export interface GitFileChange {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | string;
  insertions: number;
  deletions: number;
}

export interface GitStatusResponse {
  is_git: boolean;
  repo_root?: string;
  branch?: string;
  insertions: number;
  deletions: number;
  files_count: number;
  files: GitFileChange[];
}

export interface DetectedPort {
  port: number;
  pid: number;
  process_name: string;
}

export interface ShellOption {
  name: string;
  cmd: string;
  icon: string;
}

export interface NetworkInterface {
  name: string;
  ip: string;
}

export interface SystemInfo {
  local_ip: string;
  port: number;
  lan_url: string;
  hostname: string;
  auth_token: string;
  available_shells: ShellOption[];
  interfaces?: NetworkInterface[];
  active_workspace_id?: string;
  active_session_id?: string;
}

export interface ActiveState {
  workspace_id?: string;
  session_id?: string;
}

export interface CapturesInfo {
  count: number;
  size_bytes: number;
  size_formatted: string;
  captures_dir?: string;
}

export type CapturePathFormat = 'absolute' | 'relative' | 'markdown';

export interface CleanupCapturesResult {
  deleted_count: number;
  freed_bytes: number;
  remaining_count: number;
  remaining_size: number;
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
