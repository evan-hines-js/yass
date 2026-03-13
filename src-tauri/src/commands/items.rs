use crate::audit;
use crate::models::{CreateItem, Item, UpdateItem};
use serde_json::json;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

fn normalize_name(name: &str) -> String {
    name.trim().to_lowercase()
}

#[tauri::command]
pub async fn get_items(
    include_removed: Option<bool>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Item>, String> {
    let include_removed = include_removed.unwrap_or(false);
    if include_removed {
        sqlx::query_as::<_, Item>("SELECT * FROM items ORDER BY removed_at DESC NULLS FIRST, expiration_date ASC NULLS LAST")
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())
    } else {
        sqlx::query_as::<_, Item>("SELECT * FROM items WHERE removed_at IS NULL ORDER BY expiration_date ASC NULLS LAST")
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn get_item(id: String, pool: State<'_, SqlitePool>) -> Result<Item, String> {
    sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_item(
    input: CreateItem,
    pool: State<'_, SqlitePool>,
) -> Result<Item, String> {
    let id = Uuid::new_v4().to_string();
    let name = normalize_name(&input.name);

    sqlx::query(
        "INSERT INTO items (id, name, expiration_date, notes)
         VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&name)
    .bind(&input.expiration_date)
    .bind(&input.notes)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    audit::log_action(
        pool.inner(), "item", &id, &name, "added",
        Some(json!({
            "name": name,
            "expiration_date": input.expiration_date,
        })),
    )
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_item(
    id: String,
    input: UpdateItem,
    pool: State<'_, SqlitePool>,
) -> Result<Item, String> {
    let existing = sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    let name = input.name.map(|n| normalize_name(&n)).unwrap_or(existing.name.clone());
    let expiration_date = input.expiration_date.or(existing.expiration_date.clone());
    let notes = input.notes.or(existing.notes.clone());

    let old_json = json!({
        "name": existing.name,
        "expiration_date": existing.expiration_date,
        "notes": existing.notes,
    });
    let new_json = json!({
        "name": name,
        "expiration_date": expiration_date,
        "notes": notes,
    });

    sqlx::query(
        "UPDATE items SET name = ?,
         expiration_date = ?, notes = ?, updated_at = datetime('now')
         WHERE id = ?"
    )
    .bind(&name)
    .bind(&expiration_date)
    .bind(&notes)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if let Some(changes) = audit::diff(&old_json, &new_json) {
        audit::log_action(pool.inner(), "item", &id, &name, "updated", Some(changes))
            .await
            .map_err(|e| e.to_string())?;
    }

    sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())
}

/// Soft-remove an item from inventory. The row stays in the DB forever.
#[tauri::command]
pub async fn remove_item(
    id: String,
    reason: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let item = sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = ? AND removed_at IS NULL")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let reason = reason.unwrap_or_else(|| "tossed".to_string());

    sqlx::query("UPDATE items SET removed_at = ?, removed_reason = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(&now)
        .bind(&reason)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    audit::log_action(
        pool.inner(), "item", &id, &item.name, "removed",
        Some(json!({
            "reason": reason,
            "name": item.name,
            "expiration_date": item.expiration_date,
        })),
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Bulk create items from CSV import.
#[tauri::command]
pub async fn bulk_create_items(
    items: Vec<CreateItem>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Item>, String> {
    let mut results = Vec::new();

    for input in items {
        let id = Uuid::new_v4().to_string();
        let name = normalize_name(&input.name);

        sqlx::query(
            "INSERT INTO items (id, name, expiration_date, notes)
             VALUES (?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&name)
        .bind(&input.expiration_date)
        .bind(&input.notes)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        audit::log_action(
            pool.inner(), "item", &id, &name, "imported",
            Some(json!({
                "name": name,
                "expiration_date": input.expiration_date,
            })),
        )
        .await
        .map_err(|e| e.to_string())?;

        let item = sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = ?")
            .bind(&id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

        results.push(item);
    }

    Ok(results)
}
