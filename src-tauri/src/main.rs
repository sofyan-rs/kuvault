// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri_native_lib::maybe_relaunch_elevated();
    tauri_native_lib::run()
}
