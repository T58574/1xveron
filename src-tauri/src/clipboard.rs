#[cfg(windows)]
pub fn set_clipboard(text: &str) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    extern "system" {
        fn OpenClipboard(hWndNewOwner: *mut std::ffi::c_void) -> i32;
        fn CloseClipboard() -> i32;
        fn EmptyClipboard() -> i32;
        fn SetClipboardData(uFormat: u32, hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        fn GlobalAlloc(uFlags: u32, dwBytes: usize) -> *mut std::ffi::c_void;
        fn GlobalLock(hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        fn GlobalUnlock(hMem: *mut std::ffi::c_void) -> i32;
    }

    const CF_UNICODETEXT: u32 = 13;
    const GMEM_MOVEABLE: u32 = 0x0002;

    let wide: Vec<u16> = OsStr::new(text).encode_wide().chain(std::iter::once(0)).collect();
    let size_bytes = wide.len() * std::mem::size_of::<u16>();

    unsafe {
        let mut opened = false;
        for _ in 0..5 {
            if OpenClipboard(std::ptr::null_mut()) != 0 {
                opened = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        if !opened {
            return Err("Failed to open clipboard".to_string());
        }

        EmptyClipboard();

        let h_mem = GlobalAlloc(GMEM_MOVEABLE, size_bytes);
        if h_mem.is_null() {
            CloseClipboard();
            return Err("GlobalAlloc failed".to_string());
        }

        let p_lock = GlobalLock(h_mem);
        if p_lock.is_null() {
            CloseClipboard();
            return Err("GlobalLock failed".to_string());
        }

        std::ptr::copy_nonoverlapping(wide.as_ptr() as *const u8, p_lock as *mut u8, size_bytes);
        GlobalUnlock(h_mem);

        if SetClipboardData(CF_UNICODETEXT, h_mem).is_null() {
            CloseClipboard();
            return Err("SetClipboardData failed".to_string());
        }

        CloseClipboard();
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn set_clipboard(_text: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
pub fn get_clipboard() -> Result<String, String> {
    extern "system" {
        fn OpenClipboard(hWndNewOwner: *mut std::ffi::c_void) -> i32;
        fn CloseClipboard() -> i32;
        fn GetClipboardData(uFormat: u32) -> *mut std::ffi::c_void;
        fn GlobalLock(hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        fn GlobalUnlock(hMem: *mut std::ffi::c_void) -> i32;
    }

    const CF_UNICODETEXT: u32 = 13;

    unsafe {
        let mut opened = false;
        for _ in 0..5 {
            if OpenClipboard(std::ptr::null_mut()) != 0 {
                opened = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        if !opened {
            return Err("Failed to open clipboard".to_string());
        }

        let h_mem = GetClipboardData(CF_UNICODETEXT);
        if h_mem.is_null() {
            CloseClipboard();
            return Ok(String::new());
        }

        let p_lock = GlobalLock(h_mem) as *const u16;
        if p_lock.is_null() {
            CloseClipboard();
            return Ok(String::new());
        }

        let mut len = 0;
        while *p_lock.add(len) != 0 {
            len += 1;
        }

        let slice = std::slice::from_raw_parts(p_lock, len);
        let result = String::from_utf16_lossy(slice);

        GlobalUnlock(h_mem);
        CloseClipboard();
        Ok(result)
    }
}

#[cfg(not(windows))]
pub fn get_clipboard() -> Result<String, String> {
    Ok(String::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clipboard_roundtrip() {
        let test_str = "veron-test-clipboard-roundtrip-9876";
        let res = set_clipboard(test_str);
        assert!(res.is_ok(), "set_clipboard should succeed: {:?}", res);
        let read = get_clipboard();
        assert!(read.is_ok(), "get_clipboard should succeed: {:?}", read);
        assert_eq!(read.unwrap(), test_str);
    }
}

