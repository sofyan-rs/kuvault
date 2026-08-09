use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_URL: &str = "sqlite:kuvault.db";

/// Some older builds resolved the sqlite path under `%LOCALAPPDATA%\KuVault` instead of
/// the `%APPDATA%\KuVault` folder tauri-plugin-sql resolves to today, which made users'
/// existing library appear to vanish after updating. If no db exists yet at the current
/// location but one is found at the legacy location, copy it over before the plugin opens it.
#[cfg(windows)]
pub fn migrate_legacy_db_location() {
    let (Ok(appdata), Ok(local_appdata)) = (
        std::env::var("APPDATA"),
        std::env::var("LOCALAPPDATA"),
    ) else {
        return;
    };

    let current = std::path::PathBuf::from(appdata).join("KuVault").join("kuvault.db");
    let legacy = std::path::PathBuf::from(local_appdata).join("KuVault").join("kuvault.db");

    if current.exists() || !legacy.exists() {
        return;
    }

    if let Some(parent) = current.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            log::warn!("failed to create app data dir for legacy db migration: {e}");
            return;
        }
    }

    match std::fs::copy(&legacy, &current) {
        Ok(_) => log::info!("migrated legacy db from {legacy:?} to {current:?}"),
        Err(e) => log::warn!("failed to migrate legacy db: {e}"),
    }
}

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create games and settings tables",
            sql: include_str!("../../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "drop unused installed column",
            sql: include_str!("../../migrations/0002_drop_installed.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add run_as_admin column",
            sql: include_str!("../../migrations/0003_add_run_as_admin.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
