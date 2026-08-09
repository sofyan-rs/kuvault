//! Small Windows window-inspection helpers shared across services that need to avoid disturbing
//! a fullscreen game (see `launcher.rs`'s `windows_focus` module for the crash this guards
//! against — forcing `ShowWindow`/`SetForegroundWindow` on a DirectX exclusive-fullscreen window
//! from outside the normal alt-tab path can crash the game's swapchain).

#![cfg(target_os = "windows")]

use std::collections::HashSet;

use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, RECT, TRUE};
use windows_sys::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowRect, GetWindowThreadProcessId, IsWindowVisible,
};

/// Whether `hwnd`'s bounds exactly cover its monitor — true for both borderless and DirectX
/// exclusive fullscreen.
pub fn is_fullscreen_window(hwnd: HWND) -> bool {
    unsafe {
        let mut window_rect: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut window_rect) == 0 {
            return false;
        }

        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut monitor_info: MONITORINFO = std::mem::zeroed();
        monitor_info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(monitor, &mut monitor_info) == 0 {
            return false;
        }

        window_rect.left <= monitor_info.rcMonitor.left
            && window_rect.top <= monitor_info.rcMonitor.top
            && window_rect.right >= monitor_info.rcMonitor.right
            && window_rect.bottom >= monitor_info.rcMonitor.bottom
    }
}

unsafe extern "system" fn enum_proc_fullscreen(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let out = &mut *(lparam as *mut HashSet<u32>);

    if IsWindowVisible(hwnd) != 0 && is_fullscreen_window(hwnd) {
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);
        if process_id != 0 {
            out.insert(process_id);
        }
    }

    TRUE
}

/// Pids owning a visible top-level fullscreen window right now, in a single `EnumWindows` pass.
pub fn fullscreen_pids() -> HashSet<u32> {
    let mut pids = HashSet::new();
    unsafe {
        EnumWindows(
            Some(enum_proc_fullscreen),
            &mut pids as *mut HashSet<u32> as LPARAM,
        );
    }
    pids
}
