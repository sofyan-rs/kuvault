//! Lets the user opt into running KuVault elevated even though the shipped exe manifest is
//! `asInvoker` (required so unelevated flows like autostart and the installer's "launch after
//! install" checkbox work). Preference lives in the registry so `main.rs` can read it before the
//! Tauri app (and its sqlite-backed settings) has started.

const REG_KEY: &str = r"Software\KuVault";
const REG_VALUE: &str = "RunAsAdmin";

#[cfg(target_os = "windows")]
pub fn get_pref() -> bool {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(REG_KEY)
        .and_then(|key| key.get_value::<u32, _>(REG_VALUE))
        .map(|v| v != 0)
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
pub fn set_pref(enabled: bool) -> Result<(), String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(REG_KEY)
        .map_err(|e| e.to_string())?;
    key.set_value(REG_VALUE, &(enabled as u32))
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
pub fn is_elevated() -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token: HANDLE = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return false;
        }

        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut returned_len = 0u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut returned_len,
        );
        CloseHandle(token);

        ok != 0 && elevation.TokenIsElevated != 0
    }
}

/// Relaunches the current exe elevated (UAC "runas" prompt) and exits this unelevated process.
/// Returns `Err` (without exiting) if the UAC prompt was declined or the relaunch failed, so the
/// caller can fall back to continuing unelevated instead of leaving the user with no app at all.
#[cfg(target_os = "windows")]
pub fn relaunch_elevated_and_exit() -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    // ShellExecuteEx error code for a declined UAC prompt (ERROR_CANCELLED).
    const SE_ERR_ACCESSDENIED: i32 = 5;

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;

    fn to_wide(s: impl AsRef<OsStr>) -> Vec<u16> {
        s.as_ref().encode_wide().chain(std::iter::once(0)).collect()
    }

    let verb = to_wide("runas");
    let file = to_wide(exe.as_os_str());

    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL as i32,
        )
    };

    // ShellExecuteW returns a value > 32 on success, an HINSTANCE-shaped error code otherwise.
    if (result as isize) <= 32 {
        if result as i32 == SE_ERR_ACCESSDENIED {
            return Err("UAC prompt was declined".to_string());
        }
        return Err(format!("ShellExecuteW failed (code {})", result as isize));
    }

    std::process::exit(0);
}

#[cfg(not(target_os = "windows"))]
pub fn get_pref() -> bool {
    false
}

#[cfg(not(target_os = "windows"))]
pub fn set_pref(_enabled: bool) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn is_elevated() -> bool {
    false
}

#[cfg(not(target_os = "windows"))]
pub fn relaunch_elevated_and_exit() -> Result<(), String> {
    Ok(())
}
