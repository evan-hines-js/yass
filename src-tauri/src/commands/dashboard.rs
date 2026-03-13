use chrono::Datelike;
use crate::models::{Item, RecurringTask};
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_items: i64,
    pub expiring_soon: i64,
    pub tasks_completed_this_week: i64,
    pub overdue_tasks: i64,
}

#[derive(Debug, Serialize)]
pub struct DailyDashboard {
    pub expiring_items: Vec<Item>,
    pub tasks_due: Vec<RecurringTask>,
    pub overdue_tasks: Vec<RecurringTask>,
    pub stats: DashboardStats,
}

#[tauri::command]
pub async fn get_daily_dashboard(pool: State<'_, SqlitePool>) -> Result<DailyDashboard, String> {
    let now = chrono::Local::now().date_naive();
    let today = now.format("%Y-%m-%d").to_string();
    // She works Mon/Wed/Fri. Pull forward the 5-day window to cover off days:
    // Mon(0)->include Tue(+1), Wed(2)->include Thu(+1), Fri(4)->include Sat+Sun(+2)
    let extra = match now.weekday() {
        chrono::Weekday::Mon => 1,
        chrono::Weekday::Wed => 1,
        chrono::Weekday::Fri => 2,
        _ => 0,
    };
    let five_days = (now + chrono::Duration::days(5 + extra))
        .format("%Y-%m-%d")
        .to_string();
    let week_ago = (now - chrono::Duration::days(7))
        .format("%Y-%m-%dT00:00:00")
        .to_string();

    let expiring_items = sqlx::query_as::<_, Item>(
        "SELECT * FROM items WHERE removed_at IS NULL AND expiration_date IS NOT NULL AND expiration_date <= ? ORDER BY expiration_date ASC",
    )
    .bind(&five_days)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let tasks_due = sqlx::query_as::<_, RecurringTask>(
        "SELECT * FROM recurring_tasks WHERE removed_at IS NULL AND next_due_at <= ? ORDER BY next_due_at ASC",
    )
    .bind(&today)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let overdue_tasks = sqlx::query_as::<_, RecurringTask>(
        "SELECT * FROM recurring_tasks WHERE removed_at IS NULL AND next_due_at < ? ORDER BY next_due_at ASC",
    )
    .bind(&today)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let total_items: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM items WHERE removed_at IS NULL")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    let expiring_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM items WHERE removed_at IS NULL AND expiration_date IS NOT NULL AND expiration_date <= ?",
    )
    .bind(&five_days)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let completed_week: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM task_completions WHERE completed_at >= ?",
    )
    .bind(&week_ago)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let overdue_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM recurring_tasks WHERE removed_at IS NULL AND next_due_at < ?",
    )
    .bind(&today)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(DailyDashboard {
        expiring_items,
        tasks_due,
        overdue_tasks,
        stats: DashboardStats {
            total_items: total_items.0,
            expiring_soon: expiring_count.0,
            tasks_completed_this_week: completed_week.0,
            overdue_tasks: overdue_count.0,
        },
    })
}
