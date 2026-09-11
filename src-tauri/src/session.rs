use crate::pty::PtyInstance;
use parking_lot::{Mutex, RwLock};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::info;
use uuid::Uuid;

const MAX_HISTORY_BYTES: usize = 512 * 1024; // 512 KB scrollback buffer per session

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub name: String,
    pub shell: String,
    pub cwd: String,
    pub workspace_id: String,
    pub created_at: i64,
    pub is_alive: bool,
    #[serde(default)]
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub is_worktree: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveState {
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedCapture {
    pub file_path: String,
    pub relative_path: String,
}

pub struct Session {
    pub id: String,
    pub name: String,
    pub shell: String,
    pub cwd: String,
    pub workspace_id: String,
    pub created_at: i64,
    pub history: Arc<Mutex<Vec<u8>>>,
    pub output_tx: broadcast::Sender<Vec<u8>>,
    pub pty: Arc<Mutex<PtyInstance>>,
}

impl Session {
    pub fn to_info(&self) -> SessionInfo {
        let (is_alive, pid) = {
            let pty = self.pty.lock();
            (pty.running.load(Ordering::Relaxed), pty.process_id())
        };
        SessionInfo {
            id: self.id.clone(),
            name: self.name.clone(),
            shell: self.shell.clone(),
            cwd: self.cwd.clone(),
            workspace_id: self.workspace_id.clone(),
            created_at: self.created_at,
            is_alive,
            pid,
        }
    }
}

pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<String, Arc<Session>>>>,
    workspaces: Arc<RwLock<Vec<Workspace>>>,
    active_state: Arc<RwLock<ActiveState>>,
    captures_dir: PathBuf,
}

impl SessionManager {
    pub fn new() -> Self {
        // Determine default captures directory in project or user pictures
        let captures_dir = std::env::current_dir()
            .map(|p| p.join(".veron").join("captures"))
            .unwrap_or_else(|_| PathBuf::from("./captures"));

        let _ = std::fs::create_dir_all(&captures_dir);

        let default_workspace = Workspace {
            id: "default".to_string(),
            name: "veron".to_string(),
            path: std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| "C:\\".to_string()),
            kind: Some("terminal".to_string()),
            branch: None,
            is_worktree: Some(false),
        };

        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            workspaces: Arc::new(RwLock::new(vec![default_workspace])),
            active_state: Arc::new(RwLock::new(ActiveState {
                workspace_id: Some("default".to_string()),
                session_id: None,
            })),
            captures_dir,
        }
    }

    #[allow(dead_code)]
    pub fn with_captures_dir(captures_dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&captures_dir);
        let default_workspace = Workspace {
            id: "default".to_string(),
            name: "veron".to_string(),
            path: std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| "C:\\".to_string()),
            kind: Some("terminal".to_string()),
            branch: None,
            is_worktree: Some(false),
        };

        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            workspaces: Arc::new(RwLock::new(vec![default_workspace])),
            active_state: Arc::new(RwLock::new(ActiveState {
                workspace_id: Some("default".to_string()),
                session_id: None,
            })),
            captures_dir,
        }
    }

    pub fn get_active_state(&self) -> ActiveState {
        self.active_state.read().clone()
    }

    pub fn set_active_state(&self, workspace_id: Option<String>, session_id: Option<String>) {
        let mut state = self.active_state.write();
        if let Some(ws) = workspace_id {
            state.workspace_id = Some(ws);
        }
        if let Some(sid) = session_id {
            state.session_id = Some(sid);
        }
    }

    pub fn list_workspaces(&self) -> Vec<Workspace> {
        self.workspaces.read().clone()
    }

    #[allow(dead_code)]
    pub fn get_workspace(&self, id: &str) -> Option<Workspace> {
        self.workspaces.read().iter().find(|w| w.id == id).cloned()
    }

    pub fn get_workspace_session_pids(&self, workspace_id: &str) -> Vec<u32> {
        let sessions = self.sessions.read();
        sessions
            .values()
            .filter(|s| s.workspace_id == workspace_id)
            .filter_map(|s| {
                let pty = s.pty.lock();
                if pty.running.load(Ordering::Relaxed) {
                    pty.process_id()
                } else {
                    None
                }
            })
            .collect()
    }

    pub fn add_workspace(
        &self,
        name: String,
        path: Option<String>,
        kind: Option<String>,
        branch: Option<String>,
        is_worktree: Option<bool>,
    ) -> Workspace {
        let ws_path = path.unwrap_or_else(|| {
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| "C:\\".to_string())
        });
        let ws = Workspace {
            id: Uuid::new_v4().to_string(),
            name,
            path: ws_path,
            kind: kind.or(Some("terminal".to_string())),
            branch,
            is_worktree,
        };
        self.workspaces.write().push(ws.clone());
        self.set_active_state(Some(ws.id.clone()), None);
        ws
    }

    pub fn remove_workspace(&self, id: &str) -> bool {
        // Collect sessions belonging to this workspace and close them cleanly
        let session_ids: Vec<String> = {
            let sessions = self.sessions.read();
            sessions
                .values()
                .filter(|s| s.workspace_id == id)
                .map(|s| s.id.clone())
                .collect()
        };

        for sid in session_ids {
            self.close_session(&sid);
        }

        let mut workspaces = self.workspaces.write();
        let target_ws = workspaces.iter().find(|w| w.id == id).cloned();

        let initial_len = workspaces.len();
        workspaces.retain(|w| w.id != id);

        // If target was a git worktree, cleanly remove the worktree
        if let Some(ws) = target_ws {
            if ws.is_worktree == Some(true) {
                let ws_path = std::path::PathBuf::from(&ws.path);
                let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
                let _ = crate::git::remove_git_worktree(&current_dir, &ws_path);
            }
        }

        // If all workspaces were deleted, restore a default one
        if workspaces.is_empty() {
            let default_ws = Workspace {
                id: "default".to_string(),
                name: "default".to_string(),
                path: std::env::current_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| "C:\\".to_string()),
                kind: Some("terminal".to_string()),
                branch: None,
                is_worktree: Some(false),
            };
            workspaces.push(default_ws);
        }

        workspaces.len() != initial_len
    }

    pub fn rename_workspace(&self, id: &str, new_name: &str) -> bool {
        let mut workspaces = self.workspaces.write();
        if let Some(ws) = workspaces.iter_mut().find(|w| w.id == id) {
            ws.name = new_name.trim().to_string();
            true
        } else {
            false
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_session(
        &self,
        shell: Option<String>,
        cwd: Option<String>,
        name: Option<String>,
        workspace_id: Option<String>,
        init_cmd: Option<String>,
        rows: u16,
        cols: u16,
    ) -> Result<SessionInfo, Box<dyn std::error::Error + Send + Sync>> {
        let shell_cmd = shell.unwrap_or_else(|| {
            // Prefer powershell.exe on Windows
            if cfg!(target_os = "windows") {
                "powershell.exe".to_string()
            } else {
                "bash".to_string()
            }
        });

        let ws_id = workspace_id.unwrap_or_else(|| "default".to_string());

        let (current_dir, is_antigravity) = {
            let workspaces = self.workspaces.read();
            let ws = workspaces.iter().find(|w| w.id == ws_id);
            let dir = cwd.or_else(|| {
                ws.and_then(|w| if !w.path.is_empty() { Some(w.path.clone()) } else { None })
            }).unwrap_or_else(|| {
                std::env::current_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| "C:\\".to_string())
            });
            let is_agy = ws.map(|w| w.kind.as_deref() == Some("antigravity")).unwrap_or(false);
            (dir, is_agy)
        };

        let id = Uuid::new_v4().to_string();
        let session_name = name.unwrap_or_else(|| {
            if is_antigravity {
                "Antigravity".to_string()
            } else if shell_cmd.contains("powershell") {
                "PowerShell".to_string()
            } else if shell_cmd.contains("cmd") {
                "Command Prompt".to_string()
            } else if shell_cmd.contains("wsl") {
                "WSL".to_string()
            } else {
                "Terminal".to_string()
            }
        });

        let (output_tx, mut output_rx) = broadcast::channel(1024);
        let history = Arc::new(Mutex::new(Vec::new()));
        let history_clone = history.clone();

        // Spawn PTY
        let pty = PtyInstance::spawn(
            &shell_cmd,
            Some(&current_dir),
            rows,
            cols,
            output_tx.clone(),
        )?;

        // Maintain history buffer in background task
        tokio::spawn(async move {
            while let Ok(data) = output_rx.recv().await {
                let mut hist = history_clone.lock();
                hist.extend_from_slice(&data);
                if hist.len() > MAX_HISTORY_BYTES {
                    let trim = hist.len() - MAX_HISTORY_BYTES;
                    hist.drain(0..trim);
                }
            }
        });

        let pty_mutex = Arc::new(Mutex::new(pty));

        // Auto-run init_cmd or 'agy\r' if this is an antigravity workspace
        let effective_cmd = init_cmd.or_else(|| {
            if is_antigravity {
                Some("agy\r".to_string())
            } else {
                None
            }
        });

        if let Some(cmd) = effective_cmd {
            let pty_clone = pty_mutex.clone();
            tokio::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(600)).await;
                let mut pty = pty_clone.lock();
                let _ = pty.write_input(cmd.as_bytes());
            });
        }

        let session = Arc::new(Session {
            id: id.clone(),
            name: session_name,
            shell: shell_cmd,
            cwd: current_dir,
            workspace_id: ws_id.clone(),
            created_at: chrono::Utc::now().timestamp(),
            history,
            output_tx,
            pty: pty_mutex,
        });

        let info = session.to_info();
        self.sessions.write().insert(id.clone(), session);
        self.set_active_state(Some(ws_id), Some(id));
        Ok(info)
    }

    pub fn open_captures_in_explorer(&self) -> Result<(), String> {
        #[cfg(windows)]
        {
            std::process::Command::new("explorer")
                .arg(&self.captures_dir)
                .spawn()
                .map_err(|e| format!("Failed to launch explorer: {}", e))?;
            Ok(())
        }
        #[cfg(not(windows))]
        {
            Ok(())
        }
    }

    pub fn get_session(&self, id: &str) -> Option<Arc<Session>> {
        self.sessions.read().get(id).cloned()
    }

    pub fn list_sessions(&self) -> Vec<SessionInfo> {
        let sessions = self.sessions.read();
        let mut list: Vec<SessionInfo> = sessions.values().map(|s| s.to_info()).collect();
        list.sort_by_key(|s| s.created_at);
        list
    }

    pub fn close_session(&self, id: &str) -> bool {
        let mut sessions = self.sessions.write();
        if let Some(session) = sessions.remove(id) {
            let mut pty = session.pty.lock();
            pty.kill();
            info!("Closed session: {}", id);
            true
        } else {
            false
        }
    }

    pub fn close_all(&self) {
        let mut sessions = self.sessions.write();
        let count = sessions.len();
        if count > 0 {
            info!("Closing all {} active terminal sessions...", count);
            for (id, session) in sessions.drain() {
                let mut pty = session.pty.lock();
                pty.kill();
                info!("Cleaned up session process tree for {}", id);
            }
        }
    }

    pub fn rename_session(&self, id: &str, new_name: &str) -> bool {
        let mut sessions = self.sessions.write();
        if let Some(session) = sessions.get(id) {
            let updated = Arc::new(Session {
                id: session.id.clone(),
                name: new_name.trim().to_string(),
                shell: session.shell.clone(),
                cwd: session.cwd.clone(),
                workspace_id: session.workspace_id.clone(),
                created_at: session.created_at,
                history: session.history.clone(),
                output_tx: session.output_tx.clone(),
                pty: session.pty.clone(),
            });
            sessions.insert(id.to_string(), updated);
            true
        } else {
            false
        }
    }

    pub fn write_input(&self, id: &str, data: &[u8]) -> Result<(), String> {
        if let Some(session) = self.get_session(id) {
            let mut pty = session.pty.lock();
            pty.write_input(data)
                .map_err(|e| format!("Failed to write to PTY: {}", e))?;
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    }

    pub fn resize_session(&self, id: &str, rows: u16, cols: u16) -> Result<(), String> {
        if let Some(session) = self.get_session(id) {
            let mut pty = session.pty.lock();
            pty.resize(rows, cols)
                .map_err(|e| format!("Failed to resize PTY: {}", e))?;
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    }

    pub fn save_single_image(
        &self,
        base64_data: &str,
        custom_name: Option<&str>,
        session_id: Option<&str>,
    ) -> Result<SavedCapture, String> {
        let _ = std::fs::create_dir_all(&self.captures_dir);

        // Extract prefix if present (e.g. data:image/png;base64)
        let (header, clean_base64) = if let Some(idx) = base64_data.find(",") {
            (&base64_data[..idx], &base64_data[idx + 1..])
        } else {
            ("", base64_data)
        };

        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(clean_base64.trim())
            .map_err(|e| format!("Failed to decode base64: {}", e))?;

        let detected_ext = detect_image_extension(header, &bytes);
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S_%3f");

        let filename = if let Some(orig_name) = custom_name {
            let clean_orig = sanitize_filename(orig_name);
            if clean_orig.contains('.') {
                format!("img_{}_{}", timestamp, clean_orig)
            } else {
                format!("img_{}_{}.{}", timestamp, clean_orig, detected_ext)
            }
        } else {
            format!("screenshot_{}.{}", timestamp, detected_ext)
        };

        let target_path = self.captures_dir.join(&filename);

        std::fs::write(&target_path, &bytes)
            .map_err(|e| format!("Failed to save image file: {}", e))?;

        let full_path_buf = target_path
            .canonicalize()
            .unwrap_or_else(|_| target_path.clone());
        let full_path_str = strip_extended_prefix(&full_path_buf)
            .to_string_lossy()
            .to_string();

        let base_dir = session_id
            .and_then(|sid| self.sessions.read().get(sid).map(|s| PathBuf::from(&s.cwd)))
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

        let relative_path = calculate_relative_path(&base_dir, &target_path);

        info!(
            "Saved capture: full={}, relative={}",
            full_path_str, relative_path
        );

        Ok(SavedCapture {
            file_path: full_path_str,
            relative_path,
        })
    }

    pub fn save_image_and_paste(
        &self,
        base64_data: &str,
        custom_name: Option<&str>,
        session_id: Option<&str>,
        paste_to_terminal: bool,
    ) -> Result<SavedCapture, String> {
        let capture = self.save_single_image(base64_data, custom_name, session_id)?;

        if paste_to_terminal {
            if let Some(sid) = session_id {
                let formatted = if capture.relative_path.contains(' ') {
                    format!(" \"{}\" ", capture.relative_path)
                } else {
                    format!(" {} ", capture.relative_path)
                };
                let _ = self.write_input(sid, formatted.as_bytes());
            }
        }

        Ok(capture)
    }

    pub fn save_images_batch_and_paste(
        &self,
        items: &[(String, Option<String>)],
        session_id: Option<&str>,
    ) -> Result<Vec<SavedCapture>, String> {
        let mut captures = Vec::new();

        for (base64_data, orig_name) in items {
            let cap = self.save_single_image(base64_data, orig_name.as_deref(), session_id)?;
            captures.push(cap);
        }

        if let Some(sid) = session_id {
            if !captures.is_empty() {
                let paths: Vec<String> = captures
                    .iter()
                    .map(|c| {
                        if c.relative_path.contains(' ') {
                            format!("\"{}\"", c.relative_path)
                        } else {
                            c.relative_path.clone()
                        }
                    })
                    .collect();
                let joined = format!(" {} ", paths.join(" "));
                let _ = self.write_input(sid, joined.as_bytes());
            }
        }

        Ok(captures)
    }

    pub fn get_captures_info(&self) -> (usize, u64) {
        let mut count = 0;
        let mut total_size = 0;
        if let Ok(entries) = std::fs::read_dir(&self.captures_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        count += 1;
                        total_size += meta.len();
                    }
                }
            }
        }
        (count, total_size)
    }

    pub fn clear_captures(&self) -> Result<usize, std::io::Error> {
        let mut deleted = 0;
        if let Ok(entries) = std::fs::read_dir(&self.captures_dir) {
            for entry in entries.flatten() {
                if entry.path().is_file() && std::fs::remove_file(entry.path()).is_ok() {
                    deleted += 1;
                }
            }
        }
        Ok(deleted)
    }
}

impl Drop for SessionManager {
    fn drop(&mut self) {
        self.close_all();
    }
}

fn calculate_relative_path(base: &std::path::Path, target: &std::path::Path) -> String {
    let base_canon = base
        .canonicalize()
        .unwrap_or_else(|_| base.to_path_buf());
    let target_canon = target
        .canonicalize()
        .unwrap_or_else(|_| target.to_path_buf());

    let clean_base = strip_extended_prefix(&base_canon);
    let clean_target = strip_extended_prefix(&target_canon);

    // If target is directly inside base directory
    if let Ok(rel) = clean_target.strip_prefix(&clean_base) {
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        if rel_str.is_empty() {
            return ".".to_string();
        }
        if rel_str.starts_with('.') {
            return rel_str;
        } else {
            return format!("./{}", rel_str);
        }
    }

    // Otherwise compute relative path by diffing components
    let base_components: Vec<_> = clean_base.components().collect();
    let target_components: Vec<_> = clean_target.components().collect();

    if !base_components.is_empty()
        && !target_components.is_empty()
        && base_components[0] == target_components[0]
    {
        let mut common_len = 0;
        while common_len < base_components.len()
            && common_len < target_components.len()
            && base_components[common_len] == target_components[common_len]
        {
            common_len += 1;
        }

        let mut parts = Vec::new();
        for _ in common_len..base_components.len() {
            parts.push("..".to_string());
        }
        for comp in &target_components[common_len..] {
            if let Some(s) = comp.as_os_str().to_str() {
                parts.push(s.to_string());
            }
        }

        let rel = parts.join("/");
        if !rel.is_empty() {
            return rel;
        }
    }

    clean_target.to_string_lossy().replace('\\', "/")
}

fn strip_extended_prefix(path: &std::path::Path) -> std::path::PathBuf {
    let s = path.to_string_lossy();
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        std::path::PathBuf::from(stripped)
    } else {
        path.to_path_buf()
    }
}

fn detect_image_extension(header: &str, bytes: &[u8]) -> &'static str {
    // 1. Detect by magic bytes
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return "png";
    }
    if bytes.starts_with(b"\xff\xd8\xff") {
        return "jpg";
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return "gif";
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return "webp";
    }
    if bytes.starts_with(b"BM") {
        return "bmp";
    }
    if bytes.starts_with(b"<?xml") || bytes.starts_with(b"<svg") {
        return "svg";
    }

    // 2. Fallback to MIME in Data URL header
    let lower = header.to_lowercase();
    if lower.contains("image/jpeg") || lower.contains("image/jpg") {
        "jpg"
    } else if lower.contains("image/webp") {
        "webp"
    } else if lower.contains("image/gif") {
        "gif"
    } else if lower.contains("image/svg") {
        "svg"
    } else if lower.contains("image/bmp") {
        "bmp"
    } else {
        "png"
    }
}

fn sanitize_filename(name: &str) -> String {
    let file_name = std::path::Path::new(name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(name);

    let clean: String = file_name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = clean.trim_matches(|c| c == '_' || c == '.');
    if trimmed.is_empty() {
        "image".to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_relative_path_nested() {
        let base = Path::new(r"C:\Users\user\Documents\dev\veron");
        let target = Path::new(r"C:\Users\user\Documents\dev\veron\.veron\captures\screenshot_20260910_070000.png");
        let rel = calculate_relative_path(base, target);
        assert_eq!(rel, ".veron/captures/screenshot_20260910_070000.png");
    }

    #[test]
    fn test_relative_path_subdirectory() {
        let base = Path::new(r"C:\Users\user\Documents\dev\veron\src-tauri");
        let target = Path::new(r"C:\Users\user\Documents\dev\veron\.veron\captures\screenshot_20260910_070000.png");
        let rel = calculate_relative_path(base, target);
        assert_eq!(rel, "../.veron/captures/screenshot_20260910_070000.png");
    }

    #[test]
    fn test_relative_path_verbatim_prefix() {
        let base = Path::new(r"\\?\C:\Users\user\Documents\dev\veron");
        let target = Path::new(r"\\?\C:\Users\user\Documents\dev\veron\.veron\captures\screenshot_20260910_070000.png");
        let rel = calculate_relative_path(base, target);
        assert_eq!(rel, ".veron/captures/screenshot_20260910_070000.png");
    }

    #[test]
    fn test_detect_image_extension() {
        assert_eq!(detect_image_extension("", b"\x89PNG\r\n\x1a\n..."), "png");
        assert_eq!(detect_image_extension("", b"\xff\xd8\xff\xe0..."), "jpg");
        assert_eq!(detect_image_extension("", b"GIF89a..."), "gif");
        assert_eq!(detect_image_extension("", b"RIFF\x00\x00\x00\x00WEBP..."), "webp");
        assert_eq!(detect_image_extension("", b"BM..."), "bmp");
        assert_eq!(detect_image_extension("", b"<svg viewBox=\"0 0 100 100\"></svg>"), "svg");
        assert_eq!(detect_image_extension("data:image/webp;base64", b"unknown bytes"), "webp");
    }

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("my architecture (v2).png"), "my_architecture__v2_.png");
        assert_eq!(sanitize_filename("../../../danger.png"), "danger.png");
        assert_eq!(sanitize_filename("___"), "image");
    }

    #[test]
    fn test_save_image_without_terminal_paste() {
        let temp_dir = std::env::temp_dir().join(format!("veron_test_caps_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
        let sm = SessionManager::with_captures_dir(temp_dir.clone());
        
        // 1x1 8-bit PNG in base64
        let base64_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        
        // Test with paste_to_terminal = false
        let cap = sm.save_image_and_paste(base64_png, Some("agy_test.png"), None, false).unwrap();
        assert!(cap.file_path.ends_with("agy_test.png"));
        assert!(std::path::Path::new(&cap.file_path).exists());
        
        let _ = std::fs::remove_dir_all(temp_dir);
    }
}

