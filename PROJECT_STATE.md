# Veron — Current Project State 🧠

> **Living Architectural Memory & System Grounding for AI Agents**.  
> **Rule**: Keep this file under 120 lines. Do NOT write milestone changelog diaries here — use `git log` instead.

---

## 1. Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 NATIVE WINDOW (Tao + Wry WebView2)          │
│              React 18 + Tailwind CSS + xterm.js WebGL       │
└──────────────────────────────┬──────────────────────────────┘
                               │ (HTTP & WebSocket localhost:4567)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     RUST CORE (veron.exe)                   │
│                                                             │
│ • Axum Server (src/server.rs : 4567): Token Auth, REST, WS  │
│ • SessionManager (src/session.rs): ConPTY sessions & ring   │
│ • Process Termination: taskkill /PID <pid> /T /F (0 zombies)│
│ • Audio: Procedure Web Audio Synthesizer (sound.ts)         │
│ • ExtendedTcpTable (src/ports.rs): Win32 native port scanner│
│ • Clipboard (src/clipboard.rs): Win32 CF_UNICODETEXT API    │
│ • Assets: Embedded dist/ via rust-embed (fallback to disk)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Active REST & WebSocket Endpoints

All endpoints require Bearer auth (`?token=...` or `Authorization: Bearer <token>`):

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/system` | System info (LAN IP, shells, token status, port) |
| `GET`/`POST`/`DELETE` | `/api/sessions` | CRUD ConPTY terminal sessions |
| `POST` | `/api/sessions/:id/input` | Send keystrokes / input to terminal stdin |
| `POST` | `/api/sessions/:id/resize` | Resize ConPTY buffer geometry (`rows`, `cols`) |
| `GET` | `/api/sessions/:id/export` | Stream / download session history (`.log`/`.txt`, ANSI stripped) |
| `GET` | `/ws/terminal/:id` | Terminal bi-directional streaming (replays 512KB ring buffer) |
| `POST` | `/api/upload` / `/upload/batch` | Save base64 image captures to `.veron/captures/` |
| `GET`/`DELETE` | `/api/captures` | Get captures count/size or delete all captures |
| `POST` | `/api/captures/cleanup` | Prune captures (`older_than_days`, `max_total_mb`) |
| `POST` | `/api/captures/open` | Reveal captures in Windows Explorer via `ShellExecuteW` |
| `GET`/`POST`/`DELETE` | `/api/workspaces` | Workspace group management & persistence |
| `GET` | `/api/git/status` / `diff` | Batched git status & untracked unified diff |
| `GET`/`POST` | `/api/clipboard` | Win32 native clipboard read/write gateway |
| `GET` | `/api/ports` | Active listening TCP ports mapped to terminal PIDs |

---

## 3. Strict Operating Invariants for AI Agents

1. **PowerShell Semicolon Invariant**: Never use `&&` in Windows PowerShell. Use `;` strictly (`npm run build; cargo test`).
2. **Safe Binary Update (Zero Kill Invariant)**: Never `taskkill veron.exe` during dev! Axum hot-serves `./dist` on disk (`npm run build` + `F5`). To update the `.exe`, use NTFS rename:  
   `Move-Item veron.exe veron.old.exe -Force; Copy-Item src-tauri\target\release\veron.exe .\veron.exe -Force`.
3. **Recursive Process Teardown**: Closing sessions or window MUST call `PtyInstance::kill()` (`taskkill /PID <pid> /T /F`). Zero zombie node/python processes.
4. **Tokio Context Invariant**: `SessionManager::create_session` must be called within an active Tokio reactor context.
5. **No `ArtifactMetadata`**: When calling `write_to_file` on project files, never include `ArtifactMetadata`.
6. **Zero-Guesswork Screenshot Paths**: Always copy normalized absolute paths (`C:/Users/.../screenshot.png` with `/`) to clipboard so external agents don't waste 4+ search tool calls.
7. **Mandatory Git Commit**: Always commit verified fixes (`npm run build`, `cargo test`) before reporting back.
8. **Anti-Bloat Documentation (< 120 Lines)**: Keep docs lean. No changelog blogs here. Use `git log --oneline` for history.

---

## 4. Active Roadmap (Next Tasks)

1. **Session Workspace Search & Filter**: Quick filter session list in sidebar by name / cwd.
2. **Custom Shortcut Rebinding**: Interactive hotkey configuration modal.
