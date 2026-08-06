use std::process::Command;
use std::time::Instant;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize, Clone)]
pub struct LaunchFinished {
    pub id: i64,
    pub playtime_seconds: u64,
}

pub fn launch(
    app: AppHandle,
    id: i64,
    platform: String,
    executable_path: String,
    launch_args: Option<String>,
) -> Result<(), String> {
    if platform == "steam" {
        app.opener()
            .open_url(&executable_path, None::<&str>)
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    let mut command = Command::new(&executable_path);
    if let Some(args) = &launch_args {
        if !args.is_empty() {
            command.arg(args);
        }
    }

    let mut child = command.spawn().map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let started_at = Instant::now();
        let _ = child.wait();
        let playtime_seconds = started_at.elapsed().as_secs();

        let _ = app.emit(
            "game-launch-finished",
            LaunchFinished {
                id,
                playtime_seconds,
            },
        );
    });

    Ok(())
}
