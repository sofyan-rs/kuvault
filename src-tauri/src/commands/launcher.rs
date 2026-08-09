use tauri::Manager;

use crate::services::launcher;

#[tauri::command]
pub fn launch_game(
    app: tauri::AppHandle,
    id: i64,
    platform: String,
    executable_path: String,
    launch_args: Option<String>,
    install_dir: Option<String>,
    run_as_admin: bool,
    optimize_ram: bool,
    source_id: Option<String>,
) -> Result<(), String> {
    launcher::launch(
        app,
        id,
        platform,
        executable_path,
        launch_args,
        install_dir,
        run_as_admin,
        optimize_ram,
        source_id,
    )
}

// Async: stop() can block for several seconds (WM_CLOSE grace period before a hard kill) — a
// sync command runs on the main thread and would freeze the whole UI for that long.
#[tauri::command(async)]
pub fn stop_game(id: i64, install_dir: Option<String>) -> Result<(), String> {
    launcher::stop(id, install_dir)
}

// Async: does a full process-list refresh and EnumWindows call, same main-thread freeze risk.
#[tauri::command(async)]
pub fn focus_running_game(id: i64) -> Result<(), String> {
    launcher::focus_running_window(id)
}

#[tauri::command]
pub fn get_install_size(install_dir: String) -> Result<u64, String> {
    fn dir_size(path: &std::path::Path) -> std::io::Result<u64> {
        let mut total = 0u64;
        for entry in std::fs::read_dir(path)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            if file_type.is_dir() {
                total += dir_size(&entry.path())?;
            } else {
                total += entry.metadata()?.len();
            }
        }
        Ok(total)
    }

    dir_size(std::path::Path::new(&install_dir)).map_err(|e| e.to_string())
}

// Async: minimize_running_windows() does a full process-list refresh plus an EnumWindows call
// per tracked game, same main-thread freeze risk as the other window-touching commands above.
#[tauri::command(async)]
pub fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    launcher::minimize_running_windows();

    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let _ = window.unminimize();
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}
