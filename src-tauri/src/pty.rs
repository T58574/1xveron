use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use tokio::sync::broadcast;
use tracing::{info, warn};

pub struct PtyInstance {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
    pub running: Arc<AtomicBool>,
}

impl PtyInstance {
    pub fn spawn(
        shell_cmd: &str,
        cwd: Option<&str>,
        rows: u16,
        cols: u16,
        output_tx: broadcast::Sender<Vec<u8>>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows: rows.max(5),
            cols: cols.max(10),
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let mut cmd = CommandBuilder::new(shell_cmd);
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }

        // Clean startup for PowerShell
        if shell_cmd.contains("powershell") {
            cmd.args(["-NoLogo"]);
        }

        // Environment variables for modern UTF-8 support
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("PYTHONIOENCODING", "utf-8");

        let child = pair.slave.spawn_command(cmd)?;
        let writer = pair.master.take_writer()?;
        let mut reader = pair.master.try_clone_reader()?;

        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        // Background thread to read PTY output and broadcast to all connected clients
        thread::Builder::new()
            .name("pty-reader".into())
            .spawn(move || {
                let mut buffer = [0u8; 4096];
                while running_clone.load(Ordering::Relaxed) {
                    match reader.read(&mut buffer) {
                        Ok(0) => {
                            info!("PTY stream reached EOF");
                            break;
                        }
                        Ok(n) => {
                            let chunk = buffer[..n].to_vec();
                            // If there are active subscribers, send. Otherwise buffer still gets saved in session
                            let _ = output_tx.send(chunk);
                        }
                        Err(err) => {
                            warn!("PTY read error or terminated: {:?}", err);
                            break;
                        }
                    }
                }
                running_clone.store(false, Ordering::Relaxed);
            })?;

        Ok(Self {
            writer,
            master: pair.master,
            child,
            running,
        })
    }

    pub fn write_input(&mut self, data: &[u8]) -> Result<(), std::io::Error> {
        self.writer.write_all(data)?;
        self.writer.flush()?;
        Ok(())
    }

    pub fn resize(&mut self, rows: u16, cols: u16) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.master.resize(PtySize {
            rows: rows.max(5),
            cols: cols.max(10),
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }

    pub fn kill(&mut self) {
        self.running.store(false, Ordering::Relaxed);
        if let Some(pid) = self.child.process_id() {
            #[cfg(target_os = "windows")]
            {
                // Terminate process tree on Windows to ensure child processes (node, python, etc.) don't become zombies
                let mut cmd = std::process::Command::new("taskkill");
                cmd.args(["/PID", &pid.to_string(), "/T", "/F"]);
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
                if let Ok(mut child) = cmd.spawn() {
                    let _ = child.wait();
                }
            }
        }
        let _ = self.child.kill();
    }
}

impl Drop for PtyInstance {
    fn drop(&mut self) {
        self.kill();
    }
}
