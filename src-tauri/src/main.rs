mod pty;
mod server;
mod session;

use local_ip_address::local_ip;
use server::{create_router, AppState};
use session::SessionManager;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "veron_server=info,tower_http=debug,axum=trace".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(4567);

    let session_manager = Arc::new(SessionManager::new());

    // Create an initial default session (PowerShell on Windows)
    let initial_cwd = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "C:\\".to_string());

    let _ = session_manager.create_session(
        None,
        Some(initial_cwd),
        Some("PowerShell 1".into()),
        Some("default".into()),
        24,
        80,
    );

    let auth_token = uuid::Uuid::new_v4().to_string()[..8].to_uppercase();

    let state = AppState {
        manager: session_manager,
        port,
        auth_token: auth_token.clone(),
    };

    let router = create_router(state);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    let ip = local_ip()
        .map(|i| i.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    println!("\n╔═══════════════════════════════════════════════════════════╗");
    println!("║                   VERON TERMINAL SERVER                   ║");
    println!("╠═══════════════════════════════════════════════════════════╣");
    println!("║  Local Desktop : http://localhost:{}                   ║", port);
    println!("║  Auth PIN/Token: {:<40} ║", auth_token);
    println!("║  Mobile Wi-Fi  : http://{}:{}?token={} ║", ip, port, auth_token);
    println!("║  ConPTY Engine : Windows Native Active                    ║");
    println!("╚═══════════════════════════════════════════════════════════╝\n");

    axum::serve(listener, router).await?;

    Ok(())
}
