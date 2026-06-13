use tauri_plugin_sql::{Migration, MigrationKind};

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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
