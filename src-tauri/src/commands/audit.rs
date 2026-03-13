use crate::models::AuditEntry;
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn get_audit_log(
    entity_type: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<AuditEntry>, String> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let entries = if let Some(et) = entity_type {
        sqlx::query_as::<_, AuditEntry>(
            "SELECT * FROM audit_log WHERE entity_type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(et)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, AuditEntry>(
            "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    };
    Ok(entries)
}
