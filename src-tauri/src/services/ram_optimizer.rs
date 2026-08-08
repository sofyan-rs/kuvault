/// Best-effort working-set trim run right before a game launches, if the user opted in via
/// Settings. Never fails, never blocks a launch — callers ignore the outcome and always call this
/// from a detached thread. `skip_pids` are processes that must not be touched (already-running
/// games and their descendants).
#[cfg(target_os = "windows")]
pub fn optimize_before_launch(skip_pids: Vec<u32>) {
    use std::time::Instant;

    use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

    const MIN_WORKING_SET_BYTES: u64 = 32 * 1024 * 1024;

    let started_at = Instant::now();

    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::new());

    let our_pid = std::process::id();
    let our_session = system
        .process(Pid::from_u32(our_pid))
        .and_then(|p| p.session_id());

    let skip: Vec<Pid> = skip_pids.into_iter().map(Pid::from_u32).collect();
    let is_skipped = |pid: Pid| -> bool {
        let mut current = Some(pid);
        while let Some(p) = current {
            if skip.contains(&p) {
                return true;
            }
            current = system.process(p).and_then(|proc| proc.parent());
        }
        false
    };

    let mut attempted = 0u32;
    let mut trimmed = 0u32;

    for (pid, process) in system.processes() {
        let pid = *pid;
        if pid.as_u32() == 0 || pid.as_u32() == 4 || pid.as_u32() == our_pid {
            continue;
        }
        if process.session_id() != our_session {
            continue;
        }
        if process.memory() < MIN_WORKING_SET_BYTES {
            continue;
        }
        if is_skipped(pid) {
            continue;
        }

        attempted += 1;
        if windows_trim::trim_process(pid.as_u32()) {
            trimmed += 1;
        }
    }

    windows_trim::trim_self();

    log::info!(
        "ram optimize: trimmed {trimmed}/{attempted} processes in {}ms",
        started_at.elapsed().as_millis()
    );
}

#[cfg(not(target_os = "windows"))]
pub fn optimize_before_launch(skip_pids: Vec<u32>) {
    let _ = skip_pids;
}

/// Best-effort working-set trim of KuVault's own `msedgewebview2.exe` process tree, run while the
/// main window is hidden/minimized. Throttled since it's called from window events. Only ever
/// touches processes named `msedgewebview2.exe` descending from our own pid — never a launched
/// game, even one spawned as a direct child of us (e.g. non-Steam launches).
#[cfg(target_os = "windows")]
pub fn trim_own_webview() {
    use std::sync::Mutex;
    use std::time::Instant;

    use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

    const TRIM_INTERVAL: std::time::Duration = std::time::Duration::from_secs(30);
    static LAST_TRIM: Mutex<Option<Instant>> = Mutex::new(None);

    {
        let mut last = LAST_TRIM.lock().unwrap();
        if last.is_some_and(|t| t.elapsed() < TRIM_INTERVAL) {
            return;
        }
        *last = Some(Instant::now());
    }

    let started_at = Instant::now();

    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::new());

    let our_pid = Pid::from_u32(std::process::id());

    let descends_from_us = |mut pid: Pid| -> bool {
        while let Some(process) = system.process(pid) {
            let Some(parent) = process.parent() else {
                return false;
            };
            if parent == our_pid {
                return true;
            }
            pid = parent;
        }
        false
    };

    let mut attempted = 0u32;
    let mut trimmed = 0u32;

    for (pid, process) in system.processes() {
        let pid = *pid;
        if !process
            .name()
            .to_str()
            .is_some_and(|name| name.eq_ignore_ascii_case("msedgewebview2.exe"))
        {
            continue;
        }
        if !descends_from_us(pid) {
            continue;
        }

        attempted += 1;
        if windows_trim::trim_process(pid.as_u32()) {
            trimmed += 1;
        }
        windows_trim::set_efficiency_mode(pid.as_u32(), true);
    }

    windows_trim::trim_self();

    log::info!(
        "ram trim (idle): trimmed {trimmed}/{attempted} webview processes in {}ms",
        started_at.elapsed().as_millis()
    );
}

#[cfg(not(target_os = "windows"))]
pub fn trim_own_webview() {}

#[cfg(target_os = "windows")]
mod windows_trim {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::ProcessStatus::EmptyWorkingSet;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, OpenProcess, ProcessPowerThrottling, SetPriorityClass,
        SetProcessInformation, IDLE_PRIORITY_CLASS, NORMAL_PRIORITY_CLASS,
        PROCESS_POWER_THROTTLING_CURRENT_VERSION, PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
        PROCESS_POWER_THROTTLING_STATE, PROCESS_QUERY_INFORMATION,
        PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_INFORMATION, PROCESS_SET_QUOTA,
    };

    /// Returns false on any failure (access denied, process exited) — callers just count and
    /// move on.
    pub fn trim_process(pid: u32) -> bool {
        let mut handle = unsafe { OpenProcess(PROCESS_SET_QUOTA | PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if handle.is_null() {
            handle = unsafe { OpenProcess(PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION, 0, pid) };
        }
        if handle.is_null() {
            return false;
        }

        let ok = unsafe { EmptyWorkingSet(handle) };
        unsafe {
            CloseHandle(handle);
        }
        ok != 0
    }

    pub fn trim_self() {
        unsafe {
            EmptyWorkingSet(GetCurrentProcess());
        }
    }

    /// Toggles EcoQoS power throttling + background priority on `pid` — the same "Efficiency
    /// Mode" Task Manager shows with a green leaf icon. `enabled=false` restores normal priority
    /// and clears throttling. Best-effort: returns false on any failure, callers just count.
    pub fn set_efficiency_mode(pid: u32, enabled: bool) -> bool {
        let mut handle = unsafe {
            OpenProcess(
                PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION,
                0,
                pid,
            )
        };
        if handle.is_null() {
            handle = unsafe {
                OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_INFORMATION, 0, pid)
            };
        }
        if handle.is_null() {
            return false;
        }

        let priority_ok = unsafe {
            SetPriorityClass(
                handle,
                if enabled { IDLE_PRIORITY_CLASS } else { NORMAL_PRIORITY_CLASS },
            )
        } != 0;

        let mut state = PROCESS_POWER_THROTTLING_STATE {
            Version: PROCESS_POWER_THROTTLING_CURRENT_VERSION,
            ControlMask: PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
            StateMask: if enabled { PROCESS_POWER_THROTTLING_EXECUTION_SPEED } else { 0 },
        };
        let throttling_ok = unsafe {
            SetProcessInformation(
                handle,
                ProcessPowerThrottling,
                &mut state as *mut _ as *mut core::ffi::c_void,
                std::mem::size_of::<PROCESS_POWER_THROTTLING_STATE>() as u32,
            )
        } != 0;

        unsafe {
            CloseHandle(handle);
        }

        priority_ok && throttling_ok
    }
}
