#![windows_subsystem = "windows"]

mod pty;
mod server;
mod session;

use local_ip_address::local_ip;
use server::{create_router, AppState};
use session::SessionManager;
use std::net::SocketAddr;
use std::sync::Arc;
use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    window::WindowBuilder,
};
use wry::WebViewBuilder;

#[cfg(windows)]
extern "system" {
    fn AttachConsole(dwProcessId: u32) -> i32;
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let server_only = args.iter().any(|arg| arg == "--server-only" || arg == "--headless");

    #[cfg(windows)]
    if server_only {
        unsafe {
            AttachConsole(0xFFFFFFFF); // ATTACH_PARENT_PROCESS
        }
    }

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(4567);

    let auth_token = uuid::Uuid::new_v4().to_string()[..8].to_uppercase();
    let auth_token_clone = auth_token.clone();

    // Create session manager on main thread to ensure clean lifecycle management
    let session_manager = Arc::new(SessionManager::new());
    let session_manager_for_server = session_manager.clone();
    let session_manager_for_events = session_manager.clone();
    let session_manager_for_sig = session_manager.clone();

    // Start background Tokio runtime for ConPTY engine and Axum server
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async move {
            let initial_cwd = std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| "C:\\".to_string());

            let _ = session_manager_for_server.create_session(
                None,
                Some(initial_cwd),
                Some("PowerShell 1".into()),
                Some("default".into()),
                None,
                24,
                80,
            );

            let state = AppState {
                manager: session_manager_for_server,
                port,
                auth_token: auth_token_clone,
            };

            let router = create_router(state);
            let addr = SocketAddr::from(([0, 0, 0, 0], port));
            if let Ok(listener) = tokio::net::TcpListener::bind(addr).await {
                let _ = axum::serve(listener, router).await;
            }
        });
    });

    let ip = local_ip()
        .map(|i| i.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    println!("\n╔═══════════════════════════════════════════════════════════╗");
    println!("║                   VERON NATIVE DESKTOP                    ║");
    println!("╠═══════════════════════════════════════════════════════════╣");
    println!("║  Desktop Window: Windows Native Active (WebView2)         ║");
    println!("║  Auth PIN/Token: {:<40} ║", auth_token);
    println!("║  Mobile Wi-Fi  : http://{}:{}?token={} ║", ip, port, auth_token);
    println!("║  ConPTY Engine : Windows Native Active                    ║");
    println!("╚═══════════════════════════════════════════════════════════╝\n");

    std::thread::sleep(std::time::Duration::from_millis(200));

    if server_only {
        println!("Running in server-only / headless mode. Press Ctrl+C to exit.");
        let rt_sig = tokio::runtime::Runtime::new().expect("Failed to create signal runtime");
        rt_sig.block_on(async move {
            tokio::signal::ctrl_c().await.ok();
            println!("\n[Shutdown] Terminating all session process trees...");
            session_manager_for_sig.close_all();
            println!("[Shutdown] Clean exit complete.");
            std::process::exit(0);
        });
        return Ok(());
    }

    // Launch Native Windows Desktop Window
    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title("Veron")
        .with_inner_size(LogicalSize::new(1366.0, 820.0))
        .with_min_inner_size(LogicalSize::new(800.0, 600.0))
        .build(&event_loop)?;

    let app_url = format!("http://localhost:{}?token={}", port, auth_token);
    let _webview = WebViewBuilder::new()
        .with_url(&app_url)
        .build(&window)?;

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        if let Event::WindowEvent {
            event: WindowEvent::CloseRequested,
            ..
        } = event
        {
            println!("\n[Shutdown] Window closed: terminating all terminal process trees...");
            session_manager_for_events.close_all();
            println!("[Shutdown] All processes closed cleanly.");
            *control_flow = ControlFlow::Exit;
        }
    });
}
