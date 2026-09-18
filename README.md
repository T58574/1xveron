# Veron ⚡

<p align="center">
  <img src="public/veron-icon.svg" alt="Veron Logo" width="96" height="96">
</p>

<p align="center">
  <strong>Ultra-fast, zero-latency desktop terminal multiplexer and AI orchestrator for Windows.</strong><br>
  Built in Rust (Tao + Wry + ConPTY) with an Apple-grade industrial aesthetic, zero AI-slop, and zero telemetry.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows_x64-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Rust-2021_Edition-orange?style=flat-square&logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/Frontend-React_18_%2B_Vite_5-61dafb?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Styles-Tailwind_CSS-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-emerald?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="README.md"><b>English</b></a> • <a href="README.ru.md"><b>Русский</b></a>
</p>

---

<p align="center">
  <img src="docs/screenshots/veron_cybran_3panes.png" alt="Veron 3-Pane Layout in Cybran Amber Theme" width="880">
</p>

---

## ⚡ Why Veron?

Modern terminal multiplexers are either bloated, cloud-dependent, or tied to heavyweight frameworks that consume hundreds of megabytes of memory. 

**Veron** delivers a lightweight, standalone Windows terminal experience tailored specifically for high-velocity pair programming with AI agents (such as Google Antigravity, Claude Code, and Codex CLI) and everyday multi-process engineering:

- **Single Portable Binary (~3.7 MB)**: All web assets (HTML, CSS, JS, XTerm, vector fonts) are baked directly into `veron.exe` via `rust-embed`. Zero external installers, zero runtimes, zero config.
- **Pure ConPTY Performance**: Direct integration with Windows Pseudo-Terminals (`portable-pty`) for PowerShell, CMD, Git Bash, and WSL with near-zero latency.
- **Zero Zombie Processes Guarantee**: Deep recursive process tree termination (`taskkill /PID <pid> /T /F`) cleans up all spawned servers (`node`, `vite`, `python`, `cargo`) instantly when a pane or the app closes.
- **Resilient 512 KB History Ring Buffer**: Terminal scrollback is stored in an $O(1)$ memory ring buffer (`VecDeque<u8>`). Never lose terminal logs on window resize, tab switch, or remote reconnections.
- **14 Built-In Designer Themes**: From the signature *Cybran Amber* (obsidian & amber gold) to *Emerald Matrix*, *Cobalt Cyan*, *Monokai Neon*, and clean light paper themes, plus live HEX / picker color customization.

---

## 🌟 Key Features

### 1. Dynamic Grid Engine (1 to 6 Panes) with Slot Persistence
- **Segmented Layout Selector (1–6)**:
  - `1`: Fullscreen focused terminal.
  - `2`: 50/50 dual column split.
  - `3`: 1 primary left pane + 2 stacked right panes (BridgeMind style).
  - `4`: Classic 2×2 quad grid.
  - `5`: 2 panes top + 3 panes bottom.
  - `6`: 2×3 multi-tasking powerhouse (6 concurrent shells).
- **Slot Persistence**: Closing or modifying one window never shifts or bounces adjacent terminals.
- **Instant Split (`Ctrl+Shift+T` / `Ctrl+Shift+D`)**: Spawns a new shell and expands the grid without touching the mouse.
- **Double-Click Session Rename**: Double-click any header title to label sessions (`Vite Dev`, `Docker DB`, `AI Agent`).

<p align="center">
  <img src="docs/screenshots/veron_cybran_desktop_active.png" alt="Veron Grid with Active Sessions" width="880">
</p>

### 2. Interactive Zero-Lag Splitters & Window Drag-and-Drop
- **Dynamic Resize Splitters**: Smooth horizontal and vertical splitters across all 2–6 pane layouts.
- **Zero-Lag Absolute Coordinate Tracking**: Direct geometry-based pointer tracking eliminates magnetic snapping and lag.
- **Hover-Reveal Grab Handles**: Clean borderlines that reveal amber grab handles on hover. Double-click resets ratios (50/50, 33/33/33).
- **Window Drag-and-Drop Reordering**: Grab any pane header to drag it into another slot. A floating translucent card preview guides the drop, swapping windows without interrupting active processes.

### 3. Comprehensive Theme Engine & Live Color Tuning
- **14 Hand-Crafted Presets**:
  - **10 Industrial Dark Themes**: *Cybran Amber* (classic obsidian & amber), *Emerald Matrix*, *Cobalt Cyan*, *Amethyst Synth*, *Crimson Void*, *Solar Gold*, *Velvet Rose*, *Nordic Frost*, *Monokai Neon*, *Titanium Slate*.
  - **4 Light Paper Themes**: *Paper Amber*, *Paper Cobalt*, *Paper Emerald*, *Paper Minimal*.
- **Live Color Calibration**: Choose custom accent colors via the native HTML5 Color Picker or manual `#HEX` input with instant real-time contrast calculations.
- **Zero Terminal Interruption**: Theme changes instantly apply to `@xterm/xterm` without resetting the shell or dropping the connection.

### 4. Workspaces & Antigravity (AGY) AI Pairing
- **Multi-Workspace Isolation**: Group up to 6 terminal sessions into isolated workspaces with dedicated layouts, working directories, and shells.
- **One-Click Antigravity AI Launch**: Create an Antigravity workspace to automatically launch `agy` with custom vector branding.
- **"Needs Input" Agent Detector**: Automatically detects when an AI agent is waiting for prompt confirmation and highlights the pane with a pulsing amber badge.
- **Empty AGY Slot Quick-Launch**: Unused slots in an AGY workspace display a dedicated launcher button to spin up a new agent session.

### 5. Git Worktree Isolation & Live Diff Inspector
- **Isolated Worktrees**: Create workspaces backed by a dedicated Git Worktree (`.veron/worktrees/<branch>`). Experiment or let AI agents test refactors without touching your working tree.
- **Live Git Diff Pill**: Displays active branch and lines changed (`[ main +42 -12]`) directly in the TopBar.
- **Built-In Syntax Diff Modal**: Click the diff pill to view unified diffs, modified files, and inspect newly created untracked files.

### 6. Win32 Port Scanner & 1-Click Dev Server Launch
- **Zero-Subprocess Network Scanner**: Direct Win32 `GetExtendedTcpTable` query maps open TCP ports to child processes in 11ms with zero CPU overhead.
- **Live Port Indicator**: When a dev server (Vite, Next.js, Python, Cargo) starts, a pulsing indicator (`● :5173 ↗`) appears in the header.
- **Safe Browser Launch**: One-click opening using Win32 `ShellExecuteW` without spawning cmd.exe subshells.

### 7. 4-Tier Windows Clipboard Engine & Screenshot Pipeline
- **Seamless Paste Across All Layouts (`Ctrl+V` / `Win+V`)**: Synchronous transient user gesture handler supports English, Russian, and international IME layouts.
- **Copy-on-Select & Enter-to-Copy**: Highlight text in the terminal to copy it silently; press Enter on a selection to copy and clear.
- **Instant Screenshot Pipeline**: Press `Ctrl+V` or drag-and-drop images into the terminal to automatically save screenshots into `.veron/captures/` and paste relative paths into the active shell.
- **AGY Mode**: In AI agent workspaces, clipboard images attach cleanly as native media attachments without cluttering the prompt input.

### 8. Mobile Couch Mode (Wi-Fi LAN)
- **Local Network Access**: Connect from your smartphone or tablet via `http://<LAN-IP>:4567?token=...`.
- **QR Code & PIN Security**: Quick authorization via the built-in QR modal.
- **Touch-Optimized Developer Bar**: Fullscreen single-pane terminal with virtual buttons for `[ESC]`, `[TAB]`, `[CTRL+C]`, `[CTRL+Z]`, arrow keys `[▲] [▼] [◀] [▶]`, and viewport auto-fit.

<p align="center">
  <img src="docs/screenshots/veron_qr_modal.png" alt="Veron Phone Remote QR Modal" width="420">&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="docs/screenshots/veron_mobile_couch_mode.png" alt="Veron Mobile Couch Mode" width="420">
</p>

### 9. Command Palette (`Ctrl+K` / `⌘K`)
- **Built-In Presets**:
  - **System**: Port cleanup, CPU top processes, network diagnostics.
  - **Git**: `git status -s`, `git pull`, visual graph log, stat diffs.
  - **Dev**: Build shortcuts, test runners, capture folder cleanup.
- **Custom Commands**: Save custom scripts to `localStorage` with optional instant execution.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| `Alt + 1` … `Alt + 6` | Switch focus directly to terminal slot 1 through 6 |
| `Alt + M` | Toggle maximize active pane (fullscreen / restore grid) |
| `Alt + W` | Close the active terminal session |
| `Ctrl + Shift + T` / `Ctrl + Shift + D` | Quick split: spawn a new terminal and expand grid |
| `Ctrl + K` | Open Quick Scripts & Command Palette |
| `Ctrl + C` | Smart copy if text is selected; sends `SIGINT` if nothing is selected |
| `Ctrl + V` | Universal clipboard paste (supports text, images, and `Win+V` history) |
| `Ctrl + Enter` / `Shift + Enter` | Multiline newline (`\n`) for AI prompt inputs (no premature execution) |
| `Escape` | Dismiss open dialogs and modals (Settings, Diff, Scripts, Remote) |

---

## 🚀 Quick Start
 
### Option 1: Run Standalone Executable (1-Click)
Simply launch `veron.exe`:
```powershell
.\veron.exe
```
*(Or compile from source following the guide below)*

### Option 2: Run in Headless / Remote Server Mode
Run Veron as a background server accessible from browsers or smartphones:
```powershell
.\veron.exe --server-only --port 4567 --token mysecrettoken
```

#### Available CLI Arguments
| Flag | Description | Default |
| :--- | :--- | :--- |
| `-p`, `--port <PORT>` | HTTP & WebSocket listen port | `4567` |
| `-t`, `--token <TOKEN>` | Authorization token (or set `VERON_TOKEN`) | Generated 8-char token |
| `--server-only`, `--headless`, `-d` | Run backend server without opening GUI window | `false` |
| `-h`, `--help` | Show CLI help message | — |

---

## 🛠️ Building from Source

### Prerequisites
- **OS**: Windows 10/11 (64-bit)
- **Rust**: 1.80+ (`rustup default stable`)
- **Node.js**: 20+ and `npm`

### Step-by-Step Build
```powershell
# 1. Clone the repository
git clone https://github.com/T58574/1xveron.git
cd 1xveron

# 2. Install frontend dependencies
npm install

# 3. Build frontend assets (into dist/)
npm run build

# 4. Compile optimized release binary (embeds frontend assets)
cargo build --release --manifest-path src-tauri/Cargo.toml

# 5. Run Veron
.\src-tauri\target\release\veron.exe
```

---

## 🏗️ Architecture & Tech Stack

```
veron/
├── public/                 # Static web assets (veron-icon.svg)
├── docs/screenshots/       # UI showcase media
├── src/                    # React 18 Frontend
│   ├── App.tsx             # Grid layout coordinator & split engine
│   ├── components/         # TerminalPane, Sidebar, TopBar, PaneSplitter, Modals
│   └── services/           # REST API, WebSocket client, Theme engine
└── src-tauri/              # Rust Native Backend
    └── src/
        ├── main.rs         # Tao event loop & CLI flag parser
        ├── server.rs       # Axum HTTP/WS server & Token Guard
        ├── session.rs      # SessionManager & O(1) 512KB Ring Buffer
        ├── pty.rs          # Windows ConPTY wrapper & tree killer
        ├── ports.rs        # Win32 ExtendedTcpTable port scanner
        ├── git.rs          # Git Worktree & unified diff engine
        └── clipboard.rs    # Win32 native clipboard API
```

| Layer | Technologies |
| :--- | :--- |
| **Desktop Shell** | `tao 0.37` (Event Loop & Native Window) + `wry 0.57` (WebView2) |
| **Core Backend** | Rust 2021, `tokio 1.40`, `axum 0.7`, `tower-http 0.6` |
| **Terminal Core** | `portable-pty 0.8` (ConPTY), `VecDeque<u8>` History Ring Buffer |
| **Frontend Framework** | React 18, TypeScript 5.6, Vite 5, Tailwind CSS |
| **Terminal Emulator** | `@xterm/xterm 5.5`, `@xterm/addon-fit`, `@xterm/addon-webgl` |
| **Port Scanner** | Native Win32 API (`iphlpapi.dll` / `GetExtendedTcpTable`) |

---

## 🤝 Contributing

Contributions are welcome! Please check out [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and architectural invariants.

---

## 📄 License

Veron is distributed under the **[MIT License](LICENSE)**.
Created with passion for high-velocity software engineering.
