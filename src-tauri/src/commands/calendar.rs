use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct CalendarEvent {
    pub date: String,
    pub event_type: String, // "expiration", "task_due", "received"
    pub label: String,
    pub entity_id: String,
    pub is_overdue: bool,
    pub count: i64,
}

#[tauri::command]
pub async fn get_calendar(
    year: i32,
    month: i32,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<CalendarEvent>, String> {
    let start = format!("{year:04}-{month:02}-01");
    let end = if month == 12 {
        format!("{:04}-01-01", year + 1)
    } else {
        format!("{year:04}-{:02}-01", month + 1)
    };

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let mut events: Vec<CalendarEvent> = Vec::new();

    // Items received (created) this month — rolled up by name + date + expiration_date
    let received: Vec<(String, String, Option<String>, i64)> = sqlx::query_as(
        r#"
        SELECT name, date(created_at) as created_date, expiration_date, COUNT(*) as cnt
        FROM items
        WHERE date(created_at) >= ? AND date(created_at) < ?
        GROUP BY name, date(created_at), expiration_date
        ORDER BY created_date ASC
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    for (name, date, _exp, count) in received {
        let label = if count > 1 {
            format!("{name} x{count} received")
        } else {
            format!("{name} received")
        };
        events.push(CalendarEvent {
            date,
            event_type: "received".to_string(),
            label,
            entity_id: String::new(),
            is_overdue: false,
            count,
        });
    }

    // Food item expirations — rolled up by name + expiration_date
    let expirations: Vec<(String, String, i64)> = sqlx::query_as(
        r#"
        SELECT name, expiration_date, COUNT(*) as cnt
        FROM items
        WHERE removed_at IS NULL
          AND expiration_date IS NOT NULL
          AND expiration_date >= ? AND expiration_date < ?
        GROUP BY name, expiration_date
        ORDER BY expiration_date ASC
        "#,
    )
    .bind(&start)
    .bind(&end)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    for (name, exp_date, count) in expirations {
        let is_overdue = exp_date.as_str() < today.as_str();
        let label = if count > 1 {
            format!("{name} x{count} expires")
        } else {
            format!("{name} expires")
        };
        events.push(CalendarEvent {
            date: exp_date,
            event_type: "expiration".to_string(),
            label,
            entity_id: String::new(),
            is_overdue,
            count,
        });
    }

    // Task due dates
    let tasks: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT id, name, next_due_at FROM recurring_tasks WHERE removed_at IS NULL AND next_due_at >= ? AND next_due_at < ?",
    )
    .bind(&start)
    .bind(&end)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    for (id, name, due) in tasks {
        events.push(CalendarEvent {
            date: due.clone(),
            event_type: "task_due".to_string(),
            label: name,
            entity_id: id,
            is_overdue: due.as_str() < today.as_str(),
            count: 1,
        });
    }

    events.sort_by(|a, b| a.date.cmp(&b.date));
    Ok(events)
}
