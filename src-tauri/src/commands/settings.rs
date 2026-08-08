use crate::services::elevation;

#[tauri::command]
pub fn get_run_as_admin() -> bool {
    elevation::get_pref()
}

#[tauri::command]
pub fn set_run_as_admin(enabled: bool) -> Result<(), String> {
    elevation::set_pref(enabled)
}

#[tauri::command]
pub fn is_running_elevated() -> bool {
    elevation::is_elevated()
}

/// True when running the raw portable exe rather than an NSIS-installed copy. The installer
/// (currentUser mode) always writes an uninstall registry key under HKCU; the portable exe,
/// launched directly with no installer, never does.
#[tauri::command]
pub fn is_portable_install() -> bool {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;

        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Uninstall\KuVault")
            .is_err()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}
