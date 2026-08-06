use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_URL: &str = "sqlite:kuvault.db";

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create games and settings tables",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "drop unused installed column",
            sql: include_str!("../migrations/0002_drop_installed.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add run_as_admin column",
            sql: include_str!("../migrations/0003_add_run_as_admin.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
