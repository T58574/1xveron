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
use local_ip_address::local_ip;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
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

#[derive(Serialize)]
pub struct SystemInfo {
    pub local_ip: String,
    pub port: u16,
    pub lan_url: String,
    pub hostname: String,
    pub auth_token: String,
    pub available_shells: Vec<ShellOption>,
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
}

#[derive(Deserialize)]
pub struct RenameWorkspacePayload {
    pub name: String,
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
        .route("/ws/terminal/:id", get(ws_terminal_handler))
        .fallback(static_file_handler)
        .layer(cors)
        .with_state(state)
}

async fn static_file_handler(uri: axum::http::Uri) -> impl axum::response::IntoResponse {
    let raw_path = uri.path().trim_start_matches('/');
    let rel_path = if raw_path.is_empty() { "index.html" } else { raw_path };

    // 1. Try disk if dist/ exists
    let disk_paths = [
        std::path::PathBuf::from("./dist").join(rel_path),
        std::path::PathBuf::from("../dist").join(rel_path),
    ];
    for p in &disk_paths {
        if p.exists() && p.is_file() {
            if let Ok(data) = std::fs::read(p) {
                let mime = mime_guess::from_path(rel_path).first_or_octet_stream();
                return ([(axum::http::header::CONTENT_TYPE, mime.as_ref())], data).into_response();
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
            // 3. SPA fallback to index.html
            for p in &[std::path::PathBuf::from("./dist/index.html"), std::path::PathBuf::from("../dist/index.html")] {
                if p.exists() && p.is_file() {
                    if let Ok(data) = std::fs::read(p) {
                        return ([(axum::http::header::CONTENT_TYPE, "text/html")], data).into_response();
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

async fn get_system_info(State(state): State<AppState>) -> Json<SystemInfo> {
    let ip = local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    let lan_url = format!("http://{}:{}?token={}", ip, state.port, state.auth_token);
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

    Json(SystemInfo {
        local_ip: ip,
        port: state.port,
        lan_url,
        hostname,
        auth_token: state.auth_token,
        available_shells: shells,
    })
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
    match state.manager.save_image_and_paste(
        &payload.image,
        payload.filename.as_deref(),
        payload.session_id.as_deref(),
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
    let ws = state.manager.add_workspace(name.to_string(), payload.path, payload.kind);
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
        let guard = session.history.lock();
        if !guard.is_empty() {
            Some(guard.clone())
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

    // Task to forward PTY output -> WebSocket
    let mut send_task = tokio::spawn(async move {
        while let Ok(data) = pty_rx.recv().await {
            if ws_sender.send(Message::Binary(data)).await.is_err() {
                break;
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
