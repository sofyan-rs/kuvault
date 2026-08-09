use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
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

/// How long `stop()` waits after asking a game to close (`WM_CLOSE`) before falling back to a
/// hard kill — long enough for a game to flush an in-progress save on exit.
const GRACE_TIMEOUT: Duration = Duration::from_secs(5);
const GRACE_POLL_INTERVAL: Duration = Duration::from_millis(200);

/// Identity snapshot of a tracked game process, taken once when KuVault starts tracking it.
/// `start_time` is the primary anti-pid-reuse token — Windows can hand the same pid to an
/// unrelated process once the original exits, and a raw pid alone can't tell the two apart.
#[derive(Clone)]
struct TrackedProcess {
    pid: u32,
    start_time: u64,
    exe: Option<PathBuf>,
}

/// Maps a running game's db id to its tracked process identity, so it can be looked up and
/// killed later without acting on a pid Windows has since reassigned to something else.
static RUNNING_PIDS: Mutex<Option<HashMap<i64, TrackedProcess>>> = Mutex::new(None);

fn set_running_pid(id: i64, tracked: TrackedProcess) {
    let mut map = RUNNING_PIDS.lock().unwrap();
    map.get_or_insert_with(HashMap::new).insert(id, tracked);
}

fn clear_running_pid(id: i64) {
    if let Some(map) = RUNNING_PIDS.lock().unwrap().as_mut() {
        map.remove(&id);
    }
}

fn tracked_pids() -> Vec<u32> {
    RUNNING_PIDS
        .lock()
        .unwrap()
        .as_ref()
        .map(|map| map.values().map(|t| t.pid).collect())
        .unwrap_or_default()
}

fn tracked_process(id: i64) -> Option<TrackedProcess> {
    RUNNING_PIDS
        .lock()
        .unwrap()
        .as_ref()
        .and_then(|map| map.get(&id).cloned())
}

fn tracked_processes() -> Vec<TrackedProcess> {
    RUNNING_PIDS
        .lock()
        .unwrap()
        .as_ref()
        .map(|map| map.values().cloned().collect())
        .unwrap_or_default()
}

/// Snapshots `pid`'s identity from an already-refreshed `system`, or `None` if it isn't running.
fn snapshot_of(system: &System, pid: Pid) -> Option<TrackedProcess> {
    system.process(pid).map(|process| TrackedProcess {
        pid: pid.as_u32(),
        start_time: process.start_time(),
        exe: process.exe().map(|e| e.to_path_buf()),
    })
}

/// Whether the pid in `tracked` still refers to the same process it did when snapshotted, per an
/// already-refreshed `system`. False (not just "not found") if the pid now belongs to a
/// different process — Windows reused it after the original exited.
fn still_alive(system: &System, tracked: &TrackedProcess) -> bool {
    let Some(process) = system.process(Pid::from_u32(tracked.pid)) else {
        return false;
    };
    if process.start_time() != tracked.start_time {
        return false;
    }
    if let Some(expected) = &tracked.exe {
        if process.exe() != Some(expected.as_path()) {
            return false;
        }
    }
    true
}

/// Blocks until `tracked`'s process exits (or its pid gets reused by something else — either way
/// it's gone from KuVault's point of view). Unlike a naive "does this pid exist" poll, this can't
/// hang forever if the pid is recycled by an unrelated process while KuVault is watching it.
fn wait_for_exit(system: &mut System, tracked: &TrackedProcess) {
    loop {
        system.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[Pid::from_u32(tracked.pid)]),
            true,
            ProcessRefreshKind::new().with_exe(UpdateKind::OnlyIfNotSet),
        );
        if !still_alive(system, tracked) {
            return;
        }
        std::thread::sleep(STEAM_POLL_INTERVAL);
    }
}

/// Snapshots `pid`'s identity right now (for the two launch paths that already have the exact
/// pid in hand rather than needing to scan for it) and tracks it under `id` if it's still alive.
fn track_pid_now(id: i64, pid: u32) {
    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
        true,
        ProcessRefreshKind::new().with_exe(UpdateKind::OnlyIfNotSet),
    );
    if let Some(tracked) = snapshot_of(&system, Pid::from_u32(pid)) {
        set_running_pid(id, tracked);
    }
}

/// True if `exe_path` lives anywhere under `install_dir`.
fn is_under_install_dir(exe_path: &Path, install_dir: &Path) -> bool {
    let exe = exe_path.canonicalize().unwrap_or_else(|_| exe_path.to_path_buf());
    let dir = install_dir.canonicalize().unwrap_or_else(|_| install_dir.to_path_buf());
    exe.starts_with(dir)
}

fn find_process_under(system: &mut System, install_dir: &Path) -> Option<Pid> {
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::new().with_exe(UpdateKind::OnlyIfNotSet),
    );
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
    run_as_admin: bool,
    optimize_ram: bool,
    source_id: Option<String>,
) -> Result<(), String> {
    if optimize_ram {
        // Best-effort and detached: never delay or fail a launch on a memory trim.
        let skip_pids = tracked_pids();
        std::thread::spawn(move || crate::services::ram_optimizer::optimize_before_launch(skip_pids));
    }

    if run_as_admin && platform != "steam" {
        #[cfg(target_os = "windows")]
        {
            let dir = install_dir.as_deref().map(Path::new);
            let elevated =
                windows_elevate::launch_elevated(&executable_path, launch_args.as_deref(), dir)?;

            let scan_dir = install_dir.clone().filter(|d| !d.is_empty());

            let Some(scan_dir) = scan_dir else {
                // No install dir to fall back on — track the elevated handle directly. This
                // misses the real game pid if the exe is a bootstrapper that spawns a child and
                // exits, but there's nothing else to scan for.
                let pid = elevated.pid();
                track_pid_now(id, pid);
                let _ = app.emit("game-launch-started", LaunchStarted { id });

                std::thread::spawn(move || {
                    let started_at = Instant::now();
                    elevated.wait();
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
            };

            // Elevated exes are often a bootstrapper that spawns the real (also elevated) game
            // process as a child and exits — the initial handle would go stale immediately, so
            // scan install_dir for the actual game process instead, same as the Steam path does.
            drop(elevated);

            std::thread::spawn(move || {
                let install_dir = Path::new(&scan_dir);
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

                let Some(tracked) = snapshot_of(&system, pid) else {
                    return;
                };
                set_running_pid(id, tracked.clone());
                let _ = app.emit("game-launch-started", LaunchStarted { id });
                let started_at = Instant::now();

                wait_for_exit(&mut system, &tracked);

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

        #[cfg(not(target_os = "windows"))]
        {
            return Err("Run as administrator is only supported on Windows".to_string());
        }
    }

    // Launching the exe directly skips Epic's own auth/session args (-epicapp, -epicenv,
    // -EpicPortal, -AUTH_*), which some games (e.g. DNF Duel's anti-cheat/EOS layer) rely on to
    // detect a valid Epic session — without them they can spawn an extra helper/auth window on
    // top of the game window. Going through the Epic protocol URL instead makes the Epic client
    // launch the game itself with the right args, same as launching from the Epic library.
    if platform == "epic" {
        if let Some(source_id) = source_id.filter(|id| !id.is_empty()) {
            let url = format!(
                "com.epicgames.launcher://apps/{source_id}?action=launch&silent=true"
            );
            app.opener()
                .open_url(&url, None::<&str>)
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

                let Some(tracked) = snapshot_of(&system, pid) else {
                    return;
                };
                set_running_pid(id, tracked.clone());
                let _ = app.emit("game-launch-started", LaunchStarted { id });
                let started_at = Instant::now();

                wait_for_exit(&mut system, &tracked);

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
    }

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

            let Some(tracked) = snapshot_of(&system, pid) else {
                return;
            };
            set_running_pid(id, tracked.clone());
            let _ = app.emit("game-launch-started", LaunchStarted { id });
            let started_at = Instant::now();

            wait_for_exit(&mut system, &tracked);

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
            let parsed = shell_words::split(args).map_err(|e| e.to_string())?;
            command.args(parsed);
        }
    }

    let mut child = command.spawn().map_err(|e| e.to_string())?;

    // If an install dir is set, the launched exe may be a mod loader/bootstrapper that spawns
    // the real game as a child and exits quickly — waiting on it directly would report the game
    // as stopped while it's still running. Scan install_dir for the actual game process instead,
    // same as the Steam/Epic paths do.
    let scan_dir = install_dir.filter(|d| !d.is_empty());

    if let Some(scan_dir) = scan_dir {
        std::thread::spawn(move || {
            let install_dir = Path::new(&scan_dir);
            let mut system = System::new();
            let detect_started_at = Instant::now();

            let pid = loop {
                if let Some(pid) = find_process_under(&mut system, install_dir) {
                    break pid;
                }
                if let Ok(Some(_)) = child.try_wait() {
                    // The launched process exited before spawning anything under install_dir.
                    return;
                }
                if detect_started_at.elapsed() > STEAM_DETECT_TIMEOUT {
                    return;
                }
                std::thread::sleep(STEAM_POLL_INTERVAL);
            };

            let Some(tracked) = snapshot_of(&system, pid) else {
                return;
            };
            set_running_pid(id, tracked.clone());
            let _ = app.emit("game-launch-started", LaunchStarted { id });
            let started_at = Instant::now();

            wait_for_exit(&mut system, &tracked);

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

    track_pid_now(id, child.id());
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
    let tracked = tracked_process(id);

    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::new().with_exe(UpdateKind::OnlyIfNotSet),
    );

    let mut pids_to_kill: Vec<Pid> = Vec::new();

    if let Some(tracked) = &tracked {
        if still_alive(&system, tracked) {
            let pid = Pid::from_u32(tracked.pid);
            pids_to_kill.push(pid);
            collect_descendants(&system, pid, &mut pids_to_kill);
        } else {
            // Pid no longer refers to the process we launched — Windows likely recycled it.
            // Fall through to the install_dir sweep below rather than acting on it.
            clear_running_pid(id);
        }
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

    // Never target our own process — belt-and-suspenders against a stale/reused pid entry, or an
    // install_dir sweep picking up a portable KuVault build that happens to live in that folder.
    let our_pid = Pid::from_u32(std::process::id());
    pids_to_kill.retain(|pid| *pid != our_pid);

    if pids_to_kill.is_empty() {
        return Err("Game is not running".to_string());
    }

    // Kill leaf/unrelated processes first so a parent doesn't respawn a child we already
    // terminated.
    pids_to_kill.reverse();

    // Ask nicely first: post WM_CLOSE to every window we're about to kill and give the process a
    // few seconds to save and exit on its own before falling back to a hard kill below. Elevated
    // (run as administrator) games don't get a grace period here — UIPI blocks a message post
    // from KuVault's lower integrity level to their windows, so they fall straight through to the
    // `kill_elevated` fallback.
    #[cfg(target_os = "windows")]
    {
        let all_pids: Vec<u32> = pids_to_kill.iter().map(|p| p.as_u32()).collect();
        if windows_focus::post_close_to_pids(&all_pids) > 0 {
            let deadline = Instant::now() + GRACE_TIMEOUT;
            while Instant::now() < deadline && !pids_to_kill.is_empty() {
                std::thread::sleep(GRACE_POLL_INTERVAL);
                system.refresh_processes_specifics(
                    ProcessesToUpdate::Some(&pids_to_kill),
                    true,
                    ProcessRefreshKind::new(),
                );
                pids_to_kill.retain(|pid| system.process(*pid).is_some());
            }
        }
    }

    if pids_to_kill.is_empty() {
        // Everything closed gracefully during the wait above.
        clear_running_pid(id);
        return Ok(());
    }

    let mut killed_any = false;
    #[cfg_attr(not(target_os = "windows"), allow(unused_mut))]
    let mut access_denied: Vec<Pid> = Vec::new();

    for pid in pids_to_kill {
        if let Some(process) = system.process(pid) {
            if process.kill() {
                killed_any = true;
            } else {
                // KuVault isn't elevated, so it can't terminate a higher-integrity (run as
                // administrator) game process this way — fall back to an elevated `taskkill`.
                access_denied.push(pid);
            }
        }
    }

    #[cfg(target_os = "windows")]
    if !access_denied.is_empty() {
        // One elevated call for every remaining pid, not one UAC prompt per pid.
        let pids: Vec<u32> = access_denied.iter().map(|p| p.as_u32()).collect();
        if windows_elevate::kill_elevated(&pids) {
            killed_any = true;
        }
    }

    if killed_any {
        clear_running_pid(id);
        Ok(())
    } else {
        Err("Process not found".to_string())
    }
}

/// Brings the running game's window to the foreground, so a gamepad "Continue" action can hand
/// focus back to the game instead of just launching it again.
pub fn focus_running_window(id: i64) -> Result<(), String> {
    let Some(tracked) = tracked_process(id) else {
        return Err("Game is not running".to_string());
    };

    #[cfg(target_os = "windows")]
    {
        // Many games are a launcher/bootstrapper that spawns the real game as a child process —
        // the actual window lives on the child's pid, not the one KuVault tracked at launch, so
        // search the whole process tree rooted at the tracked pid.
        let mut system = System::new();
        system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::new().with_exe(UpdateKind::OnlyIfNotSet),
        );

        if !still_alive(&system, &tracked) {
            // Pid was recycled since launch — don't focus an unrelated process's window.
            clear_running_pid(id);
            return Err("Game is not running".to_string());
        }

        let root = Pid::from_u32(tracked.pid);
        let mut candidates = vec![root];
        collect_descendants(&system, root, &mut candidates);
        let pids: Vec<u32> = candidates.iter().map(|p| p.as_u32()).collect();

        windows_focus::focus_window_for_pids(&pids)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = tracked;
        Err("Focusing the game window is only supported on Windows".to_string())
    }
}

/// Minimizes every currently-tracked running game's window. `ShowWindow` (unlike
/// `SetForegroundWindow`) isn't blocked by UIPI when the target belongs to a higher-integrity
/// (run as administrator) process, so this is used to get an elevated game's window out of the
/// way before KuVault tries to bring its own window to the front — Windows normally hands
/// foreground to the next window automatically once the elevated one is minimized.
pub fn minimize_running_windows() {
    #[cfg(target_os = "windows")]
    {
        let tracked_processes = tracked_processes();

        let mut system = System::new();
        system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::new().with_exe(UpdateKind::OnlyIfNotSet),
        );

        for tracked in tracked_processes {
            if !still_alive(&system, &tracked) {
                // Pid was recycled since launch — skip it rather than minimizing an unrelated
                // process's window.
                continue;
            }
            let root = Pid::from_u32(tracked.pid);
            let mut candidates = vec![root];
            collect_descendants(&system, root, &mut candidates);
            let pids: Vec<u32> = candidates.iter().map(|p| p.as_u32()).collect();
            windows_focus::minimize_window_for_pids(&pids);
        }
    }
}

#[cfg(target_os = "windows")]
mod windows_focus {
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, TRUE};
    use windows_sys::Win32::System::Threading::GetCurrentProcessId;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetClassNameW, GetWindowThreadProcessId, IsWindowVisible, PostMessageW,
        SetForegroundWindow, ShowWindow, SW_MINIMIZE, SW_RESTORE, WM_CLOSE,
    };

    use crate::services::windows_ui::is_fullscreen_window;

    struct SearchState<'a> {
        target_pids: &'a [u32],
        found: Option<HWND>,
        // Console windows (e.g. a mod loader's debug/log terminal riding on the game's pid)
        // shouldn't steal focus over the actual game window — remember one as a last resort
        // in case the target process turns out to have no other visible window at all.
        console_fallback: Option<HWND>,
    }

    fn is_console_window(hwnd: HWND) -> bool {
        let mut buf = [0u16; 256];
        let len = unsafe { GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
        if len <= 0 {
            return false;
        }
        String::from_utf16_lossy(&buf[..len as usize]) == "ConsoleWindowClass"
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let state = &mut *(lparam as *mut SearchState);

        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);

        if state.target_pids.contains(&process_id) && IsWindowVisible(hwnd) != 0 {
            if is_console_window(hwnd) {
                state.console_fallback = Some(hwnd);
                return TRUE;
            }
            state.found = Some(hwnd);
            return 0; // stop enumeration
        }

        TRUE
    }

    fn find_window_for_pids(pids: &[u32]) -> Option<HWND> {
        let mut state = SearchState {
            target_pids: pids,
            found: None,
            console_fallback: None,
        };

        unsafe {
            EnumWindows(Some(enum_proc), &mut state as *mut SearchState as LPARAM);
        }

        state.found.or(state.console_fallback)
    }

    // `enum_proc`/`enum_proc_collect` cast `lparam` back to a `&mut` of their respective state
    // structs — sound as written (the state outlives the synchronous `EnumWindows` call, each
    // callback is single-threaded), but any future change that lets `EnumWindows` return early
    // via a different path, or that captures the state by value elsewhere, would produce UB.
    struct CollectState<'a> {
        target_pids: &'a [u32],
        found: Vec<HWND>,
    }

    unsafe extern "system" fn enum_proc_collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let state = &mut *(lparam as *mut CollectState);

        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);

        if state.target_pids.contains(&process_id)
            && IsWindowVisible(hwnd) != 0
            && !is_console_window(hwnd)
        {
            state.found.push(hwnd);
        }

        TRUE
    }

    /// Sends `WM_CLOSE` to every visible top-level window belonging to `pids`, giving each
    /// process a chance to save and exit on its own before `stop()` falls back to a hard kill.
    /// Uses `PostMessageW` (not `SendMessageW`, which blocks until the target processes the
    /// message — a hung game would hang KuVault too). Returns how many posts actually succeeded
    /// — UIPI silently makes `PostMessageW` fail (returns 0) for a higher-integrity (run as
    /// administrator) window, so a window merely being found isn't enough; the caller needs to
    /// know whether the close was actually delivered to decide whether waiting is worthwhile. 0
    /// means there's nothing to wait on (background/console-only process, or every post was
    /// blocked), so the caller should skip straight to force-kill.
    pub fn post_close_to_pids(pids: &[u32]) -> usize {
        let our_pid = unsafe { GetCurrentProcessId() };
        let pids: Vec<u32> = pids.iter().copied().filter(|&p| p != our_pid).collect();
        if pids.is_empty() {
            return 0;
        }

        let mut state = CollectState {
            target_pids: &pids,
            found: Vec::new(),
        };

        unsafe {
            EnumWindows(
                Some(enum_proc_collect),
                &mut state as *mut CollectState as LPARAM,
            );
        }

        state
            .found
            .iter()
            .filter(|&&hwnd| unsafe { PostMessageW(hwnd, WM_CLOSE, 0, 0) } != 0)
            .count()
    }

    pub fn focus_window_for_pids(pids: &[u32]) -> Result<(), String> {
        // Never target our own process — belt-and-suspenders against a stale/reused pid entry.
        let our_pid = unsafe { GetCurrentProcessId() };
        let pids: Vec<u32> = pids.iter().copied().filter(|&p| p != our_pid).collect();
        if pids.is_empty() {
            return Err("Game is not running".to_string());
        }

        let Some(hwnd) = find_window_for_pids(&pids) else {
            return Err("Game window not found".to_string());
        };

        unsafe {
            // Skip the forced restore for fullscreen windows — it's a no-op at best (they're
            // never minimized by us, see below) and risks the same swapchain crash SW_RESTORE
            // can trigger on some engines if the OS considers the window minimized for any
            // other reason.
            if !is_fullscreen_window(hwnd) {
                ShowWindow(hwnd, SW_RESTORE);
            }
            SetForegroundWindow(hwnd);
        }

        Ok(())
    }

    /// `ShowWindow` doesn't require the foreground-switching rights `SetForegroundWindow` does,
    /// so this works even on a higher-integrity (run as administrator) game window.
    ///
    /// Skips fullscreen (borderless or DirectX exclusive) windows — forcing those to minimize
    /// outside the normal alt-tab path can crash the game's swapchain. Windows already hands
    /// foreground away from a fullscreen-exclusive window on its own once another window
    /// activates, so nothing further is needed here for those.
    pub fn minimize_window_for_pids(pids: &[u32]) {
        let our_pid = unsafe { GetCurrentProcessId() };
        let pids: Vec<u32> = pids.iter().copied().filter(|&p| p != our_pid).collect();

        if let Some(hwnd) = find_window_for_pids(&pids) {
            if is_fullscreen_window(hwnd) {
                return;
            }
            unsafe {
                ShowWindow(hwnd, SW_MINIMIZE);
            }
        }
    }
}

/// Launches an exe elevated (UAC "runas" prompt) since `std::process::Command` has no way to
/// request elevation on Windows.
#[cfg(target_os = "windows")]
mod windows_elevate {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;

    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::Threading::{GetProcessId, WaitForSingleObject, INFINITE};
    use windows_sys::Win32::UI::Shell::{
        ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{SW_HIDE, SW_SHOWNORMAL};

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    pub struct ElevatedProcess {
        handle: HANDLE,
    }

    // SAFETY: HANDLE is just an opaque process handle — safe to move across threads.
    unsafe impl Send for ElevatedProcess {}

    impl ElevatedProcess {
        pub fn pid(&self) -> u32 {
            unsafe { GetProcessId(self.handle) }
        }

        pub fn wait(&self) {
            unsafe {
                WaitForSingleObject(self.handle, INFINITE);
            }
        }
    }

    impl Drop for ElevatedProcess {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.handle);
            }
        }
    }

    pub fn launch_elevated(
        executable_path: &str,
        args: Option<&str>,
        working_dir: Option<&Path>,
    ) -> Result<ElevatedProcess, String> {
        launch_elevated_inner(executable_path, args, working_dir, SW_SHOWNORMAL as i32).ok_or_else(
            || "Failed to launch as administrator (the UAC prompt may have been declined)".to_string(),
        )
    }

    /// Elevated `taskkill /F /PID <pid> [/PID <pid> ...]` fallback for processes KuVault
    /// (running unelevated) has no permission to terminate directly — one UAC prompt for every
    /// pid passed in, not one per pid. No `/T`: callers already pass the fully-expanded
    /// descendant list, and `/T` would also sweep up anything that reparented since — a bigger
    /// blast radius than intended, especially if a pid got reused.
    pub fn kill_elevated(pids: &[u32]) -> bool {
        if pids.is_empty() {
            return true;
        }
        let mut args = String::from("/F");
        for pid in pids {
            args.push_str(" /PID ");
            args.push_str(&pid.to_string());
        }
        let Some(process) = launch_elevated_inner("taskkill", Some(&args), None, SW_HIDE as i32)
        else {
            return false;
        };
        process.wait();
        true
    }

    fn launch_elevated_inner(
        executable_path: &str,
        args: Option<&str>,
        working_dir: Option<&Path>,
        show: i32,
    ) -> Option<ElevatedProcess> {
        let exe_wide = to_wide(executable_path);
        let args_wide = args.filter(|a| !a.is_empty()).map(to_wide);
        let dir_wide = working_dir.map(|d| to_wide(&d.to_string_lossy()));
        let verb_wide = to_wide("runas");

        let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
        info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        info.fMask = SEE_MASK_NOCLOSEPROCESS;
        info.lpVerb = verb_wide.as_ptr();
        info.lpFile = exe_wide.as_ptr();
        info.lpParameters = args_wide.as_ref().map_or(std::ptr::null(), |a| a.as_ptr());
        info.lpDirectory = dir_wide.as_ref().map_or(std::ptr::null(), |d| d.as_ptr());
        info.nShow = show;

        let ok = unsafe { ShellExecuteExW(&mut info) };
        if ok == 0 || info.hProcess.is_null() {
            return None;
        }

        Some(ElevatedProcess {
            handle: info.hProcess,
        })
    }
}
