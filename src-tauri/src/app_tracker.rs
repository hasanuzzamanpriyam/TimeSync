use rusqlite;
use rusqlite::types::ToSql;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Manager;

pub struct AppTrackerState {
    pub is_tracking: Arc<AtomicBool>,
    pub is_idle: Arc<AtomicBool>,
    pub time_entry_id: Arc<Mutex<Option<i64>>>,
}

impl AppTrackerState {
    pub fn new() -> Self {
        Self {
            is_tracking: Arc::new(AtomicBool::new(false)),
            is_idle: Arc::new(AtomicBool::new(false)),
            time_entry_id: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Serialize)]
pub struct AppUsageRecord {
    pub app_name: String,
    pub window_title: Option<String>,
    pub total_seconds: i64,
}

#[cfg(target_os = "windows")]
mod platform {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    #[link(name = "user32")]
    extern "system" {
        fn GetForegroundWindow() -> isize;
        fn GetWindowTextW(hwnd: isize, lpString: *mut u16, nMaxCount: i32) -> i32;
        fn GetWindowThreadProcessId(hwnd: isize, lpdwProcessId: *mut u32) -> u32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> isize;
        fn CloseHandle(hObject: isize) -> i32;
    }

    #[link(name = "psapi")]
    extern "system" {
        fn GetModuleBaseNameW(hProcess: isize, hModule: isize, lpBaseName: *mut u16, nSize: u32) -> u32;
    }

    const PROCESS_QUERY_INFORMATION: u32 = 0x0400;
    const PROCESS_VM_READ: u32 = 0x0010;

    pub fn get_active_window() -> Result<(String, String), String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd == 0 {
                return Err("No foreground window".to_string());
            }

            let mut title_buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
            let title = if len > 0 {
                OsString::from_wide(&title_buf[..len as usize])
                    .to_string_lossy()
                    .into_owned()
            } else {
                String::new()
            };

            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);

            let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
            let app_name = if handle != 0 {
                let mut name_buf = [0u16; 260];
                let name_len = GetModuleBaseNameW(handle, 0, name_buf.as_mut_ptr(), 260);
                CloseHandle(handle);
                if name_len > 0 {
                    OsString::from_wide(&name_buf[..name_len as usize])
                        .to_string_lossy()
                        .into_owned()
                } else {
                    format!("pid:{}", pid)
                }
            } else {
                format!("pid:{}", pid)
            };

            Ok((app_name, title))
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use std::process::Command;

    pub fn get_active_window() -> Result<(String, String), String> {
        let script = r#"tell application "System Events"
            set frontProc to first process whose frontmost is true
            set appName to name of frontProc
            try
                set winTitle to title of window 1 of frontProc
            on error
                set winTitle to ""
            end try
            return appName & "\t" & winTitle
        end tell"#;

        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| format!("Failed to run osascript: {}", e))?;

        if !output.status.success() {
            return Err("osascript failed".to_string());
        }

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let parts: Vec<&str> = stdout.trim().splitn(2, '\t').collect();
        let app_name = parts.first().unwrap_or(&"").trim().to_string();
        let window_title = if parts.len() > 1 {
            parts[1].trim().to_string()
        } else {
            String::new()
        };

        Ok((app_name, window_title))
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use std::fs;
    use std::process::Command;

    pub fn get_active_window() -> Result<(String, String), String> {
        let pid_output = Command::new("xdotool")
            .args(["getactivewindow", "getwindowpid"])
            .output()
            .map_err(|e| format!("Failed to run xdotool: {}", e))?;

        if !pid_output.status.success() {
            return Err("xdotool getwindowpid failed".to_string());
        }

        let pid_str = String::from_utf8_lossy(&pid_output.stdout).trim().to_string();
        let pid: u32 = pid_str.parse().map_err(|_| "Invalid PID".to_string())?;

        let app_name = fs::read_to_string(format!("/proc/{}/comm", pid))
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|_| format!("pid:{}", pid));

        let title_output = Command::new("xdotool")
            .args(["getactivewindow", "getwindowname"])
            .output()
            .map_err(|e| format!("Failed to get window name: {}", e))?;

        let window_title = if title_output.status.success() {
            String::from_utf8_lossy(&title_output.stdout).trim().to_string()
        } else {
            String::new()
        };

        Ok((app_name, window_title))
    }
}

fn get_db_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get app config dir: {}", e))?;
    Ok(app_dir.join("timesync.db"))
}

#[tauri::command]
pub fn start_app_tracking(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppTrackerState>,
    time_entry_id: i64,
) -> Result<(), String> {
    if state.is_tracking.load(Ordering::SeqCst) {
        return Ok(());
    }

    *state.time_entry_id.lock().map_err(|e| e.to_string())? = Some(time_entry_id);
    state.is_tracking.store(true, Ordering::SeqCst);
    state.is_idle.store(false, Ordering::SeqCst);

    let db_path = get_db_path(&app_handle)?;
    let tracking_flag = state.is_tracking.clone();
    let idle_flag = state.is_idle.clone();
    let entry_id = state.time_entry_id.clone();

    thread::spawn(move || {
        while tracking_flag.load(Ordering::SeqCst) {
            if !idle_flag.load(Ordering::SeqCst) {
                if let Ok((app_name, window_title)) = platform::get_active_window() {
                    let tid = *entry_id.lock().unwrap();
                    if let Some(tid) = tid {
                        if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                            let _ = conn.execute(
                                "INSERT INTO app_usage (time_entry_id, app_name, window_title, duration_seconds) VALUES (?1, ?2, ?3, 10)",
                                rusqlite::params![tid, app_name, window_title],
                            );
                        }
                    }
                }
            }
            thread::sleep(Duration::from_secs(10));
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_app_tracking(state: tauri::State<'_, AppTrackerState>) -> Result<(), String> {
    state.is_tracking.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn set_idle_state(state: tauri::State<'_, AppTrackerState>, idle: bool) -> Result<(), String> {
    state.is_idle.store(idle, Ordering::SeqCst);
    Ok(())
}

#[derive(Serialize)]
pub struct AppTrackingStatus {
    pub is_tracking: bool,
    pub is_idle: bool,
    pub current_time_entry_id: Option<i64>,
    pub app_usage_rows: i64,
}

#[tauri::command]
pub fn check_app_tracking(
    state: tauri::State<'_, AppTrackerState>,
    app_handle: tauri::AppHandle,
    time_entry_id: i64,
) -> Result<AppTrackingStatus, String> {
    let is_tracking = state.is_tracking.load(Ordering::SeqCst);
    let is_idle = state.is_idle.load(Ordering::SeqCst);
    let current_time_entry_id = *state
        .time_entry_id
        .lock()
        .map_err(|e| e.to_string())?;

    let db_path = get_db_path(&app_handle)?;
    let app_usage_rows = if let Ok(conn) = rusqlite::Connection::open(&db_path) {
        conn.query_row(
            "SELECT COUNT(*) FROM app_usage WHERE time_entry_id = ?1",
            rusqlite::params![time_entry_id],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0)
    } else {
        0
    };

    Ok(AppTrackingStatus {
        is_tracking,
        is_idle,
        current_time_entry_id,
        app_usage_rows,
    })
}

#[tauri::command]
pub fn get_app_usage(
    app_handle: tauri::AppHandle,
    time_entry_id: i64,
) -> Result<Vec<AppUsageRecord>, String> {
    let db_path = get_db_path(&app_handle)?;
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT app_name, window_title, SUM(duration_seconds) as total_seconds
             FROM app_usage WHERE time_entry_id = ?1
             GROUP BY app_name, window_title
             ORDER BY total_seconds DESC",
        )
        .map_err(|e| format!("Query error: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![time_entry_id], |row| {
            Ok(AppUsageRecord {
                app_name: row.get(0)?,
                window_title: row.get(1)?,
                total_seconds: row.get(2)?,
            })
        })
        .map_err(|e| format!("Query error: {}", e))?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("Row error: {}", e))?);
    }

    Ok(result)
}

#[tauri::command]
pub fn get_today_app_usage(
    app_handle: tauri::AppHandle,
    user_id: i64,
) -> Result<Vec<AppUsageRecord>, String> {
    let db_path = get_db_path(&app_handle)?;
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| format!("DB error: {}", e))?;

    let mut stmt = conn
        .prepare(
             "SELECT a.app_name, a.window_title, SUM(a.duration_seconds) as total_seconds
              FROM app_usage a
              JOIN time_entries t ON t.id = a.time_entry_id
              WHERE t.user_id = ?1 AND date(a.recorded_at) = date('now')
              GROUP BY a.app_name, a.window_title
              ORDER BY total_seconds DESC",
        )
        .map_err(|e| format!("Query error: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(AppUsageRecord {
                app_name: row.get(0)?,
                window_title: row.get(1)?,
                total_seconds: row.get(2)?,
            })
        })
        .map_err(|e| format!("Query error: {}", e))?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("Row error: {}", e))?);
    }

    Ok(result)
}

#[derive(Serialize)]
pub struct AppUsageReportRow {
    pub date: String,
    pub user_id: i64,
    pub user_name: String,
    pub app_name: String,
    pub window_title: Option<String>,
    pub total_seconds: i64,
}

#[tauri::command]
pub fn get_app_usage_report(
    app_handle: tauri::AppHandle,
    user_id: Option<i64>,
    start_date: String,
    end_date: String,
    app_filter: Option<String>,
) -> Result<Vec<AppUsageReportRow>, String> {
    let db_path = get_db_path(&app_handle)?;
    let conn =
        rusqlite::Connection::open(&db_path).map_err(|e| format!("DB error: {}", e))?;

    let mut sql = String::from(
        "SELECT date(a.recorded_at) as date, u.id as user_id, u.full_name as user_name, \
         a.app_name, a.window_title, SUM(a.duration_seconds) as total_seconds \
         FROM app_usage a \
         JOIN time_entries t ON t.id = a.time_entry_id \
         JOIN users u ON u.id = t.user_id \
         WHERE date(a.recorded_at) BETWEEN ?1 AND ?2",
    );

    let mut params: Vec<Box<dyn ToSql>> = Vec::new();
    params.push(Box::new(start_date));
    params.push(Box::new(end_date));

    let mut param_idx = 3;

    if let Some(uid) = user_id {
        sql.push_str(&format!(" AND t.user_id = ?{}", param_idx));
        params.push(Box::new(uid));
        param_idx += 1;
    }

    if let Some(ref filter) = app_filter {
        if !filter.is_empty() {
            sql.push_str(&format!(" AND a.app_name LIKE ?{}", param_idx));
            params.push(Box::new(format!("%{}%", filter)));
            param_idx += 1;
        }
    }

    sql.push_str(
        " GROUP BY date(a.recorded_at), u.id, u.full_name, a.app_name, a.window_title \
         ORDER BY date(a.recorded_at) DESC, total_seconds DESC",
    );

    let _ = param_idx;

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Query error: {}", e))?;

    let param_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(AppUsageReportRow {
                date: row.get(0)?,
                user_id: row.get(1)?,
                user_name: row.get(2)?,
                app_name: row.get(3)?,
                window_title: row.get(4)?,
                total_seconds: row.get(5)?,
            })
        })
        .map_err(|e| format!("Query error: {}", e))?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("Row error: {}", e))?);
    }

    Ok(result)
}
