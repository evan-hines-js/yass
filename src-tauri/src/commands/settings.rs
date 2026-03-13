use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn get_setting(key: String, pool: State<'_, SqlitePool>) -> Result<Option<String>, String> {
    let result: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = ?")
            .bind(&key)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    Ok(result.map(|r| r.0))
}

#[tauri::command]
pub async fn set_setting(key: String, value: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&key)
    .bind(&value)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}
