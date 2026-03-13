use crate::models::{Item, RecurringTask};
use chrono::Datelike;
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct WhatsNext {
    /// "scheduled_task", "expiring_today", "low_task", "expiring_soon", "none"
    pub kind: String,
    /// Route to navigate to
    pub route: String,
    /// Human-readable label for the toast
    pub label: String,
}

#[tauri::command]
pub async fn get_whats_next(pool: State<'_, SqlitePool>) -> Result<WhatsNext, String> {
    let now = chrono::Local::now().date_naive();
    let today = now.format("%Y-%m-%d").to_string();

    // Weekday-aware "soon" window (same as dashboard)
    let extra = match now.weekday() {
        chrono::Weekday::Mon => 1,
        chrono::Weekday::Wed => 1,
        chrono::Weekday::Fri => 2,
        _ => 0,
    };
    let soon = (now + chrono::Duration::days(5 + extra))
        .format("%Y-%m-%d")
        .to_string();

    // 1. Scheduled tasks due today (priority > 0 OR has due_time), ordered by due_time
    let scheduled: Vec<RecurringTask> = sqlx::query_as(
        "SELECT * FROM recurring_tasks
         WHERE removed_at IS NULL AND next_due_at <= ?
           AND (priority > 0 OR due_time IS NOT NULL)
         ORDER BY due_time ASC NULLS LAST, priority DESC
         LIMIT 1",
    )
    .bind(&today)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if let Some(task) = scheduled.first() {
        let time_label = task.due_time.as_deref().unwrap_or("");
        let label = if time_label.is_empty() {
            task.name.clone()
        } else {
            format!("{} ({})", task.name, time_label)
        };
        return Ok(WhatsNext {
            kind: "scheduled_task".into(),
            route: "/tasks".into(),
            label,
        });
    }

    // 2. Items expiring TODAY
    let expiring_today: Vec<Item> = sqlx::query_as(
        "SELECT * FROM items
         WHERE removed_at IS NULL AND expiration_date IS NOT NULL AND expiration_date <= ?
         ORDER BY expiration_date ASC
         LIMIT 1",
    )
    .bind(&today)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if let Some(item) = expiring_today.first() {
        return Ok(WhatsNext {
            kind: "expiring_today".into(),
            route: "/inventory".into(),
            label: format!("{} expires today", item.name),
        });
    }

    // 3. Low-priority tasks due today (priority = 0, no due_time)
    let low_tasks: Vec<RecurringTask> = sqlx::query_as(
        "SELECT * FROM recurring_tasks
         WHERE removed_at IS NULL AND next_due_at <= ?
           AND priority = 0 AND due_time IS NULL
         ORDER BY next_due_at ASC
         LIMIT 1",
    )
    .bind(&today)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if let Some(task) = low_tasks.first() {
        return Ok(WhatsNext {
            kind: "low_task".into(),
            route: "/tasks".into(),
            label: task.name.clone(),
        });
    }

    // 4. Items expiring soon (within 5 days)
    let expiring_soon: Vec<Item> = sqlx::query_as(
        "SELECT * FROM items
         WHERE removed_at IS NULL AND expiration_date IS NOT NULL
           AND expiration_date > ? AND expiration_date <= ?
         ORDER BY expiration_date ASC
         LIMIT 1",
    )
    .bind(&today)
    .bind(&soon)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if let Some(item) = expiring_soon.first() {
        return Ok(WhatsNext {
            kind: "expiring_soon".into(),
            route: "/inventory".into(),
            label: format!("{} expires {}", item.name, item.expiration_date.as_deref().unwrap_or("")),
        });
    }

    Ok(WhatsNext {
        kind: "none".into(),
        route: "/".into(),
        label: "All caught up!".into(),
    })
}
