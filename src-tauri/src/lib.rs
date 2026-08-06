use tauri::webview::PageLoadEvent;
use tauri_plugin_log::{Target, TargetKind};

mod commands;
mod plugins;
mod services;

use commands::launcher::{focus_main_window, focus_running_game, launch_game, stop_game};
use commands::misc::greet;
use commands::scan::{scan_epic, scan_steam};
use commands::steam::{get_steam_owned_playtimes, resolve_steam_vanity_url};
use commands::steamgriddb::{search_steamgriddb_covers, steamgriddb_cover_for_steam_appid};
use plugins::external_navigation::external_navigation_plugin;

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
                .add_migrations(services::db::DB_URL, services::db::migrations())
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
