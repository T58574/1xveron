use crate::session::{SessionInfo, SessionManager, Workspace};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        DefaultBodyLimit, Path, Query, State,
    },
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use futures::{sink::SinkExt, stream::StreamExt};
use local_ip_address::{list_afinet_netifas, local_ip};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../dist"]
struct FrontendAssets;

#[derive(Clone)]
pub struct AppState {
    pub manager: Arc<SessionManager>,
    pub port: u16,
    pub auth_token: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct NetworkInterface {
    pub name: String,
    pub ip: String,
}

#[derive(Serialize)]
pub struct SystemInfo {
    pub local_ip: String,
    pub port: u16,
    pub lan_url: String,
    pub hostname: String,
    pub auth_token: String,
    pub available_shells: Vec<ShellOption>,
    pub interfaces: Vec<NetworkInterface>,
    pub active_workspace_id: Option<String>,
    pub active_session_id: Option<String>,
}

#[derive(Serialize)]
pub struct ShellOption {
    pub name: String,
    pub cmd: String,
    pub icon: String,
}

#[derive(Deserialize)]
pub struct CreateSessionPayload {
    pub shell: Option<String>,
    pub cwd: Option<String>,
    pub name: Option<String>,
    pub workspace_id: Option<String>,
    pub init_cmd: Option<String>,
    pub rows: Option<u16>,
    pub cols: Option<u16>,
}

#[derive(Deserialize)]
pub struct ResizePayload {
    pub rows: u16,
    pub cols: u16,
}

#[derive(Deserialize)]
pub struct UploadPayload {
    pub image: String,
    pub filename: Option<String>,
    pub session_id: Option<String>,
    pub paste_to_terminal: Option<bool>,
}

#[derive(Deserialize)]
pub struct UploadItem {
    pub image: String,
    pub filename: Option<String>,
}

#[derive(Deserialize)]
pub struct BatchUploadPayload {
    pub images: Vec<UploadItem>,
    pub session_id: Option<String>,
}

#[derive(Serialize)]
pub struct UploadResponse {
    pub success: bool,
    pub file_path: String,
    pub relative_path: String,
}

#[derive(Serialize)]
pub struct BatchUploadResponse {
    pub success: bool,
    pub count: usize,
    pub files: Vec<crate::session::SavedCapture>,
    pub relative_paths: Vec<String>,
    pub paths_string: String,
}

#[derive(Serialize)]
pub struct CapturesInfo {
    pub count: usize,
    pub size_bytes: u64,
    pub size_formatted: String,
}

#[derive(Deserialize)]
pub struct VerifyTokenPayload {
    pub token: String,
}

#[derive(Deserialize)]
pub struct InputPayload {
    pub data: String,
}

#[derive(Deserialize)]
pub struct RenamePayload {
    pub name: String,
}

#[derive(Deserialize)]
pub struct CreateWorkspacePayload {
    pub name: String,
    pub path: Option<String>,
    pub kind: Option<String>,
    pub create_worktree: Option<bool>,
    pub branch: Option<String>,
}

#[derive(Deserialize)]
pub struct RenameWorkspacePayload {
    pub name: String,
}

#[derive(Deserialize)]
pub struct OpenUrlPayload {
    pub url: String,
}

#[derive(Deserialize)]
pub struct SetClipboardPayload {
    pub text: String,
}

#[derive(Serialize)]
pub struct ClipboardResponse {
    pub success: bool,
    pub text: Option<String>,
}

#[derive(Serialize)]
pub struct GitDiffResponse {
    pub diff: String,
}

fn is_authorized(headers: &HeaderMap, query_token: Option<&str>, state: &AppState) -> bool {
    // 1. Check query parameter token
    if let Some(t) = query_token {
        if t == state.auth_token {
            return true;
        }
    }
    // 2. Check Authorization Bearer header
    if let Some(auth) = headers.get("authorization") {
        if let Ok(val) = auth.to_str() {
            let token = val.strip_prefix("Bearer ").unwrap_or(val).trim();
            if token == state.auth_token {
                return true;
            }
        }
    }
    // 3. Check X-Veron-Token header
    if let Some(header_token) = headers.get("x-veron-token") {
        if let Ok(val) = header_token.to_str() {
            if val.trim() == state.auth_token {
                return true;
            }
        }
    }
    false
}

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::PATCH, Method::OPTIONS])
        .allow_headers(Any);

    Router::new()
        .route("/api/system", get(get_system_info))
        .route("/api/auth/verify", post(verify_token))
        .route("/api/active", get(get_active_state).post(set_active_state))
        .route("/api/sessions", get(list_sessions).post(create_session))
        .route("/api/sessions/:id", delete(close_session).patch(rename_session))
        .route("/api/sessions/:id/resize", post(resize_session))
        .route("/api/sessions/:id/input", post(send_session_input))
        .route(
            "/api/upload",
            post(upload_screenshot).layer(DefaultBodyLimit::max(50 * 1024 * 1024)),
        )
        .route(
            "/api/upload/batch",
            post(upload_batch_screenshots).layer(DefaultBodyLimit::max(100 * 1024 * 1024)),
        )
        .route("/api/captures", get(get_captures_info).delete(clear_captures))
        .route("/api/captures/open", post(open_captures_folder))
        .route("/api/workspaces", get(list_workspaces).post(create_workspace))
        .route("/api/workspaces/:id", delete(delete_workspace).patch(rename_workspace))
        .route("/api/git/status", get(get_git_status_handler))
        .route("/api/git/diff", get(get_git_diff_handler))
        .route("/api/git/branches", get(get_git_branches_handler))
        .route("/api/ports", get(get_listening_ports_handler))
        .route("/api/open-url", post(open_url_handler))
        .route("/api/clipboard", get(get_clipboard_handler).post(set_clipboard_handler))
        .route("/ws/terminal/:id", get(ws_terminal_handler))
        .fallback(static_file_handler)
        .layer(cors)
        .with_state(state)
}

async fn static_file_handler(uri: axum::http::Uri) -> impl axum::response::IntoResponse {
    let raw_path = uri.path().trim_start_matches('/');
    let rel_path = if raw_path.is_empty() { "index.html" } else { raw_path };

    // Prevent directory traversal: reject paths containing ParentDir (".."), RootDir, or Prefix
    let has_traversal = std::path::Path::new(rel_path)
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir | std::path::Component::RootDir | std::path::Component::Prefix(_)));
    if has_traversal {
        return (StatusCode::FORBIDDEN, "Access denied").into_response();
    }

    // 1. Try disk if dist/ exists (strictly confined within dist/ directory)
    let disk_roots = [
        std::path::PathBuf::from("./dist"),
        std::path::PathBuf::from("../dist"),
    ];
    for root in &disk_roots {
        if let Ok(canon_root) = root.canonicalize() {
            let target = canon_root.join(rel_path);
            if let Ok(canon_target) = target.canonicalize() {
                if canon_target.starts_with(&canon_root) && canon_target.is_file() {
                    if let Ok(data) = std::fs::read(&canon_target) {
                        let mime = mime_guess::from_path(rel_path).first_or_octet_stream();
                        return ([(axum::http::header::CONTENT_TYPE, mime.as_ref())], data).into_response();
                    }
                }
            }
        }
    }

    // 2. Embedded assets fallback (pure portable executable support)
    match FrontendAssets::get(rel_path) {
        Some(content) => {
            let mime = mime_guess::from_path(rel_path).first_or_octet_stream();
            ([(axum::http::header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => {
            // 3. SPA fallback to index.html (confined strictly to canon_root)
            for root in &disk_roots {
                if let Ok(canon_root) = root.canonicalize() {
                    let index_path = canon_root.join("index.html");
                    if index_path.exists() && index_path.is_file() {
                        if let Ok(data) = std::fs::read(&index_path) {
                            return ([(axum::http::header::CONTENT_TYPE, "text/html")], data).into_response();
                        }
                    }
                }
            }
            if let Some(content) = FrontendAssets::get("index.html") {
                ([(axum::http::header::CONTENT_TYPE, "text/html")], content.data).into_response()
            } else {
                (StatusCode::NOT_FOUND, "Frontend assets not found").into_response()
            }
        }
    }
}

async fn verify_token(
    State(state): State<AppState>,
    Json(payload): Json<VerifyTokenPayload>,
) -> Json<serde_json::Value> {
    let valid = payload.token.trim() == state.auth_token;
    Json(serde_json::json!({ "valid": valid }))
}

fn score_ip(name: &str, ip: &std::net::Ipv4Addr) -> i32 {
    if ip.is_loopback() || ip.is_unspecified() {
        return -1000;
    }
    if ip.is_link_local() {
        return -500;
    }

    let octets = ip.octets();
    let name_lower = name.to_lowercase();

    let is_virtual = name_lower.contains("vethernet")
        || name_lower.contains("wsl")
        || name_lower.contains("docker")
        || name_lower.contains("xray")
        || name_lower.contains("happ-")
        || name_lower.contains("tun")
        || name_lower.contains("tap")
        || name_lower.contains("vpn")
        || name_lower.contains("wireguard")
        || name_lower.contains("tailscale")
        || name_lower.contains("zerotier")
        || name_lower.contains("hyper-v")
        || name_lower.contains("vmware")
        || name_lower.contains("virtualbox")
        || name_lower.contains("pseudo");

    let is_likely_wifi_or_ethernet = name_lower.contains("wi-fi")
        || name_lower.contains("wifi")
        || name_lower.contains("wlan")
        || name_lower.contains("беспроводн")
        || name_lower.contains("ethernet")
        || name_lower.contains("сеть");

    let is_192_168 = octets[0] == 192 && octets[1] == 168;
    let is_10 = octets[0] == 10;
    let is_172 = octets[0] == 172 && (16..=31).contains(&octets[1]);

    let mut score = 100;

    if is_likely_wifi_or_ethernet {
        score += 500;
    }
    if is_virtual {
        score -= 600;
    }

    if is_192_168 {
        score += 400;
    } else if is_10 {
        score += 300;
    } else if is_172 {
        score += 100;
    }

    score
}

pub fn get_network_interfaces() -> (String, Vec<NetworkInterface>) {
    let mut candidates: Vec<(String, std::net::Ipv4Addr, i32)> = Vec::new();

    if let Ok(ifaces) = list_afinet_netifas() {
        for (name, ip) in ifaces {
            if let std::net::IpAddr::V4(ipv4) = ip {
                let score = score_ip(&name, &ipv4);
                candidates.push((name, ipv4, score));
            }
        }
    }

    // Sort by score descending (highest priority first)
    candidates.sort_by_key(|b| std::cmp::Reverse(b.2));

    let best_ip = candidates
        .first()
        .map(|(_, ip, _)| ip.to_string())
        .unwrap_or_else(|| {
            local_ip()
                .map(|ip| ip.to_string())
                .unwrap_or_else(|_| "127.0.0.1".to_string())
        });

    // Exclude loopback and unspecified addresses from interfaces list for the UI
    let interfaces = candidates
        .into_iter()
        .filter(|(_, ip, _)| !ip.is_loopback() && !ip.is_unspecified())
        .map(|(name, ip, _)| NetworkInterface {
            name,
            ip: ip.to_string(),
        })
        .collect();

    (best_ip, interfaces)
}

async fn get_system_info(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Json<SystemInfo> {
    let (ip, interfaces) = get_network_interfaces();
    let authorized = is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state);

    let lan_url = if authorized {
        format!("http://{}:{}?token={}", ip, state.port, state.auth_token)
    } else {
        format!("http://{}:{}", ip, state.port)
    };

    let token_to_return = if authorized {
        state.auth_token.clone()
    } else {
        String::new()
    };

    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "localhost".to_string());

    let mut shells = Vec::new();
    if cfg!(target_os = "windows") {
        shells.push(ShellOption {
            name: "PowerShell".into(),
            cmd: "powershell.exe".into(),
            icon: "powershell".into(),
        });
        shells.push(ShellOption {
            name: "Command Prompt".into(),
            cmd: "cmd.exe".into(),
            icon: "cmd".into(),
        });

        if which::which("pwsh.exe").is_ok() {
            shells.push(ShellOption {
                name: "PowerShell 7".into(),
                cmd: "pwsh.exe".into(),
                icon: "powershell".into(),
            });
        }

        if which::which("wsl.exe").is_ok() {
            shells.push(ShellOption {
                name: "WSL (Linux)".into(),
                cmd: "wsl.exe".into(),
                icon: "linux".into(),
            });
        }

        let git_bash_path = "C:\\Program Files\\Git\\bin\\bash.exe";
        if std::path::Path::new(git_bash_path).exists() {
            shells.push(ShellOption {
                name: "Git Bash".into(),
                cmd: git_bash_path.into(),
                icon: "git".into(),
            });
        }
    } else {
        shells.push(ShellOption {
            name: "Bash".into(),
            cmd: "bash".into(),
            icon: "terminal".into(),
        });
    }

    let active_state = state.manager.get_active_state();

    Json(SystemInfo {
        local_ip: ip,
        port: state.port,
        lan_url,
        hostname,
        auth_token: token_to_return,
        available_shells: shells,
        interfaces,
        active_workspace_id: active_state.workspace_id,
        active_session_id: active_state.session_id,
    })
}

#[derive(Deserialize)]
pub struct SetActivePayload {
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
}

async fn get_active_state(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<crate::session::ActiveState>, StatusCode> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(Json(state.manager.get_active_state()))
}

async fn set_active_state(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Json(payload): Json<SetActivePayload>,
) -> Result<StatusCode, StatusCode> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    state.manager.set_active_state(payload.workspace_id, payload.session_id);
    Ok(StatusCode::OK)
}

async fn list_sessions(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<Vec<SessionInfo>>, StatusCode> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        // Allow unauthenticated only from localhost
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(Json(state.manager.list_sessions()))
}

async fn create_session(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Json(payload): Json<CreateSessionPayload>,
) -> Result<Json<SessionInfo>, (StatusCode, String)> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".into()));
    }

    let rows = payload.rows.unwrap_or(24);
    let cols = payload.cols.unwrap_or(80);

    state
        .manager
        .create_session(
            payload.shell,
            payload.cwd,
            payload.name,
            payload.workspace_id,
            payload.init_cmd,
            rows,
            cols,
        )
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn close_session(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> StatusCode {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return StatusCode::UNAUTHORIZED;
    }
    if state.manager.close_session(&id) {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

async fn rename_session(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<RenamePayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".into()));
    }
    if state.manager.rename_session(&id, &payload.name) {
        Ok(StatusCode::OK)
    } else {
        Err((StatusCode::NOT_FOUND, "Session not found".into()))
    }
}

async fn resize_session(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<ResizePayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".into()));
    }
    state
        .manager
        .resize_session(&id, payload.rows, payload.cols)
        .map(|_| StatusCode::OK)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))
}

async fn send_session_input(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<InputPayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".into()));
    }
    state
        .manager
        .write_input(&id, payload.data.as_bytes())
        .map(|_| StatusCode::OK)
        .map_err(|e| (StatusCode::BAD_REQUEST, e))
}

async fn upload_screenshot(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Json(payload): Json<UploadPayload>,
) -> Result<Json<UploadResponse>, (StatusCode, String)> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".into()));
    }
    let paste_to_terminal = payload.paste_to_terminal.unwrap_or(true);
    match state.manager.save_image_and_paste(
        &payload.image,
        payload.filename.as_deref(),
        payload.session_id.as_deref(),
        paste_to_terminal,
    ) {
        Ok(capture) => Ok(Json(UploadResponse {
            success: true,
            file_path: capture.file_path,
            relative_path: capture.relative_path,
        })),
        Err(e) => Err((StatusCode::BAD_REQUEST, e)),
    }
}

async fn upload_batch_screenshots(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Json(payload): Json<BatchUploadPayload>,
) -> Result<Json<BatchUploadResponse>, (StatusCode, String)> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".into()));
    }

    let items: Vec<(String, Option<String>)> = payload
        .images
        .into_iter()
        .map(|item| (item.image, item.filename))
        .collect();

    match state
        .manager
        .save_images_batch_and_paste(&items, payload.session_id.as_deref())
    {
        Ok(captures) => {
            let relative_paths: Vec<String> = captures
                .iter()
                .map(|c| c.relative_path.clone())
                .collect();
            let paths_string = captures
                .iter()
                .map(|c| {
                    if c.relative_path.contains(' ') {
                        format!("\"{}\"", c.relative_path)
                    } else {
                        c.relative_path.clone()
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");

            Ok(Json(BatchUploadResponse {
                success: true,
                count: captures.len(),
                files: captures,
                relative_paths,
                paths_string,
            }))
        }
        Err(e) => Err((StatusCode::BAD_REQUEST, e)),
    }
}

async fn get_captures_info(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<CapturesInfo>, StatusCode> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let (count, size_bytes) = state.manager.get_captures_info();
    let size_formatted = if size_bytes < 1024 * 1024 {
        format!("{:.1} KB", size_bytes as f64 / 1024.0)
    } else {
        format!("{:.1} MB", size_bytes as f64 / (1024.0 * 1024.0))
    };

    Ok(Json(CapturesInfo {
        count,
        size_bytes,
        size_formatted,
    }))
}

async fn clear_captures(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let deleted = state.manager.clear_captures().unwrap_or(0);
    Ok(Json(serde_json::json!({ "deleted": deleted })))
}

async fn open_captures_folder(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    state
        .manager
        .open_captures_in_explorer()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "opened": true })))
}

async fn list_workspaces(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Workspace>>, StatusCode> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(Json(state.manager.list_workspaces()))
}

async fn create_workspace(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Json(payload): Json<CreateWorkspacePayload>,
) -> Result<Json<Workspace>, (StatusCode, String)> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".into()));
    }
    let name = payload.name.trim();
    if name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Workspace name cannot be empty".into()));
    }

    let mut path = payload.path;
    let mut branch = payload.branch;
    let mut is_worktree = None;

    if payload.create_worktree == Some(true) {
        let default_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        let base_path = path
            .as_ref()
            .map(std::path::PathBuf::from)
            .unwrap_or(default_dir);

        let branch_name = branch.as_deref().unwrap_or(name);
        match crate::git::create_git_worktree(&base_path, branch_name) {
            Ok(worktree_dir) => {
                path = Some(worktree_dir.to_string_lossy().to_string());
                branch = Some(branch_name.to_string());
                is_worktree = Some(true);
            }
            Err(err) => {
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to create git worktree: {}", err),
                ));
            }
        }
    }

    let ws = state.manager.add_workspace(
        name.to_string(),
        path,
        payload.kind,
        branch,
        is_worktree,
    );
    Ok(Json(ws))
}

async fn delete_workspace(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> StatusCode {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return StatusCode::UNAUTHORIZED;
    }
    if state.manager.remove_workspace(&id) {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

async fn rename_workspace(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<RenameWorkspacePayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".into()));
    }
    if state.manager.rename_workspace(&id, &payload.name) {
        Ok(StatusCode::OK)
    } else {
        Err((StatusCode::NOT_FOUND, "Workspace not found".into()))
    }
}

async fn get_git_status_handler(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<crate::git::GitStatusResponse>, StatusCode> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let default_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let target_dir = params
        .get("path")
        .map(std::path::PathBuf::from)
        .unwrap_or(default_dir);

    Ok(Json(crate::git::get_git_status(&target_dir)))
}

async fn get_git_diff_handler(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<GitDiffResponse>, (StatusCode, String)> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".into()));
    }
    let default_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let target_dir = params
        .get("path")
        .map(std::path::PathBuf::from)
        .unwrap_or(default_dir);
    let file = params.get("file").map(|s| s.as_str());

    match crate::git::get_git_diff(&target_dir, file) {
        Ok(diff) => Ok(Json(GitDiffResponse { diff })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

async fn get_git_branches_handler(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<Vec<String>>, StatusCode> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let default_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let target_dir = params
        .get("path")
        .map(std::path::PathBuf::from)
        .unwrap_or(default_dir);

    match crate::git::get_git_branches(&target_dir) {
        Ok(branches) => Ok(Json(branches)),
        Err(_) => Ok(Json(vec![])),
    }
}

async fn get_listening_ports_handler(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<Vec<crate::ports::DetectedPort>>, StatusCode> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let pids = if let Some(ws_id) = params.get("workspace_id") {
        state.manager.get_workspace_session_pids(ws_id)
    } else {
        vec![]
    };

    let ports = crate::ports::scan_listening_ports(&pids);
    Ok(Json(ports))
}

async fn open_url_handler(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Json(payload): Json<OpenUrlPayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".into()));
    }
    match crate::ports::open_browser_url(&payload.url) {
        Ok(_) => Ok(StatusCode::OK),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

async fn ws_terminal_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Response {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return (StatusCode::UNAUTHORIZED, "Unauthorized: missing or invalid token").into_response();
    }

    let session = state.manager.get_session(&id);
    match session {
        Some(s) => ws.on_upgrade(move |socket| handle_terminal_socket(socket, s, state.manager)),
        None => (StatusCode::NOT_FOUND, "Session not found").into_response(),
    }
}

#[derive(Deserialize)]
#[serde(tag = "type")]
enum WsClientMessage {
    #[serde(rename = "input")]
    Input { data: String },
    #[serde(rename = "resize")]
    Resize { rows: u16, cols: u16 },
}

async fn handle_terminal_socket(
    socket: WebSocket,
    session: Arc<crate::session::Session>,
    manager: Arc<SessionManager>,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // 1. Send scrollback history to client
    let initial_hist = {
        let mut guard = session.history.lock();
        if !guard.is_empty() {
            Some(guard.make_contiguous().to_vec())
        } else {
            None
        }
    };

    if let Some(hist) = initial_hist {
        let _ = ws_sender.send(Message::Binary(hist)).await;
    }

    // 2. Subscribe to PTY output stream
    let mut pty_rx = session.output_tx.subscribe();
    let session_id = session.id.clone();
    let session_id_clone = session_id.clone();

    // Task to forward PTY output -> WebSocket (with 25s heartbeat ping)
    let mut send_task = tokio::spawn(async move {
        let mut ping_interval = tokio::time::interval(tokio::time::Duration::from_secs(25));
        // First tick completes immediately, skip it so we don't send a ping right at connection start
        ping_interval.tick().await;

        loop {
            tokio::select! {
                res = pty_rx.recv() => {
                    match res {
                        Ok(data) => {
                            if ws_sender.send(Message::Binary(data)).await.is_err() {
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(missed)) => {
                            tracing::warn!("Terminal WS stream lagged by {} messages", missed);
                            continue;
                        }
                        Err(broadcast::error::RecvError::Closed) => break,
                    }
                }
                _ = ping_interval.tick() => {
                    if ws_sender.send(Message::Ping(vec![])).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    // Task to forward WebSocket messages -> PTY input / resize
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(cmd) = serde_json::from_str::<WsClientMessage>(&text) {
                        match cmd {
                            WsClientMessage::Input { data } => {
                                let _ = manager.write_input(&session_id_clone, data.as_bytes());
                            }
                            WsClientMessage::Resize { rows, cols } => {
                                let _ = manager.resize_session(&session_id_clone, rows, cols);
                            }
                        }
                    } else {
                        let _ = manager.write_input(&session_id_clone, text.as_bytes());
                    }
                }
                Message::Binary(bin) => {
                    let _ = manager.write_input(&session_id_clone, &bin);
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };
    info!("WebSocket disconnected for session: {}", session_id);
}

async fn set_clipboard_handler(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    Json(payload): Json<SetClipboardPayload>,
) -> impl IntoResponse {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ClipboardResponse {
                success: false,
                text: None,
            }),
        )
            .into_response();
    }
    match crate::clipboard::set_clipboard(&payload.text) {
        Ok(_) => (
            StatusCode::OK,
            Json(ClipboardResponse {
                success: true,
                text: Some(payload.text),
            }),
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ClipboardResponse {
                success: false,
                text: Some(err),
            }),
        )
            .into_response(),
    }
}

async fn get_clipboard_handler(
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    if !is_authorized(&headers, params.get("token").map(|s| s.as_str()), &state) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ClipboardResponse {
                success: false,
                text: None,
            }),
        )
            .into_response();
    }
    match crate::clipboard::get_clipboard() {
        Ok(text) => (
            StatusCode::OK,
            Json(ClipboardResponse {
                success: true,
                text: Some(text),
            }),
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ClipboardResponse {
                success: false,
                text: Some(err),
            }),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    #[test]
    fn test_score_ip_prioritizes_wifi_over_vpn() {
        let wifi_name = "Беспроводная сеть";
        let wifi_ip = Ipv4Addr::new(192, 168, 4, 39);

        let xray_name = "happ-xray";
        let xray_ip = Ipv4Addr::new(172, 19, 0, 1);

        let wifi_score = score_ip(wifi_name, &wifi_ip);
        let xray_score = score_ip(xray_name, &xray_ip);

        assert!(wifi_score > xray_score, "WiFi score ({}) should be higher than VPN/Xray ({})", wifi_score, xray_score);
    }

    #[test]
    fn test_get_network_interfaces_finds_best_ip() {
        let (best_ip, interfaces) = get_network_interfaces();
        println!("Best IP: {}", best_ip);
        for iface in &interfaces {
            println!("Interface: {} -> {}", iface.name, iface.ip);
        }
        assert!(!best_ip.is_empty());
        assert_ne!(best_ip, "127.0.0.1");
    }

    #[tokio::test]
    async fn test_static_file_handler_blocks_path_traversal() {
        use axum::http::Uri;

        let uri: Uri = "/../Cargo.toml".parse().unwrap();
        let res = static_file_handler(uri).await.into_response();
        assert_eq!(res.status(), StatusCode::FORBIDDEN);

        let uri: Uri = "/C:/Windows/win.ini".parse().unwrap();
        let res = static_file_handler(uri).await.into_response();
        assert_eq!(res.status(), StatusCode::FORBIDDEN);
    }
}
