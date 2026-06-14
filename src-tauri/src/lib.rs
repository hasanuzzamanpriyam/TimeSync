use rusqlite::Connection;
use serde::Serialize;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

mod app_tracker;
use app_tracker::AppTrackerState;

#[derive(Serialize)]
struct UserJson {
    id: i64,
    username: String,
    email: String,
    full_name: String,
    role: String,
    is_active: bool,
}

#[derive(Serialize)]
struct LoginResult {
    user: UserJson,
    session_token: String,
}

fn get_db_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get app config dir: {}", e))?;
    Ok(app_dir.join("timesync.db"))
}

#[tauri::command]
fn hash_password(password: String) -> Result<String, String> {
    bcrypt::hash(&password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())
}

#[tauri::command]
fn verify_password(password: String, hash: String) -> Result<bool, String> {
    bcrypt::verify(&password, &hash).map_err(|e| e.to_string())
}

#[tauri::command]
fn register_local_user(
    app_handle: tauri::AppHandle,
    username: String,
    email: String,
    password: String,
    full_name: String,
) -> Result<LoginResult, String> {
    let db_path = get_db_path(&app_handle)?;
    let mut conn = Connection::open(&db_path).map_err(|e| format!("DB open error: {}", e))?;

    let password_hash =
        bcrypt::hash(&password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;
    let session_token = uuid::Uuid::new_v4().to_string();

    let tx = conn.transaction().map_err(|e| format!("Tx error: {}", e))?;

    tx.execute(
        "INSERT INTO users (username, email, role, full_name, is_active, password_hash) VALUES (?1, ?2, 'employee', ?3, 1, ?4)",
        rusqlite::params![username, email, full_name, password_hash],
    )
    .map_err(|e| format!("Failed to create user: {}", e))?;

    let user_id = tx.last_insert_rowid();

    tx.execute(
        "INSERT INTO sessions (user_id, access_token, refresh_token, expires_at, is_remember_me) VALUES (?1, ?2, ?2, '2099-12-31 23:59:59', 1)",
        rusqlite::params![user_id, session_token],
    )
    .map_err(|e| format!("Failed to create session: {}", e))?;

    tx.commit().map_err(|e| format!("Commit error: {}", e))?;

    let user = UserJson {
        id: user_id,
        username,
        email,
        full_name,
        role: "user".to_string(),
        is_active: true,
    };

    Ok(LoginResult {
        user,
        session_token,
    })
}

#[tauri::command]
fn login_local_user(
    app_handle: tauri::AppHandle,
    username: String,
    password: String,
) -> Result<Option<LoginResult>, String> {
    let db_path = get_db_path(&app_handle)?;
    let mut conn = Connection::open(&db_path).map_err(|e| format!("DB open error: {}", e))?;

    let result = conn
        .query_row(
            "SELECT id, username, email, full_name, role, is_active, password_hash FROM users WHERE username = ?1 AND is_active = 1",
            rusqlite::params![username],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, bool>(5)?,
                    row.get::<_, Option<String>>(6)?,
                ))
            },
        );

    match result {
        Ok((id, uname, email, full_name, role, is_active, pw_hash_opt)) => {
            let pw_hash = match pw_hash_opt {
                Some(h) => h,
                None => return Ok(None),
            };

            let valid =
                bcrypt::verify(&password, &pw_hash).map_err(|e| e.to_string())?;
            if !valid {
                return Ok(None);
            }

            let session_token = uuid::Uuid::new_v4().to_string();

            let tx = conn.transaction().map_err(|e| format!("Tx error: {}", e))?;
            tx.execute(
                "INSERT INTO sessions (user_id, access_token, refresh_token, expires_at, is_remember_me) VALUES (?1, ?2, ?2, '2099-12-31 23:59:59', 1)",
                rusqlite::params![id, session_token],
            )
            .map_err(|e| format!("Failed to create session: {}", e))?;
            tx.commit().map_err(|e| format!("Commit error: {}", e))?;

            Ok(Some(LoginResult {
                user: UserJson {
                    id,
                    username: uname,
                    email,
                    full_name,
                    role,
                    is_active,
                },
                session_token,
            }))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("DB query error: {}", e)),
    }
}

#[tauri::command]
fn seed_demo_users(app_handle: tauri::AppHandle) -> Result<(), String> {
    let db_path = get_db_path(&app_handle)?;
    let conn = Connection::open(&db_path).map_err(|e| format!("DB open error: {}", e))?;

    // Migration 4 (ALTER TABLE ADD COLUMN password_hash) may not have run yet when
    // this setup hook fires, because tauri-plugin-sql runs migrations on first
    // Database.load() call from the frontend. This ensures the column exists so
    // the INSERT below doesn't fail with "no such column".
    let _ = conn.execute_batch("ALTER TABLE users ADD COLUMN password_hash TEXT;");

    let admin_hash =
        bcrypt::hash("admin", bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;
    let user_hash =
        bcrypt::hash("user", bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR IGNORE INTO users (username, email, role, full_name, is_active, password_hash) VALUES ('admin', 'admin@timesync.local', 'admin', 'Administrator', 1, ?1)",
        rusqlite::params![admin_hash],
    )
    .map_err(|e| format!("Failed to seed admin: {}", e))?;

    conn.execute(
        "INSERT OR IGNORE INTO users (username, email, role, full_name, is_active, password_hash) VALUES ('user', 'user@timesync.local', 'employee', 'Demo User', 1, ?1)",
        rusqlite::params![user_hash],
    )
    .map_err(|e| format!("Failed to seed user: {}", e))?;

    // Recover demo users whose password_hash was NULLed or emptied by the old login bug
    for (username, hash) in [("admin", &admin_hash), ("user", &user_hash)] {
        conn.execute(
            "UPDATE users SET password_hash = ?1 WHERE username = ?2 AND (password_hash IS NULL OR password_hash = '')",
            rusqlite::params![hash, username],
        )
        .map_err(|e| format!("Failed to fix {} hash: {}", username, e))?;
    }

    Ok(())
}

#[derive(Serialize)]
struct TeamJson {
    id: i64,
    name: String,
    description: Option<String>,
    created_by: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct TeamMemberJson {
    id: i64,
    team_id: i64,
    user_id: i64,
    is_manager: bool,
    created_at: String,
}

fn conn_from_app(app_handle: &tauri::AppHandle) -> Result<rusqlite::Connection, String> {
    let db_path = get_db_path(app_handle)?;
    Connection::open(&db_path).map_err(|e| format!("DB open error: {}", e))
}

#[tauri::command]
fn create_team(app_handle: tauri::AppHandle, name: String, description: Option<String>, created_by: i64) -> Result<TeamJson, String> {
    let conn = conn_from_app(&app_handle)?;
    conn.execute(
        "INSERT INTO teams (name, description, created_by) VALUES (?1, ?2, ?3)",
        rusqlite::params![name, description, created_by],
    ).map_err(|e| format!("Failed to create team: {}", e))?;
    let id = conn.last_insert_rowid();
    let team = conn.query_row(
        "SELECT id, name, description, created_by, created_at, updated_at FROM teams WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok(TeamJson {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            created_by: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        }),
    ).map_err(|e| format!("Team not found: {}", e))?;
    Ok(team)
}

#[tauri::command]
fn update_team(app_handle: tauri::AppHandle, id: i64, name: String, description: Option<String>) -> Result<TeamJson, String> {
    let conn = conn_from_app(&app_handle)?;
    conn.execute(
        "UPDATE teams SET name = ?1, description = ?2, updated_at = datetime('now') WHERE id = ?3",
        rusqlite::params![name, description, id],
    ).map_err(|e| format!("Failed to update team: {}", e))?;
    let team = conn.query_row(
        "SELECT id, name, description, created_by, created_at, updated_at FROM teams WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok(TeamJson {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            created_by: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        }),
    ).map_err(|e| format!("Team not found: {}", e))?;
    Ok(team)
}

#[tauri::command]
fn delete_team(app_handle: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = conn_from_app(&app_handle)?;
    conn.execute("DELETE FROM teams WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| format!("Failed to delete team: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_teams(app_handle: tauri::AppHandle) -> Result<Vec<TeamJson>, String> {
    let conn = conn_from_app(&app_handle)?;
    let mut stmt = conn.prepare("SELECT id, name, description, created_by, created_at, updated_at FROM teams ORDER BY name")
        .map_err(|e| format!("Query error: {}", e))?;
    let rows = stmt.query_map([], |row| {
        Ok(TeamJson {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            created_by: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| format!("Query error: {}", e))?;
    let mut teams = Vec::new();
    for row in rows {
        teams.push(row.map_err(|e| format!("Row error: {}", e))?);
    }
    Ok(teams)
}

#[tauri::command]
fn get_team(app_handle: tauri::AppHandle, id: i64) -> Result<TeamJson, String> {
    let conn = conn_from_app(&app_handle)?;
    conn.query_row(
        "SELECT id, name, description, created_by, created_at, updated_at FROM teams WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok(TeamJson {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            created_by: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        }),
    ).map_err(|e| format!("Team not found: {}", e))
}

#[tauri::command]
fn get_team_members(app_handle: tauri::AppHandle, team_id: i64) -> Result<Vec<TeamMemberJson>, String> {
    let conn = conn_from_app(&app_handle)?;
    let mut stmt = conn.prepare(
        "SELECT tm.id, tm.team_id, tm.user_id, tm.is_manager, tm.created_at FROM team_members tm INNER JOIN users u ON u.id = tm.user_id WHERE tm.team_id = ?1 ORDER BY u.full_name"
    ).map_err(|e| format!("Query error: {}", e))?;
    let rows = stmt.query_map(rusqlite::params![team_id], |row| {
        Ok(TeamMemberJson {
            id: row.get(0)?,
            team_id: row.get(1)?,
            user_id: row.get(2)?,
            is_manager: row.get::<_, i64>(3)? != 0,
            created_at: row.get(4)?,
        })
    }).map_err(|e| format!("Query error: {}", e))?;
    let mut members = Vec::new();
    for row in rows {
        members.push(row.map_err(|e| format!("Row error: {}", e))?);
    }
    Ok(members)
}

#[tauri::command]
fn add_team_member(app_handle: tauri::AppHandle, team_id: i64, user_id: i64, is_manager: bool) -> Result<(), String> {
    let conn = conn_from_app(&app_handle)?;
    conn.execute(
        "INSERT OR IGNORE INTO team_members (team_id, user_id, is_manager) VALUES (?1, ?2, ?3)",
        rusqlite::params![team_id, user_id, is_manager as i64],
    ).map_err(|e| format!("Failed to add member: {}", e))?;
    Ok(())
}

#[tauri::command]
fn remove_team_member(app_handle: tauri::AppHandle, team_id: i64, user_id: i64) -> Result<(), String> {
    let conn = conn_from_app(&app_handle)?;
    conn.execute(
        "DELETE FROM team_members WHERE team_id = ?1 AND user_id = ?2",
        rusqlite::params![team_id, user_id],
    ).map_err(|e| format!("Failed to remove member: {}", e))?;
    Ok(())
}

#[tauri::command]
fn set_team_manager(app_handle: tauri::AppHandle, team_id: i64, user_id: i64, is_manager: bool) -> Result<(), String> {
    let conn = conn_from_app(&app_handle)?;
    conn.execute(
        "UPDATE team_members SET is_manager = ?1 WHERE team_id = ?2 AND user_id = ?3",
        rusqlite::params![is_manager as i64, team_id, user_id],
    ).map_err(|e| format!("Failed to set manager: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_managed_teams(app_handle: tauri::AppHandle, user_id: i64) -> Result<Vec<TeamJson>, String> {
    let conn = conn_from_app(&app_handle)?;
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name, t.description, t.created_by, t.created_at, t.updated_at FROM teams t INNER JOIN team_members tm ON tm.team_id = t.id WHERE tm.user_id = ?1 AND tm.is_manager = 1 ORDER BY t.name"
    ).map_err(|e| format!("Query error: {}", e))?;
    let rows = stmt.query_map(rusqlite::params![user_id], |row| {
        Ok(TeamJson {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            created_by: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| format!("Query error: {}", e))?;
    let mut teams = Vec::new();
    for row in rows {
        teams.push(row.map_err(|e| format!("Row error: {}", e))?);
    }
    Ok(teams)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: include_str!("../db/migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create tasks, time_entries, activity_logs tables",
            sql: include_str!("../db/migrations/002_tasks_timer.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create sync_queue table",
            sql: include_str!("../db/migrations/003_sync.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add password_hash column to users",
            sql: include_str!("../db/migrations/004_add_password_hash.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create app_usage table",
            sql: include_str!("../db/migrations/005_app_usage.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create teams and team_members tables",
            sql: include_str!("../db/migrations/006_teams.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:timesync.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            app.manage(AppTrackerState::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            hash_password,
            verify_password,
            register_local_user,
            login_local_user,
            seed_demo_users,
            create_team,
            update_team,
            delete_team,
            get_teams,
            get_team,
            get_team_members,
            add_team_member,
            remove_team_member,
            set_team_manager,
            get_managed_teams,
            app_tracker::start_app_tracking,
            app_tracker::stop_app_tracking,
            app_tracker::set_idle_state,
            app_tracker::get_app_usage,
            app_tracker::get_today_app_usage,
            app_tracker::get_app_usage_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
