# GEMINI.md — Veron Agent Onboarding & System Grounding

> **Target Audience:** Future AI Agents (Antigravity, Gemini, Claude, Cursor) & Lead Engineers.  
> **Repository:** `C:\Users\user\Documents\dev\veron`  
> **Version:** 0.1.0-alpha (Milestone 6: Cybran Amber & ConPTY Teardown)  
> **Last Verified:** 2026-09-09

---

## 1. Executive Summary & Vision

**VERON** is a lightweight, zero-latency terminal workspace, AI orchestrator, and remote development dashboard designed specifically for high-velocity pair programming with AI agents.

### Core Strengths
1. **Single-Binary Standalone (`veron.exe`, ~3.7 MB)**: Embedded frontend assets via `rust-embed 8.12`. Zero installers, zero external runtime dependencies.
2. **Dual-Mode Operation**:
   - **Native Desktop App**: Runs as a lightweight Tao + WebView2 window with hardware-accelerated rendering.
   - **Headless / Remote Web Server**: Can run as a standalone Axum server accessible from LAN/phone (`http://<LAN-IP>:4567?token=...`).
3. **Cybran Amber UI**: Strict industrial aesthetic inspired by *Supreme Commander: Cybran Nation* (Obsidian `#090a0d`, Amber `#f59e0b`, Slate `#14171f`). Zero AI-slop, no flashing disco badges.
4. **Clean ConPTY Process Teardown**: Deep recursive process tree termination (`taskkill /PID <pid> /T /F`) to eliminate orphan/zombie development servers (`node`, `vite`, `python`, `cargo`).
5. **Session History Persistence**: In-memory ring buffer (512 KB per session) preserves terminal history across tab switches, page refreshes, and remote reconnections.
6. **Agent Quick Scripts & File Integrations**: Clipboard image capture, one-click open in Windows Explorer / default editor via `/api/captures/open`.

---

## 2. Technical Stack

| Tier | Technologies |
| :--- | :--- |
| **Backend / Core** | Rust 2021, Tokio 1.43, Axum 0.8, Tower-HTTP 0.6 |
| **Terminal Subsystem** | `portable-pty 0.8` (Windows ConPTY / Unix pseudo-terminals) |
| **Desktop Shell** | `tao 0.31` (Event loop & native window), `wry 0.47` (WebView2 engine) |
| **Asset Embedding** | `rust-embed 8.12` (Bakes `dist/` into binary at compile time) |
| **Frontend** | React 19, TypeScript 5.7, Vite 6.0, Tailwind CSS 4 |
| **Terminal Emulator** | `@xterm/xterm 5.5`, `@xterm/addon-fit 0.10`, `@xterm/addon-webgl 0.16` |
| **UI Components** | Lucide React, Custom Glassmorphism Canvas |

---

## 3. Strict Architectural Invariants & Gotchas (READ BEFORE CODING)

### ⚠️ Invariant 1: PowerShell Command Chaining (Windows)
In Windows PowerShell, `&&` causes syntax errors in older environments or specific subshells.
**Always use semicolon `;` for chaining commands:**
```powershell
# CORRECT:
npm run build; cargo build --release --manifest-path src-tauri/Cargo.toml

# WRONG:
npm run build && cargo build --release
```

### ⚠️ Invariant 2: Tokio Reactor Requirement for Sessions
In `src-tauri/src/session.rs`, `SessionManager::create_session(...)` executes:
```rust
tokio::spawn(async move { ... }); // 512 KB history reader loop
```
**Rule:** `create_session` **MUST** be called within an active Tokio runtime context (either within an `async fn` called by Axum, or wrapped in `rt.block_on(...)` in main/desktop thread). Calling it outside a Tokio context panics with:
`there is no reactor running, must be called from the context of a Tokio 1.x runtime`.

### ⚠️ Invariant 3: Recursive Process Tree Teardown (Zombie Prevention)
On Windows, calling `child.kill()` on a ConPTY child only kills the immediate wrapper, leaving spawned processes (`node.exe`, `vite.exe`, `python.exe`) running in the background.
In `src-tauri/src/pty.rs`:
```rust
#[cfg(windows)]
Command::new("taskkill")
    .args(["/PID", &pid.to_string(), "/T", "/F"])
    .creation_flags(0x08000000) // CREATE_NO_WINDOW
    .spawn()
    .and_then(|mut c| c.wait())
```
All sessions are cleanly drained on window close (`WindowEvent::CloseRequested`) and on `Ctrl+C` via `session_manager.close_all()`.

### ⚠️ Invariant 4: Frontend Embed Flow
`rust-embed` captures the contents of `../dist` at compile time.
**Whenever frontend files (`src/`) are modified, you MUST run `npm run build` BEFORE compiling Rust:**
```powershell
npm run build
cargo build --release --manifest-path src-tauri/Cargo.toml
Copy-Item src-tauri\target\release\veron.exe .\veron.exe -Force
```

### ⚠️ Invariant 5: File Creation Invariant (`write_to_file`)
When creating project files using the agent tool `write_to_file`, **NEVER** provide the `ArtifactMetadata` parameter. `ArtifactMetadata` is reserved exclusively for AI conversation artifacts in `.gemini/.../brain/`.

---

## 4. Design System & Palette (Cybran Nation)

VERON follows a strict high-contrast dark industrial design language:

```css
/* Core Canvas & Surfaces */
--bg-canvas:    #090a0d; /* Pure obsidian base */
--bg-surface:   #11141a; /* Card / Panel surface */
--bg-elevated:  #181c24; /* Hover / Input backgrounds */
--border-subtle:#222834; /* Hairline borders */

/* Cybran Amber Accent Scale */
--amber-dim:    #78350f; /* Subtle amber border */
--amber-base:   #f59e0b; /* Primary brand accent */
--amber-bright: #fbbf24; /* Hover highlight */
--amber-glow:   rgba(245, 158, 11, 0.12); /* Ambient aura */

/* Status & Feedback */
--status-green: #10b981; /* Process active */
--status-red:   #ef4444; /* Process terminated */
--text-primary: #f8fafc; /* Crisp white-slate */
--text-muted:   #94a3b8; /* Cool slate secondary */
```

**Anti-Patterns:**
- ❌ No neon purple, cyan, or rainbow gradients.
- ❌ No pulsating radar animations or distracting animated glowing dots.
- ❌ No marketing fluff in the terminal UI header (version badges, decorative icons). Keep it clean, minimal, Apple/Linear level.

---

## 5. API & WebSocket Specification

All endpoints require authentication via Bearer token:
`Authorization: Bearer <auth_token>` or `?token=<auth_token>` query param for WebSocket.

### Endpoints
| Method | Path | Payload | Response / Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/status` | — | `{ "status": "ok", "version": "0.1.0", "sessions_count": 2 }` |
| `GET` | `/api/sessions` | — | Array of `SessionInfo` (`id`, `name`, `shell`, `cols`, `rows`, `created_at`, `status`) |
| `POST` | `/api/sessions` | `{"name": "...", "shell": "powershell.exe", "cols": 120, "rows": 30}` | Created `SessionInfo` |
| `DELETE` | `/api/sessions/:id` | — | `{ "success": true }` (terminates process tree) |
| `PATCH` | `/api/sessions/:id` | `{"name": "New Name"}` | Updated `SessionInfo` |
| `POST` | `/api/sessions/:id/input` | `{"data": "ls\r"}` | Injects input into PTY stdin |
| `POST` | `/api/sessions/:id/resize` | `{"cols": 140, "rows": 40}` | Resizes ConPTY buffer |
| `GET` | `/api/sessions/:id/ws` | Query: `?token=<token>` | **WebSocket**: Binary/Text stream. Replays 512 KB history on connect. |
| `POST` | `/api/captures/open` | `{"path": "..."}` or `{"url": "..."}` | Opens file in Explorer/Editor via native OS shell |

---

## 6. Project Layout

```
veron/
├── GEMINI.md                  # <-- You are here (Core agent onboarding guide)
├── README.md                  # User-facing manual, feature list, and quickstart
├── PROJECT_STATE.md           # Architecture status, test matrix, and changelog
├── veron.exe                  # Standalone portable binary (Release build, 3.7 MB)
├── package.json               # Frontend dependencies & scripts
├── vite.config.ts             # Vite build configuration
├── tailwind.config.js         # Tailwind styling tokens
├── src/                       # React 19 Frontend
│   ├── App.tsx                # Main container, layout orchestrator, split panels
│   ├── main.tsx               # Application root
│   ├── components/
│   │   ├── TerminalView.tsx   # xterm.js instance with WebGL + FitAddon & history
│   │   ├── SessionSidebar.tsx # Session list, status indicators, process controls
│   │   ├── QuickScripts.tsx   # Quick clipboard screenshot capture & script trigger
│   │   └── Header.tsx         # Brand header, auth token display, new session modal
│   └── lib/
│       └── api.ts             # REST & WebSocket client with auth injection
├── src-tauri/                 # Rust Core & Desktop Engine
│   ├── Cargo.toml             # Rust dependencies (Axum, Tokio, Tao, Wry, rust-embed)
│   └── src/
│       ├── main.rs            # Desktop Tao event loop + Axum server runner
│       ├── server.rs          # Axum routes, WebSocket broker, static asset fallback
│       ├── session.rs         # SessionManager, history ring buffer, process state
│       └── pty.rs             # ConPTY abstraction & Windows tree termination
```

---

## 7. Common Development Tasks

### Running in Development Mode
1. **Start Vite Dev Server:**
   ```powershell
   npm run dev
   ```
2. **Start Backend in Debug Mode:**
   ```powershell
   cargo run --manifest-path src-tauri/Cargo.toml
   ```

### Producing a Release Standalone Binary
```powershell
# 1. Compile frontend
npm run build

# 2. Build optimized release binary
cargo build --release --manifest-path src-tauri/Cargo.toml

# 3. Copy to project root
Copy-Item src-tauri\target\release\veron.exe .\veron.exe -Force
```

### Verification Checklist Before Finishing Tasks
1. Run `cargo check --manifest-path src-tauri/Cargo.toml` to ensure Rust builds cleanly.
2. Run `npm run build` to confirm zero TypeScript / Vite compilation errors.
3. Verify process tree cleanup logic: closing sessions or exiting the window should leave zero stray processes.
4. Keep commit messages clear, following Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`).
