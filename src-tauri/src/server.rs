use crate::session::{SessionInfo, SessionManager, Workspace};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
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
use tower_http::services::ServeDir;
use tracing::info;

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
    pub session_id: Option<String>,
}

#[derive(Serialize)]
pub struct UploadResponse {
    pub success: bool,
    pub file_path: String,
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

    let dist_dir = if std::path::Path::new("./dist").exists() {
        std::path::PathBuf::from("./dist")
    } else if std::path::Path::new("../dist").exists() {
        std::path::PathBuf::from("../dist")
    } else {
        std::path::PathBuf::from("./dist")
    };

    Router::new()
        .route("/api/system", get(get_system_info))
        .route("/api/auth/verify", post(verify_token))
        .route("/api/sessions", get(list_sessions).post(create_session))
        .route("/api/sessions/:id", delete(close_session).patch(rename_session))
        .route("/api/sessions/:id/resize", post(resize_session))
        .route("/api/sessions/:id/input", post(send_session_input))
        .route("/api/upload", post(upload_screenshot))
        .route("/api/captures", get(get_captures_info).delete(clear_captures))
        .route("/api/captures/open", post(open_captures_folder))
        .route("/api/workspaces", get(list_workspaces))
        .route("/ws/terminal/:id", get(ws_terminal_handler))
        .fallback_service(ServeDir::new(dist_dir))
        .layer(cors)
        .with_state(state)
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
    match state.manager.save_image_and_paste(&payload.image, payload.session_id.as_deref()) {
        Ok(path) => Ok(Json(UploadResponse {
            success: true,
            file_path: path,
        })),
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
