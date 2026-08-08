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
