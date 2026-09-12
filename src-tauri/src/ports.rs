use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[cfg(not(target_os = "windows"))]
use std::process::Command;

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
#[repr(C)]
#[derive(Copy, Clone)]
#[allow(non_snake_case)]
struct MIB_TCPROW_OWNER_PID {
    dwState: u32,
    dwLocalAddr: u32,
    dwLocalPort: u32,
    dwRemoteAddr: u32,
    dwRemotePort: u32,
    dwOwningPid: u32,
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[allow(non_snake_case)]
struct MIB_TCPTABLE_OWNER_PID {
    dwNumEntries: u32,
    table: [MIB_TCPROW_OWNER_PID; 1],
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[derive(Copy, Clone)]
#[allow(non_snake_case)]
struct MIB_TCP6ROW_OWNER_PID {
    ucLocalAddr: [u8; 16],
    dwLocalScopeId: u32,
    dwLocalPort: u32,
    ucRemoteAddr: [u8; 16],
    dwRemoteScopeId: u32,
    dwRemotePort: u32,
    dwState: u32,
    dwOwningPid: u32,
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[allow(non_snake_case)]
struct MIB_TCP6TABLE_OWNER_PID {
    dwNumEntries: u32,
    table: [MIB_TCP6ROW_OWNER_PID; 1],
}

#[cfg(target_os = "windows")]
const AF_INET: u32 = 2;
#[cfg(target_os = "windows")]
const AF_INET6: u32 = 23;
#[cfg(target_os = "windows")]
const TCP_TABLE_OWNER_PID_LISTENER: i32 = 3;

#[cfg(target_os = "windows")]
#[link(name = "iphlpapi")]
extern "system" {
    fn CreateToolhelp32Snapshot(dwFlags: u32, th32ProcessID: u32) -> *mut std::ffi::c_void;
    fn Process32FirstW(hSnapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
    fn Process32NextW(hSnapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
    fn CloseHandle(hObject: *mut std::ffi::c_void) -> i32;
    fn GetExtendedTcpTable(
        pTcpTable: *mut std::ffi::c_void,
        pdwSize: *mut u32,
        bOrder: i32,
        ulAf: u32,
        TableClass: i32,
        Reserved: u32,
    ) -> u32;
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

#[cfg(target_os = "windows")]
fn get_listening_tcp_ports() -> Vec<(u16, u32)> {
    let mut ports = Vec::new();

    // 1. Query IPv4 listening sockets
    let mut size_v4: u32 = 0;
    unsafe {
        let _ = GetExtendedTcpTable(
            std::ptr::null_mut(),
            &mut size_v4,
            0,
            AF_INET,
            TCP_TABLE_OWNER_PID_LISTENER,
            0,
        );
        if size_v4 > 0 {
            let mut buffer_v4: Vec<u8> = vec![0u8; size_v4 as usize];
            let ret = GetExtendedTcpTable(
                buffer_v4.as_mut_ptr() as *mut std::ffi::c_void,
                &mut size_v4,
                0,
                AF_INET,
                TCP_TABLE_OWNER_PID_LISTENER,
                0,
            );
            if ret == 0 {
                let table = buffer_v4.as_ptr() as *const MIB_TCPTABLE_OWNER_PID;
                let num_entries = (*table).dwNumEntries as usize;
                let rows_ptr = std::ptr::addr_of!((*table).table) as *const MIB_TCPROW_OWNER_PID;
                for i in 0..num_entries {
                    let row = *rows_ptr.add(i);
                    let port = u16::from_be((row.dwLocalPort & 0xFFFF) as u16);
                    ports.push((port, row.dwOwningPid));
                }
            }
        }
    }

    // 2. Query IPv6 listening sockets
    let mut size_v6: u32 = 0;
    unsafe {
        let _ = GetExtendedTcpTable(
            std::ptr::null_mut(),
            &mut size_v6,
            0,
            AF_INET6,
            TCP_TABLE_OWNER_PID_LISTENER,
            0,
        );
        if size_v6 > 0 {
            let mut buffer_v6: Vec<u8> = vec![0u8; size_v6 as usize];
            let ret = GetExtendedTcpTable(
                buffer_v6.as_mut_ptr() as *mut std::ffi::c_void,
                &mut size_v6,
                0,
                AF_INET6,
                TCP_TABLE_OWNER_PID_LISTENER,
                0,
            );
            if ret == 0 {
                let table = buffer_v6.as_ptr() as *const MIB_TCP6TABLE_OWNER_PID;
                let num_entries = (*table).dwNumEntries as usize;
                let rows_ptr = std::ptr::addr_of!((*table).table) as *const MIB_TCP6ROW_OWNER_PID;
                for i in 0..num_entries {
                    let row = *rows_ptr.add(i);
                    let port = u16::from_be((row.dwLocalPort & 0xFFFF) as u16);
                    ports.push((port, row.dwOwningPid));
                }
            }
        }
    }

    ports
}

#[cfg(not(target_os = "windows"))]
fn get_listening_tcp_ports() -> Vec<(u16, u32)> {
    Vec::new()
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

    let raw_ports = get_listening_tcp_ports();

    let mut detected: Vec<DetectedPort> = Vec::new();
    let mut seen_ports: HashSet<u16> = HashSet::new();

    for (port, pid) in raw_ports {
        // Only match processes belonging to this session tree
        if !target_pids.contains(&pid) {
            continue;
        }

        // Skip internal/well-known windows service ports, Veron's own server port (4567), and AGY internal RPC/sidecars (3500-3510)
        if port == 135
            || port == 445
            || port == 4567
            || port == 5357
            || port == 7680
            || (3500..=3510).contains(&port)
        {
            continue;
        }

        let proc_name = names_map
            .get(&pid)
            .cloned()
            .unwrap_or_else(|| "process".to_string());

        let proc_lower = proc_name.to_lowercase();
        if proc_lower.contains("agy") || proc_lower.contains("antigravity") {
            continue;
        }

        if seen_ports.insert(port) {
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

/// Open URL in default browser safely
pub fn open_browser_url(url: &str) -> Result<(), String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("Only http and https URLs are allowed".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        extern "system" {
            fn ShellExecuteW(
                hwnd: *mut std::ffi::c_void,
                lpOperation: *const u16,
                lpFile: *const u16,
                lpParameters: *const u16,
                lpDirectory: *const u16,
                nShowCmd: i32,
            ) -> isize;
        }

        let op: Vec<u16> = "open\0".encode_utf16().collect();
        let target: Vec<u16> = format!("{}\0", trimmed).encode_utf16().collect();

        let res = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                op.as_ptr(),
                target.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1, // SW_SHOWNORMAL
            )
        };

        if res > 32 {
            Ok(())
        } else {
            Err(format!("ShellExecuteW failed with error code: {}", res))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("xdg-open")
            .arg(trimmed)
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

    #[test]
    fn test_open_browser_url_rejects_unsafe_schemes() {
        assert!(open_browser_url("file:///C:/Windows/win.ini").is_err());
        assert!(open_browser_url("javascript:alert(1)").is_err());
        assert!(open_browser_url("calc.exe").is_err());
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_get_listening_tcp_ports_win32() {
        let ports = get_listening_tcp_ports();
        assert!(!ports.is_empty(), "Should find listening ports via Win32 GetExtendedTcpTable");
    }
}
