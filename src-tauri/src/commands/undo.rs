use crate::audit;
use crate::models::UndoAction;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

const MAX_UNDO_PER_PAGE: i64 = 20;

/// Internal helper — push an undo entry onto the per-page stack (max 20 deep).
pub async fn save_undo(
    pool: &SqlitePool,
    page: &str,
    action: &str,
    payload: &Value,
    label: &str,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO undo_stack (id, page, action, payload, label)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(page)
    .bind(action)
    .bind(payload.to_string())
    .bind(label)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Trim oldest entries beyond the limit
    sqlx::query(
        "DELETE FROM undo_stack WHERE page = ? AND id NOT IN (
            SELECT id FROM undo_stack WHERE page = ? ORDER BY created_at DESC LIMIT ?
         )",
    )
    .bind(page)
    .bind(page)
    .bind(MAX_UNDO_PER_PAGE)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_undo(page: String, pool: State<'_, SqlitePool>) -> Result<Option<UndoAction>, String> {
    sqlx::query_as::<_, UndoAction>(
        "SELECT * FROM undo_stack WHERE page = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(&page)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn push_undo(
    page: String,
    action: String,
    payload: String,
    label: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let payload_val: Value = serde_json::from_str(&payload)
        .map_err(|e| format!("Invalid JSON payload: {e}"))?;
    save_undo(pool.inner(), &page, &action, &payload_val, &label).await
}

#[tauri::command]
pub async fn execute_undo(page: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    let undo = sqlx::query_as::<_, UndoAction>(
        "SELECT * FROM undo_stack WHERE page = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(&page)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let undo = match undo {
        Some(u) => u,
        None => return Err("Nothing to undo".into()),
    };

    let payload: Value = serde_json::from_str(&undo.payload)
        .map_err(|e| format!("Corrupt undo payload: {e}"))?;

    match payload.get("type").and_then(|v| v.as_str()) {
        Some("toss_full") | Some("remove") => restore_items(pool.inner(), &payload).await?,
        Some("complete") => undo_complete(pool.inner(), &payload).await?,
        Some("restock") => undo_restock(pool.inner(), &payload).await?,
        Some("hide") => undo_hide(pool.inner(), &payload).await?,
        other => return Err(format!("Unknown undo type: {other:?}")),
    }

    // Delete only the entry we just undid
    sqlx::query("DELETE FROM undo_stack WHERE id = ?")
        .bind(&undo.id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Audit log
    audit::log_action(
        pool.inner(),
        "undo",
        &undo.id,
        &undo.label,
        "undone",
        Some(json!({ "action": undo.action, "page": undo.page })),
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Restore soft-removed items by clearing removed_at/removed_reason.
/// Shared by toss_full and remove undo.
async fn restore_items(pool: &SqlitePool, payload: &Value) -> Result<(), String> {
    let ids = payload
        .get("item_ids")
        .and_then(|v| v.as_array())
        .ok_or("Missing item_ids in payload")?;
    for id in ids {
        let id = id.as_str().ok_or("Invalid item_id")?;
        sqlx::query(
            "UPDATE items SET removed_at = NULL, removed_reason = NULL, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Undo complete: delete the completion record, restore last_completed and next_due_at
async fn undo_complete(pool: &SqlitePool, payload: &Value) -> Result<(), String> {
    let task_id = payload
        .get("task_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing task_id")?;
    let completion_id = payload
        .get("completion_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing completion_id")?;

    // prev_last_completed can be null
    let prev_last_completed = payload
        .get("prev_last_completed")
        .and_then(|v| v.as_str());
    let prev_next_due_at = payload
        .get("prev_next_due_at")
        .and_then(|v| v.as_str())
        .ok_or("Missing prev_next_due_at")?;

    sqlx::query("DELETE FROM task_completions WHERE id = ?")
        .bind(completion_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE recurring_tasks SET last_completed = ?, next_due_at = ? WHERE id = ?")
        .bind(prev_last_completed)
        .bind(prev_next_due_at)
        .bind(task_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Undo restock: delete the newly created items
async fn undo_restock(pool: &SqlitePool, payload: &Value) -> Result<(), String> {
    let ids = payload
        .get("created_ids")
        .and_then(|v| v.as_array())
        .ok_or("Missing created_ids in restock payload")?;
    for id in ids {
        let id = id.as_str().ok_or("Invalid created_id")?;
        sqlx::query("DELETE FROM items WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Undo hide: set hidden_from_restock = 0 on all items with this name
async fn undo_hide(pool: &SqlitePool, payload: &Value) -> Result<(), String> {
    let name = payload
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("Missing name in hide payload")?;
    sqlx::query(
        "UPDATE items SET hidden_from_restock = 0, updated_at = datetime('now') WHERE name = ?",
    )
    .bind(name)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}
