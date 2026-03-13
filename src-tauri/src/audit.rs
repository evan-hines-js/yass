use serde_json::Value;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn log_action(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
    entity_name: &str,
    action: &str,
    changes: Option<Value>,
) -> Result<(), sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let changes_str = changes.map(|v| v.to_string());
    sqlx::query(
        "INSERT INTO audit_log (id, entity_type, entity_id, entity_name, action, changes) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(entity_type)
    .bind(entity_id)
    .bind(entity_name)
    .bind(action)
    .bind(changes_str)
    .execute(pool)
    .await?;
    Ok(())
}

pub fn diff(old: &Value, new: &Value) -> Option<Value> {
    let old_obj = old.as_object()?;
    let new_obj = new.as_object()?;
    let mut changes = serde_json::Map::new();

    for (key, new_val) in new_obj {
        if let Some(old_val) = old_obj.get(key) {
            if old_val != new_val {
                changes.insert(
                    key.clone(),
                    serde_json::json!({"old": old_val, "new": new_val}),
                );
            }
        }
    }

    if changes.is_empty() {
        None
    } else {
        Some(Value::Object(changes))
    }
}
