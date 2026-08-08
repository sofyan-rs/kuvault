use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::webview::PageLoadEvent;
use tauri::{Manager, WindowEvent};
use tauri_plugin_log::{Target, TargetKind};

mod commands;
mod plugins;
mod services;

use commands::launcher::{focus_main_window, focus_running_game, launch_game, stop_game};
use commands::misc::greet;
use commands::power::{exit_app, system_restart, system_shutdown, system_sleep};
use commands::scan::{scan_epic, scan_steam};
use commands::settings::{get_run_as_admin, is_running_elevated, set_run_as_admin};
use commands::steam::{get_steam_owned_playtimes, resolve_steam_vanity_url};
use commands::steamgriddb::{search_steamgriddb_covers, steamgriddb_cover_for_steam_appid};
use plugins::external_navigation::external_navigation_plugin;

/// If the user has opted into running KuVault as administrator but this process isn't elevated
/// (e.g. launched via autostart, which always runs de-elevated), relaunch elevated and exit this
/// instance. Must run before the Tauri app starts so there's no unelevated window flash. If the
/// UAC prompt is declined, falls through and continues unelevated rather than leaving no app open.
pub fn maybe_relaunch_elevated() {
    if services::elevation::get_pref() && !services::elevation::is_elevated() {
        if let Err(e) = services::elevation::relaunch_elevated_and_exit() {
            log::warn!("failed to relaunch elevated, continuing unelevated: {e}");
        }
    }
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
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(services::db::DB_URL, services::db::migrations())
                .build(),
        )
        .plugin(external_navigation_plugin())
        .setup(|app| {
            let open_item = MenuItem::with_id(app, "open", "Open KuVault", true, None::<&str>)?;
            let exit_item = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&open_item, &exit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "exit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
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
            focus_main_window,
            system_sleep,
            system_shutdown,
            system_restart,
            exit_app,
            get_run_as_admin,
            set_run_as_admin,
            is_running_elevated
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
