use crate::audit;
use crate::commands::undo::save_undo;
use crate::models::Item;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

/// A restock/buy-again candidate: any item she's ever had, deduped by name.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RestockCandidate {
    pub id: String,
    pub name: String,
    pub expiration_date: Option<String>,
    pub removed_at: Option<String>,
    pub removed_reason: Option<String>,
    pub in_stock: bool,
}

#[derive(Debug, Deserialize)]
pub struct RestockEntry {
    pub source_id: String,
    pub expiration_date: Option<String>,
}

#[tauri::command]
pub async fn get_restock_candidates(pool: State<'_, SqlitePool>) -> Result<Vec<RestockCandidate>, String> {
    let candidates = sqlx::query_as::<_, RestockCandidate>(
        r#"
        SELECT c.id, c.name,
               c.expiration_date, c.removed_at, c.removed_reason, c.in_stock
        FROM (
            SELECT id, name,
                   expiration_date, NULL as removed_at, NULL as removed_reason,
                   1 as in_stock
            FROM items
            WHERE removed_at IS NULL AND hidden_from_restock = 0
            GROUP BY name
            HAVING created_at = MAX(created_at)

            UNION ALL

            SELECT r.id, r.name,
                   r.expiration_date, r.removed_at, r.removed_reason,
                   0 as in_stock
            FROM items r
            INNER JOIN (
                SELECT name, MAX(removed_at) as max_removed
                FROM items
                WHERE removed_at IS NOT NULL AND hidden_from_restock = 0
                GROUP BY name
            ) latest ON r.name = latest.name AND r.removed_at = latest.max_removed
            WHERE r.name NOT IN (
                SELECT name FROM items WHERE removed_at IS NULL
            )
            AND r.hidden_from_restock = 0
        ) c
        LEFT JOIN (
            SELECT name, SUM(1.0 / (julianday('now') - julianday(created_at) + 1)) as freq
            FROM items
            WHERE hidden_from_restock = 0
            GROUP BY name
        ) f ON c.name = f.name
        GROUP BY c.name
        ORDER BY COALESCE(f.freq, 0) DESC
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(candidates)
}

/// Hide an item (by name) from the Buy Again list without affecting inventory.
#[tauri::command]
pub async fn hide_from_restock(
    id: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    // Get the item name, then hide ALL items with that name from restock
    let name: (String,) = sqlx::query_as("SELECT name FROM items WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE items SET hidden_from_restock = 1, updated_at = datetime('now') WHERE name = ?",
    )
    .bind(&name.0)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    save_undo(
        pool.inner(), "restock", "hide",
        &json!({ "type": "hide", "name": name.0 }),
        &format!("Hid {}", name.0),
    ).await?;

    Ok(())
}

#[tauri::command]
pub async fn bulk_restock(
    entries: Vec<RestockEntry>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Item>, String> {
    let mut results = Vec::new();

    for entry in entries {
        let source = sqlx::query_as::<_, Item>("SELECT * FROM items WHERE id = ?")
            .bind(&entry.source_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

        let id = Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO items (id, name, expiration_date, notes)
             VALUES (?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&source.name)
        .bind(&entry.expiration_date)
        .bind(&source.notes)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        audit::log_action(
            pool.inner(), "item", &id, &source.name, "restocked",
            Some(json!({
                "from_item": entry.source_id,
                "name": source.name,
                "expiration_date": entry.expiration_date,
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

    let created_ids: Vec<&str> = results.iter().map(|i| i.id.as_str()).collect();
    let n = results.len();
    save_undo(
        pool.inner(), "restock", "restock",
        &json!({ "type": "restock", "created_ids": created_ids }),
        &format!("Restocked {} item{}", n, if n == 1 { "" } else { "s" }),
    ).await?;

    Ok(results)
}
