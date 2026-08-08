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

#[cfg(target_os = "windows")]
mod windows_trim {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::ProcessStatus::EmptyWorkingSet;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_QUERY_LIMITED_INFORMATION,
        PROCESS_SET_QUOTA,
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
}
