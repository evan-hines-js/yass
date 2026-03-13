use crate::audit;
use crate::commands::undo::save_undo;
use crate::models::{CreateTask, RecurringTask, TaskCompletion, UpdateTask};
use chrono::{Datelike, Local, NaiveDate};
use serde_json::json;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

/// Given a comma-separated list of weekday numbers (0=Sun..6=Sat) and a
/// reference date, return the next matching weekday strictly after `from`.
fn next_matching_day(from: NaiveDate, weekdays: &str) -> NaiveDate {
    let days: Vec<u32> = weekdays
        .split(',')
        .filter_map(|s| s.trim().parse::<u32>().ok())
        .collect();
    if days.is_empty() {
        return from + chrono::Duration::days(1);
    }
    for offset in 1..=7 {
        let candidate = from + chrono::Duration::days(offset);
        let dow = candidate.weekday().num_days_from_sunday(); // 0=Sun
        if days.contains(&dow) {
            return candidate;
        }
    }
    from + chrono::Duration::days(1) // fallback
}

/// Advance `date` forward until it lands on one of the given weekdays.
fn snap_to_weekday(date: NaiveDate, weekdays: &str) -> NaiveDate {
    let days: Vec<u32> = weekdays
        .split(',')
        .filter_map(|s| s.trim().parse::<u32>().ok())
        .collect();
    if days.is_empty() {
        return date;
    }
    let dow = date.weekday().num_days_from_sunday();
    if days.contains(&dow) {
        return date;
    }
    // Roll forward up to 6 days
    for offset in 1..=6 {
        let candidate = date + chrono::Duration::days(offset);
        let d = candidate.weekday().num_days_from_sunday();
        if days.contains(&d) {
            return candidate;
        }
    }
    date
}

#[tauri::command]
pub async fn get_tasks(
    include_removed: Option<bool>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<RecurringTask>, String> {
    let include_removed = include_removed.unwrap_or(false);
    if include_removed {
        sqlx::query_as::<_, RecurringTask>(
            "SELECT * FROM recurring_tasks ORDER BY removed_at ASC NULLS FIRST, next_due_at ASC",
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())
    } else {
        sqlx::query_as::<_, RecurringTask>(
            "SELECT * FROM recurring_tasks WHERE removed_at IS NULL ORDER BY next_due_at ASC",
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn create_task(
    input: CreateTask,
    pool: State<'_, SqlitePool>,
) -> Result<RecurringTask, String> {
    let id = Uuid::new_v4().to_string();
    let today = Local::now().date_naive();
    let next_due = match &input.weekdays {
        Some(wd) => snap_to_weekday(today, wd),
        None => today + chrono::Duration::days(input.interval_days as i64),
    }
    .format("%Y-%m-%d")
    .to_string();

    let priority = input.priority.unwrap_or(0);

    sqlx::query(
        "INSERT INTO recurring_tasks (id, name, description, interval_days, weekdays, next_due_at, priority, due_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(input.interval_days)
    .bind(&input.weekdays)
    .bind(&next_due)
    .bind(priority)
    .bind(&input.due_time)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    audit::log_action(
        pool.inner(), "task", &id, &input.name, "added",
        Some(json!({
            "name": input.name,
            "interval_days": input.interval_days,
            "weekdays": input.weekdays,
            "description": input.description,
            "priority": priority,
            "due_time": input.due_time,
        })),
    )
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, RecurringTask>("SELECT * FROM recurring_tasks WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_task(
    id: String,
    input: UpdateTask,
    pool: State<'_, SqlitePool>,
) -> Result<RecurringTask, String> {
    let existing = sqlx::query_as::<_, RecurringTask>(
        "SELECT * FROM recurring_tasks WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let name = input.name.unwrap_or(existing.name.clone());
    let description = input.description.or(existing.description.clone());
    let interval_days = input.interval_days.unwrap_or(existing.interval_days);
    let weekdays = input.weekdays.or(existing.weekdays.clone());
    let priority = input.priority.unwrap_or(existing.priority);
    let due_time = input.due_time.or(existing.due_time.clone());

    let old_json = json!({
        "name": existing.name, "description": existing.description,
        "interval_days": existing.interval_days, "weekdays": existing.weekdays,
        "priority": existing.priority, "due_time": existing.due_time,
    });
    let new_json = json!({
        "name": name, "description": description,
        "interval_days": interval_days, "weekdays": weekdays,
        "priority": priority, "due_time": due_time,
    });

    sqlx::query(
        "UPDATE recurring_tasks SET name = ?, description = ?, interval_days = ?, weekdays = ?, priority = ?, due_time = ?
         WHERE id = ?",
    )
    .bind(&name)
    .bind(&description)
    .bind(interval_days)
    .bind(&weekdays)
    .bind(priority)
    .bind(&due_time)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if let Some(changes) = audit::diff(&old_json, &new_json) {
        audit::log_action(pool.inner(), "task", &id, &name, "updated", Some(changes))
            .await
            .map_err(|e| e.to_string())?;
    }

    sqlx::query_as::<_, RecurringTask>("SELECT * FROM recurring_tasks WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())
}

/// Soft-remove a task. Row stays forever.
#[tauri::command]
pub async fn remove_task(id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    let task = sqlx::query_as::<_, RecurringTask>(
        "SELECT * FROM recurring_tasks WHERE id = ? AND removed_at IS NULL",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    sqlx::query("UPDATE recurring_tasks SET removed_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    audit::log_action(pool.inner(), "task", &id, &task.name, "removed", None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn complete_task(
    id: String,
    notes: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<TaskCompletion, String> {
    let task = sqlx::query_as::<_, RecurringTask>(
        "SELECT * FROM recurring_tasks WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let now = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let today = Local::now().date_naive();
    let next_due = match &task.weekdays {
        // Specific weekday schedule (e.g. "1,3,5" for M/W/F): find the next matching day
        Some(wd) if task.interval_days <= 1 => next_matching_day(today, wd),
        // Interval-based but constrained to certain weekdays: add interval then snap forward
        Some(wd) => snap_to_weekday(today + chrono::Duration::days(task.interval_days as i64), wd),
        // No weekday constraint: simple interval
        None => today + chrono::Duration::days(task.interval_days as i64),
    };

    let completion_id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO task_completions (id, task_id, completed_at, notes) VALUES (?, ?, ?, ?)",
    )
    .bind(&completion_id)
    .bind(&id)
    .bind(&now)
    .bind(&notes)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE recurring_tasks SET last_completed = ?, next_due_at = ? WHERE id = ?",
    )
    .bind(&now)
    .bind(next_due.format("%Y-%m-%d").to_string())
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    audit::log_action(
        pool.inner(), "task", &id, &task.name, "completed",
        Some(json!({"notes": notes})),
    )
    .await
    .map_err(|e| e.to_string())?;

    save_undo(
        pool.inner(), "tasks", "complete",
        &json!({
            "type": "complete",
            "task_id": id,
            "completion_id": completion_id,
            "prev_last_completed": task.last_completed,
            "prev_next_due_at": task.next_due_at,
        }),
        &format!("Completed {}", task.name),
    ).await?;

    sqlx::query_as::<_, TaskCompletion>("SELECT * FROM task_completions WHERE id = ?")
        .bind(&completion_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())
}
