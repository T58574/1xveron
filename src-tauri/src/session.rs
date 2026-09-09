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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: String,
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
        let is_alive = {
            let pty = self.pty.lock();
            pty.running.load(Ordering::Relaxed)
        };
        SessionInfo {
            id: self.id.clone(),
            name: self.name.clone(),
            shell: self.shell.clone(),
            cwd: self.cwd.clone(),
            workspace_id: self.workspace_id.clone(),
            created_at: self.created_at,
            is_alive,
        }
    }
}

pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<String, Arc<Session>>>>,
    workspaces: Arc<RwLock<Vec<Workspace>>>,
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
        };

        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            workspaces: Arc::new(RwLock::new(vec![default_workspace])),
            captures_dir,
        }
    }

    pub fn list_workspaces(&self) -> Vec<Workspace> {
        self.workspaces.read().clone()
    }

    #[allow(dead_code)]
    pub fn add_workspace(&self, name: String, path: String) -> Workspace {
        let ws = Workspace {
            id: Uuid::new_v4().to_string(),
            name,
            path,
        };
        self.workspaces.write().push(ws.clone());
        ws
    }

    pub fn create_session(
        &self,
        shell: Option<String>,
        cwd: Option<String>,
        name: Option<String>,
        workspace_id: Option<String>,
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

        let current_dir = cwd.unwrap_or_else(|| {
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| "C:\\".to_string())
        });

        let id = Uuid::new_v4().to_string();
        let session_name = name.unwrap_or_else(|| {
            if shell_cmd.contains("powershell") {
                "PowerShell".to_string()
            } else if shell_cmd.contains("cmd") {
                "Command Prompt".to_string()
            } else if shell_cmd.contains("wsl") {
                "WSL".to_string()
            } else {
                "Terminal".to_string()
            }
        });

        let ws_id = workspace_id.unwrap_or_else(|| "default".to_string());

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

        let session = Arc::new(Session {
            id: id.clone(),
            name: session_name,
            shell: shell_cmd,
            cwd: current_dir,
            workspace_id: ws_id,
            created_at: chrono::Utc::now().timestamp(),
            history,
            output_tx,
            pty: Arc::new(Mutex::new(pty)),
        });

        let info = session.to_info();
        self.sessions.write().insert(id, session);
        Ok(info)
    }

    pub fn get_session(&self, id: &str) -> Option<Arc<Session>> {
        self.sessions.read().get(id).cloned()
    }

    pub fn list_sessions(&self) -> Vec<SessionInfo> {
        let sessions = self.sessions.read();
        sessions.values().map(|s| s.to_info()).collect()
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

    pub fn save_image_and_paste(
        &self,
        base64_data: &str,
        session_id: Option<&str>,
    ) -> Result<String, String> {
        // Strip data:image/png;base64, prefix if present
        let clean_base64 = if let Some(idx) = base64_data.find(",") {
            &base64_data[idx + 1..]
        } else {
            base64_data
        };

        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(clean_base64.trim())
            .map_err(|e| format!("Failed to decode base64: {}", e))?;

        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let filename = format!("screenshot_{}.png", timestamp);
        let target_path = self.captures_dir.join(&filename);

        std::fs::write(&target_path, &bytes)
            .map_err(|e| format!("Failed to save image file: {}", e))?;

        let mut full_path_str = target_path
            .canonicalize()
            .unwrap_or(target_path)
            .to_string_lossy()
            .to_string();

        if full_path_str.starts_with(r"\\?\") {
            full_path_str = full_path_str[4..].to_string();
        }

        info!("Saved clipboard image to: {}", full_path_str);

        // If a target session is active, write the path directly into its stdin
        if let Some(sid) = session_id {
            // Write formatted path surrounded by quotes if it contains spaces
            let formatted = if full_path_str.contains(' ') {
                format!("\"{}\"", full_path_str)
            } else {
                full_path_str.clone()
            };
            let _ = self.write_input(sid, formatted.as_bytes());
        }

        Ok(full_path_str)
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
                if entry.path().is_file() {
                    if std::fs::remove_file(entry.path()).is_ok() {
                        deleted += 1;
                    }
                }
            }
        }
        Ok(deleted)
    }
}
