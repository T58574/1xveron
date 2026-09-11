use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedPort {
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[allow(non_snake_case)]
struct PROCESSENTRY32W {
    dwSize: u32,
    cntUsage: u32,
    th32ProcessID: u32,
    th32DefaultHeapID: usize,
    th32ModuleID: u32,
    cntThreads: u32,
    th32ParentProcessID: u32,
    pcPriClassBase: i32,
    dwFlags: u32,
    szExeFile: [u16; 260],
}

#[cfg(target_os = "windows")]
extern "system" {
    fn CreateToolhelp32Snapshot(dwFlags: u32, th32ProcessID: u32) -> *mut std::ffi::c_void;
    fn Process32FirstW(hSnapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
    fn Process32NextW(hSnapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
    fn CloseHandle(hObject: *mut std::ffi::c_void) -> i32;
}

#[cfg(target_os = "windows")]
const TH32CS_SNAPPROCESS: u32 = 0x00000002;
#[cfg(target_os = "windows")]
const INVALID_HANDLE_VALUE: *mut std::ffi::c_void = -1isize as *mut std::ffi::c_void;

/// Resolves all descendant PIDs starting from root PIDs on Windows
#[cfg(target_os = "windows")]
pub fn get_process_tree(root_pids: &[u32]) -> (HashSet<u32>, HashMap<u32, String>) {
    let mut children_map: HashMap<u32, Vec<u32>> = HashMap::new();
    let mut names_map: HashMap<u32, String> = HashMap::new();

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot != INVALID_HANDLE_VALUE {
            let mut entry = PROCESSENTRY32W {
                dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                cntUsage: 0,
                th32ProcessID: 0,
                th32DefaultHeapID: 0,
                th32ModuleID: 0,
                cntThreads: 0,
                th32ParentProcessID: 0,
                pcPriClassBase: 0,
                dwFlags: 0,
                szExeFile: [0; 260],
            };

            if Process32FirstW(snapshot, &mut entry) != 0 {
                loop {
                    let pid = entry.th32ProcessID;
                    let ppid = entry.th32ParentProcessID;

                    // Convert UTF-16 exe name to String
                    let end = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(260);
                    let name = String::from_utf16_lossy(&entry.szExeFile[..end]);

                    names_map.insert(pid, name);
                    children_map.entry(ppid).or_default().push(pid);

                    if Process32NextW(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);
        }
    }

    // Collect all descendants recursively using BFS
    let mut descendants = HashSet::new();
    let mut queue = Vec::new();

    for &root in root_pids {
        descendants.insert(root);
        queue.push(root);
    }

    while let Some(current) = queue.pop() {
        if let Some(children) = children_map.get(&current) {
            for &child in children {
                if descendants.insert(child) {
                    queue.push(child);
                }
            }
        }
    }

    (descendants, names_map)
}

#[cfg(not(target_os = "windows"))]
pub fn get_process_tree(root_pids: &[u32]) -> (HashSet<u32>, HashMap<u32, String>) {
    let mut set = HashSet::new();
    for &pid in root_pids {
        set.insert(pid);
    }
    (set, HashMap::new())
}

/// Detects listening TCP ports for the given workspace session root PIDs
pub fn scan_listening_ports(session_root_pids: &[u32]) -> Vec<DetectedPort> {
    if session_root_pids.is_empty() {
        return Vec::new();
    }

    let (target_pids, names_map) = get_process_tree(session_root_pids);
    if target_pids.is_empty() {
        return Vec::new();
    }

    let mut cmd = Command::new("netstat");
    cmd.args(["-ano"]);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = match cmd.output() {
        Ok(out) => String::from_utf8_lossy(&out.stdout).to_string(),
        Err(_) => return Vec::new(),
    };

    let mut detected: Vec<DetectedPort> = Vec::new();
    let mut seen_ports: HashSet<u16> = HashSet::new();

    for line in output.lines() {
        if !line.contains("LISTENING") {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 4 {
            continue;
        }

        // parts typically: ["TCP", "0.0.0.0:5173", "0.0.0.0:0", "LISTENING", "12345"]
        let local_addr = parts[1];
        let pid_str = parts.last().unwrap_or(&"");
        let pid = match pid_str.parse::<u32>() {
            Ok(p) => p,
            Err(_) => continue,
        };

        // Only match processes belonging to this session tree
        if !target_pids.contains(&pid) {
            continue;
        }

        // Extract port from local_addr (format: 0.0.0.0:5173 or [::]:5173 or 127.0.0.1:3000)
        let port_part = match local_addr.rsplit(':').next() {
            Some(p) => p,
            None => continue,
        };

        let port = match port_part.parse::<u16>() {
            Ok(p) => p,
            Err(_) => continue,
        };

        // Skip internal/well-known windows service ports (e.g. 135, 445) and Veron's own server port (4567)
        if port == 135 || port == 445 || port == 4567 || port == 5357 || port == 7680 {
            continue;
        }

        if seen_ports.insert(port) {
            let proc_name = names_map
                .get(&pid)
                .cloned()
                .unwrap_or_else(|| "process".to_string());

            detected.push(DetectedPort {
                port,
                pid,
                process_name: proc_name,
            });
        }
    }

    detected.sort_by_key(|d| d.port);
    detected
}

/// Open URL in default Windows browser
pub fn open_browser_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", url]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.spawn().map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_listening_ports() {
        let empty_ports = scan_listening_ports(&[]);
        assert!(empty_ports.is_empty());
    }

    #[test]
    fn test_process_tree() {
        let (tree, names) = get_process_tree(&[std::process::id()]);
        assert!(tree.contains(&std::process::id()));
        assert!(names.contains_key(&std::process::id()));
    }
}
