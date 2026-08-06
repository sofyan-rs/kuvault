use tauri::webview::PageLoadEvent;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_log::{Target, TargetKind};

mod db;
mod launcher;
mod scanners;
mod steam_api;
mod steamgriddb;

use scanners::ScannedGame;
use steam_api::OwnedGamePlaytime;
use steamgriddb::CoverOption;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn scan_steam() -> Vec<ScannedGame> {
    scanners::steam::scan()
}

#[tauri::command]
fn scan_epic() -> Vec<ScannedGame> {
    scanners::epic::scan()
}

#[tauri::command]
async fn search_steamgriddb_covers(query: String, api_key: String) -> Result<Vec<CoverOption>, String> {
    steamgriddb::search_covers(query, api_key).await
}

#[tauri::command]
async fn steamgriddb_cover_for_steam_appid(appid: String, api_key: String) -> Result<Option<String>, String> {
    steamgriddb::cover_for_steam_appid(appid, api_key).await
}

#[tauri::command]
async fn resolve_steam_vanity_url(api_key: String, vanity: String) -> Result<Option<String>, String> {
    steam_api::resolve_vanity_url(api_key, vanity).await
}

#[tauri::command]
async fn get_steam_owned_playtimes(
    api_key: String,
    steam_id: String,
) -> Result<Vec<OwnedGamePlaytime>, String> {
    steam_api::get_owned_playtimes(api_key, steam_id).await
}

#[tauri::command]
fn launch_game(
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
fn stop_game(id: i64, install_dir: Option<String>) -> Result<(), String> {
    launcher::stop(id, install_dir)
}

#[tauri::command]
fn focus_running_game(id: i64) -> Result<(), String> {
    launcher::focus_running_window(id)
}

#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    launcher::minimize_running_windows();

    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let _ = window.unminimize();
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

fn external_navigation_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::<R>::new("external-navigation")
        .on_navigation(|webview, url| {
            let is_internal_host = matches!(
                url.host_str(),
                Some("localhost") | Some("127.0.0.1") | Some("tauri.localhost") | Some("::1")
            );

            let is_internal = url.scheme() == "tauri" || is_internal_host;

            if is_internal {
                return true;
            }

            let is_external_link = matches!(url.scheme(), "http" | "https" | "mailto" | "tel");

            if is_external_link {
                log::info!("opening external link in system browser: {}", url);
                let _ = webview.opener().open_url(url.as_str(), None::<&str>);
                return false;
            }

            true
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(db::DB_URL, db::migrations())
                .build(),
        )
        .plugin(external_navigation_plugin())
        .invoke_handler(tauri::generate_handler![
            greet,
            scan_steam,
            scan_epic,
            search_steamgriddb_covers,
            steamgriddb_cover_for_steam_appid,
            get_steam_owned_playtimes,
            resolve_steam_vanity_url,
            launch_game,
            stop_game,
            focus_running_game,
            focus_main_window
        ])
        .on_page_load(|webview, payload| {
            if webview.label() == "main" && matches!(payload.event(), PageLoadEvent::Finished) {
                log::info!("main webview finished loading");
                let _ = webview.window().show();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
