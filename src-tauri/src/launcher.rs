use std::collections::HashMap;
use std::path::Path;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use sysinfo::{Pid, ProcessesToUpdate, System};
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize, Clone)]
pub struct LaunchStarted {
    pub id: i64,
}

#[derive(Serialize, Clone)]
pub struct LaunchFinished {
    pub id: i64,
    pub playtime_seconds: u64,
}

const STEAM_DETECT_TIMEOUT: Duration = Duration::from_secs(120);
const STEAM_POLL_INTERVAL: Duration = Duration::from_secs(2);

/// Maps a running game's db id to its OS process id, so it can be looked up and killed later.
static RUNNING_PIDS: Mutex<Option<HashMap<i64, u32>>> = Mutex::new(None);

fn set_running_pid(id: i64, pid: u32) {
    let mut map = RUNNING_PIDS.lock().unwrap();
    map.get_or_insert_with(HashMap::new).insert(id, pid);
}

fn clear_running_pid(id: i64) {
    if let Some(map) = RUNNING_PIDS.lock().unwrap().as_mut() {
        map.remove(&id);
    }
}

/// True if `exe_path` lives anywhere under `install_dir`.
fn is_under_install_dir(exe_path: &Path, install_dir: &Path) -> bool {
    let exe = exe_path.canonicalize().unwrap_or_else(|_| exe_path.to_path_buf());
    let dir = install_dir.canonicalize().unwrap_or_else(|_| install_dir.to_path_buf());
    exe.starts_with(dir)
}

fn find_process_under(system: &mut System, install_dir: &Path) -> Option<Pid> {
    system.refresh_all();
    system
        .processes()
        .iter()
        .find(|(_, process)| {
            process
                .exe()
                .is_some_and(|exe| is_under_install_dir(exe, install_dir))
        })
        .map(|(pid, _)| *pid)
}

pub fn launch(
    app: AppHandle,
    id: i64,
    platform: String,
    executable_path: String,
    launch_args: Option<String>,
    install_dir: Option<String>,
) -> Result<(), String> {
    if platform == "steam" {
        app.opener()
            .open_url(&executable_path, None::<&str>)
            .map_err(|e| e.to_string())?;

        let Some(install_dir) = install_dir.filter(|dir| !dir.is_empty()) else {
            return Ok(());
        };

        std::thread::spawn(move || {
            let install_dir = Path::new(&install_dir);
            let mut system = System::new();
            let detect_started_at = Instant::now();

            let pid = loop {
                if let Some(pid) = find_process_under(&mut system, install_dir) {
                    break pid;
                }
                if detect_started_at.elapsed() > STEAM_DETECT_TIMEOUT {
                    return;
                }
                std::thread::sleep(STEAM_POLL_INTERVAL);
            };

            set_running_pid(id, pid.as_u32());
            let _ = app.emit("game-launch-started", LaunchStarted { id });
            let started_at = Instant::now();

            while system.refresh_processes(ProcessesToUpdate::Some(&[pid]), true) > 0 {
                std::thread::sleep(STEAM_POLL_INTERVAL);
            }

            clear_running_pid(id);
            let playtime_seconds = started_at.elapsed().as_secs();
            let _ = app.emit(
                "game-launch-finished",
                LaunchFinished {
                    id,
                    playtime_seconds,
                },
            );
        });

        return Ok(());
    }

    let mut command = Command::new(&executable_path);
    if let Some(args) = &launch_args {
        if !args.is_empty() {
            command.arg(args);
        }
    }

    let mut child = command.spawn().map_err(|e| e.to_string())?;
    set_running_pid(id, child.id());
    let _ = app.emit("game-launch-started", LaunchStarted { id });

    std::thread::spawn(move || {
        let started_at = Instant::now();
        let _ = child.wait();
        clear_running_pid(id);
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

/// Recursively collects every process whose parent chain leads back to `root` — many games
/// (and launchers/bootstrappers) spawn the real game process as a child, so killing just the
/// tracked pid can leave the actual game running.
fn collect_descendants(system: &System, root: Pid, out: &mut Vec<Pid>) {
    for (pid, process) in system.processes() {
        if process.parent() == Some(root) {
            out.push(*pid);
            collect_descendants(system, *pid, out);
        }
    }
}

pub fn stop(id: i64, install_dir: Option<String>) -> Result<(), String> {
    let tracked_pid = RUNNING_PIDS
        .lock()
        .unwrap()
        .as_ref()
        .and_then(|map| map.get(&id).copied())
        .map(Pid::from_u32);

    let mut system = System::new();
    system.refresh_all();

    let mut pids_to_kill: Vec<Pid> = Vec::new();

    if let Some(pid) = tracked_pid {
        pids_to_kill.push(pid);
        collect_descendants(&system, pid, &mut pids_to_kill);
    }

    // The tracked pid can be the wrong process (e.g. a launcher/anti-cheat helper that also
    // lives under the install dir, picked up first while scanning) — also kill every other
    // process whose exe lives under the install dir so the real game exe gets caught too.
    if let Some(install_dir) = install_dir.filter(|dir| !dir.is_empty()) {
        let install_dir = Path::new(&install_dir);
        for (pid, process) in system.processes() {
            if process
                .exe()
                .is_some_and(|exe| is_under_install_dir(exe, install_dir))
                && !pids_to_kill.contains(pid)
            {
                pids_to_kill.push(*pid);
            }
        }
    }

    if pids_to_kill.is_empty() {
        return Err("Game is not running".to_string());
    }

    // Kill leaf/unrelated processes first so a parent doesn't respawn a child we already
    // terminated.
    pids_to_kill.reverse();

    let mut killed_any = false;
    for pid in pids_to_kill {
        if let Some(process) = system.process(pid) {
            if process.kill() {
                killed_any = true;
            }
        }
    }

    if killed_any {
        Ok(())
    } else {
        Err("Process not found".to_string())
    }
}
