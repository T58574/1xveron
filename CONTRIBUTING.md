# Contributing to Veron ⚡

Thank you for your interest in contributing to **Veron**! We welcome bug reports, feature suggestions, and pull requests.

## 🛠️ Prerequisites

- **OS**: Windows 10/11 (x64)
- **Rust**: 1.80+ (`rustup default stable`)
- **Node.js**: 20+ and `npm`
- **Git**

---

## 🚀 Development Setup

1. **Clone the repository:**
   ```powershell
   git clone https://github.com/T58574/1xveron.git
   cd 1xveron
   ```

2. **Install frontend dependencies:**
   ```powershell
   npm install
   ```

3. **Start in Development Mode:**
   - **Terminal 1** (Frontend with HMR):
     ```powershell
     npm run dev
     ```
   - **Terminal 2** (Rust Core Backend):
     ```powershell
     cargo run --manifest-path src-tauri/Cargo.toml
     ```

---

## ⚠️ Strict Architectural Invariants

When developing for Veron, you **MUST** respect the following rules:

1. **PowerShell Command Chaining**:
   Always use semicolon `;` for command chaining in PowerShell scripts or instructions. Never use `&&`.
   ```powershell
   # Correct:
   npm run build; cargo check --manifest-path src-tauri/Cargo.toml
   ```

2. **Frontend Assets Embedding**:
   `rust-embed` captures the `dist/` directory at compile time. Whenever you touch frontend files (`src/`), you **MUST** run `npm run build` **before** compiling the release binary.

3. **Clean Process Teardown (Zero Zombies)**:
   Do not use raw `child.kill()`. Windows ConPTY leaves spawned child processes (`node`, `vite`, `python`, `cargo`) orphaned unless terminated recursively via `taskkill /PID <pid> /T /F`. Always use the `SessionManager` and `PtyInstance::kill()` abstraction.

4. **Safe Binary Update During Development**:
   If you are running `veron.exe`, do not kill it abruptly while working. If you need to replace a running binary, use the Windows NTFS file rename trick:
   ```powershell
   Move-Item .\veron.exe .\veron.old.exe -Force; Copy-Item src-tauri\target\release\veron.exe .\veron.exe -Force
   ```

---

## 🧪 Verification Before Submitting a PR

Ensure all checks pass cleanly before opening a Pull Request:

```powershell
# 1. Typecheck and build frontend
npm run build

# 2. Run backend tests
cargo test --manifest-path src-tauri/Cargo.toml

# 3. Run Clippy linter
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

---

## 📜 Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New features or capabilities
- `fix:` Bug fixes
- `perf:` Performance optimizations
- `docs:` Documentation updates
- `refactor:` Code refactoring without behavior changes
- `chore:` Maintenance, dependency bumps, asset management
