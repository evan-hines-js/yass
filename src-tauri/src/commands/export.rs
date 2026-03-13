use crate::models::AuditEntry;
use sqlx::SqlitePool;
use std::io::Write;
use tauri::State;

#[tauri::command]
pub async fn export_audit_csv(
    path: String,
    pool: State<'_, SqlitePool>,
) -> Result<u64, String> {
    let entries = sqlx::query_as::<_, AuditEntry>(
        "SELECT * FROM audit_log ORDER BY created_at DESC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let count = entries.len() as u64;

    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;

    // Header
    writeln!(file, "id,entity_type,entity_id,entity_name,action,changes,created_at")
        .map_err(|e| e.to_string())?;

    for entry in &entries {
        writeln!(
            file,
            "{},{},{},{},{},{},{}",
            csv_escape(&entry.id),
            csv_escape(&entry.entity_type),
            csv_escape(&entry.entity_id),
            csv_escape(&entry.entity_name),
            csv_escape(&entry.action),
            csv_escape(&entry.changes.as_deref().unwrap_or("")),
            csv_escape(&entry.created_at),
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(count)
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}
