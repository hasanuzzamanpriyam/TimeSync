use rusqlite::Connection;
use serde::Serialize;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

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
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
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
        "INSERT INTO users (username, email, role, full_name, is_active, password_hash) VALUES (?1, ?2, 'user', ?3, 1, ?4)",
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
    let mut conn = Connection::open(&db_path).map_err(|e| format!("DB open error: {}", e))?;

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
        "INSERT OR IGNORE INTO users (username, email, role, full_name, is_active, password_hash) VALUES ('user', 'user@timesync.local', 'user', 'Demo User', 1, ?1)",
        rusqlite::params![user_hash],
    )
    .map_err(|e| format!("Failed to seed user: {}", e))?;

    Ok(())
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
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:timesync.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            hash_password,
            verify_password,
            register_local_user,
            login_local_user,
            seed_demo_users,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
