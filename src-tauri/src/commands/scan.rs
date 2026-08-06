use crate::services::scanners::{self, ScannedGame};

#[tauri::command]
pub fn scan_steam() -> Vec<ScannedGame> {
    scanners::steam::scan()
}

#[tauri::command]
pub fn scan_epic() -> Vec<ScannedGame> {
    scanners::epic::scan()
}
