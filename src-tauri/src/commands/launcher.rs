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
) -> Result<(), String> {
    launcher::launch(
        app,
        id,
        platform,
        executable_path,
        launch_args,
        install_dir,
        run_as_admin,
    )
}

#[tauri::command]
pub fn stop_game(id: i64, install_dir: Option<String>) -> Result<(), String> {
    launcher::stop(id, install_dir)
}

#[tauri::command]
pub fn focus_running_game(id: i64) -> Result<(), String> {
    launcher::focus_running_window(id)
}

#[tauri::command]
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
