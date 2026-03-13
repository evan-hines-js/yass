use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;
use tauri::{AppHandle, Manager};

pub async fn init(app: &AppHandle) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    std::fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("yass.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let opts = SqliteConnectOptions::from_str(&db_url)?
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    log::info!("Database initialized at {}", db_path.display());
    Ok(pool)
}
