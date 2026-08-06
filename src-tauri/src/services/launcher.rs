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
    run_as_admin: bool,
) -> Result<(), String> {
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
                set_running_pid(id, pid);
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

        #[cfg(not(target_os = "windows"))]
        {
            return Err("Run as administrator is only supported on Windows".to_string());
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
            let parsed = shell_words::split(args).map_err(|e| e.to_string())?;
            command.args(parsed);
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
        Ok(())
    } else {
        Err("Process not found".to_string())
    }
}

/// Brings the running game's window to the foreground, so a gamepad "Continue" action can hand
/// focus back to the game instead of just launching it again.
pub fn focus_running_window(id: i64) -> Result<(), String> {
    let tracked_pid = RUNNING_PIDS
        .lock()
        .unwrap()
        .as_ref()
        .and_then(|map| map.get(&id).copied());

    let Some(pid) = tracked_pid else {
        return Err("Game is not running".to_string());
    };

    #[cfg(target_os = "windows")]
    {
        // Many games are a launcher/bootstrapper that spawns the real game as a child process —
        // the actual window lives on the child's pid, not the one KuVault tracked at launch, so
        // search the whole process tree rooted at the tracked pid.
        let mut system = System::new();
        system.refresh_all();
        let root = Pid::from_u32(pid);
        let mut candidates = vec![root];
        collect_descendants(&system, root, &mut candidates);
        let pids: Vec<u32> = candidates.iter().map(|p| p.as_u32()).collect();

        windows_focus::focus_window_for_pids(&pids)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = pid;
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
        let tracked_pids: Vec<u32> = RUNNING_PIDS
            .lock()
            .unwrap()
            .as_ref()
            .map(|map| map.values().copied().collect())
            .unwrap_or_default();

        let mut system = System::new();
        system.refresh_all();

        for pid in tracked_pids {
            let root = Pid::from_u32(pid);
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
        EnumWindows, GetWindowThreadProcessId, IsWindowVisible, SetForegroundWindow, ShowWindow,
        SW_MINIMIZE, SW_RESTORE,
    };

    struct SearchState<'a> {
        target_pids: &'a [u32],
        found: Option<HWND>,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let state = &mut *(lparam as *mut SearchState);

        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);

        if state.target_pids.contains(&process_id) && IsWindowVisible(hwnd) != 0 {
            state.found = Some(hwnd);
            return 0; // stop enumeration
        }

        TRUE
    }

    fn find_window_for_pids(pids: &[u32]) -> Option<HWND> {
        let mut state = SearchState {
            target_pids: pids,
            found: None,
        };

        unsafe {
            EnumWindows(Some(enum_proc), &mut state as *mut SearchState as LPARAM);
        }

        state.found
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
            ShowWindow(hwnd, SW_RESTORE);
            SetForegroundWindow(hwnd);
        }

        Ok(())
    }

    /// `ShowWindow` doesn't require the foreground-switching rights `SetForegroundWindow` does,
    /// so this works even on a higher-integrity (run as administrator) game window.
    pub fn minimize_window_for_pids(pids: &[u32]) {
        let our_pid = unsafe { GetCurrentProcessId() };
        let pids: Vec<u32> = pids.iter().copied().filter(|&p| p != our_pid).collect();

        if let Some(hwnd) = find_window_for_pids(&pids) {
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

    /// Elevated `taskkill /F /T /PID <pid> [/PID <pid> ...]` fallback for processes KuVault
    /// (running unelevated) has no permission to terminate directly — one UAC prompt for every
    /// pid passed in, not one per pid.
    pub fn kill_elevated(pids: &[u32]) -> bool {
        if pids.is_empty() {
            return true;
        }
        let mut args = String::from("/F /T");
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
