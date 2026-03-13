use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct Analytics {
    /// Average days remaining before expiration when items were tossed.
    /// Positive = tossed before expiry (good). Negative = tossed after expiry (waste).
    pub avg_days_to_expiry_at_toss: Option<f64>,
    /// How many items were tossed BEFORE their expiration date
    pub tossed_before_expiry: i64,
    /// How many items were tossed AFTER their expiration date
    pub tossed_after_expiry: i64,
    /// Items tossed with >5 days remaining (thrown away too early)
    pub tossed_too_early: i64,
    /// Total items ever tossed
    pub total_tossed: i64,
    /// Total items ever added
    pub total_items_added: i64,
    /// Total tasks completed all time
    pub total_tasks_completed: i64,
    /// Current streak: consecutive days with at least one task completed
    pub task_streak_days: i64,
    /// "Freshness score": % tossed before expiry. SLO target: >99%
    pub freshness_score: Option<f64>,
    /// "Waste score": % tossed with >5 days remaining (too early). SLO target: <5%
    pub waste_score: Option<f64>,
    /// Average items added per day (last 30 days)
    pub avg_items_added_per_day: f64,
    /// Average items tossed per day (last 30 days)
    pub avg_items_tossed_per_day: f64,
    /// % of active tasks that are on-time (not overdue). SLO target: 100%
    pub task_ontime_score: Option<f64>,
    /// Number of active tasks currently overdue
    pub tasks_overdue: i64,
    /// Total active tasks
    pub tasks_active: i64,
}

#[tauri::command]
pub async fn get_analytics(pool: State<'_, SqlitePool>) -> Result<Analytics, String> {
    // Average days to expiry at time of toss (for items with both expiration_date and removed_at)
    // expiration_date - removed_at in days. Positive means tossed before expiry.
    let avg_days: (Option<f64>,) = sqlx::query_as(
        r#"
        SELECT AVG(julianday(expiration_date) - julianday(date(removed_at)))
        FROM items
        WHERE removed_at IS NOT NULL
          AND removed_reason = 'tossed'
          AND expiration_date IS NOT NULL
        "#,
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Tossed before expiry (good)
    let before: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)
        FROM items
        WHERE removed_at IS NOT NULL
          AND removed_reason = 'tossed'
          AND expiration_date IS NOT NULL
          AND date(removed_at) <= expiration_date
        "#,
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Tossed after expiry (waste)
    let after: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)
        FROM items
        WHERE removed_at IS NOT NULL
          AND removed_reason = 'tossed'
          AND expiration_date IS NOT NULL
          AND date(removed_at) > expiration_date
        "#,
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Total tossed
    let total_tossed: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM items WHERE removed_at IS NOT NULL AND removed_reason = 'tossed'",
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Total items ever added
    let total_added: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM items")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Total tasks completed all time
    let total_completed: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM task_completions")
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    // Task streak: consecutive days (ending today or yesterday) with completions
    // We count backwards from today.
    let streak_rows: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT DISTINCT date(completed_at) as d
        FROM task_completions
        ORDER BY d DESC
        LIMIT 365
        "#,
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let today = chrono::Local::now().date_naive();
    let mut streak: i64 = 0;
    let mut expected = today;

    for (date_str,) in &streak_rows {
        if let Ok(d) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            if d == expected {
                streak += 1;
                expected -= chrono::Duration::days(1);
            } else if d == expected - chrono::Duration::days(1) && streak == 0 {
                // Allow streak to start from yesterday
                expected = d;
                streak += 1;
                expected -= chrono::Duration::days(1);
            } else {
                break;
            }
        }
    }

    // Tossed too early: >5 days before expiry (waste of good product)
    let too_early: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)
        FROM items
        WHERE removed_at IS NOT NULL
          AND removed_reason = 'tossed'
          AND expiration_date IS NOT NULL
          AND julianday(expiration_date) - julianday(date(removed_at)) > 5
        "#,
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Average items added per day (last 30 days)
    let avg_added_per_day: (f64,) = sqlx::query_as(
        r#"
        SELECT COALESCE(COUNT(*) * 1.0 / 30.0, 0.0)
        FROM items
        WHERE date(created_at) >= date('now', '-30 days')
        "#,
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Average items tossed per day (last 30 days)
    let avg_tossed_per_day: (f64,) = sqlx::query_as(
        r#"
        SELECT COALESCE(COUNT(*) * 1.0 / 30.0, 0.0)
        FROM items
        WHERE removed_at IS NOT NULL
          AND removed_reason = 'tossed'
          AND date(removed_at) >= date('now', '-30 days')
        "#,
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let with_expiry = before.0 + after.0;
    let freshness = if with_expiry > 0 {
        Some((before.0 as f64 / with_expiry as f64) * 100.0)
    } else {
        None
    };

    let waste = if total_tossed.0 > 0 {
        Some((too_early.0 as f64 / total_tossed.0 as f64) * 100.0)
    } else {
        None
    };

    // Active tasks (not removed)
    let active_tasks: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM recurring_tasks WHERE removed_at IS NULL",
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Overdue tasks (next_due_at < today)
    let overdue_tasks: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM recurring_tasks WHERE removed_at IS NULL AND next_due_at < date('now', 'localtime')",
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let task_ontime = if active_tasks.0 > 0 {
        Some(((active_tasks.0 - overdue_tasks.0) as f64 / active_tasks.0 as f64) * 100.0)
    } else {
        None
    };

    Ok(Analytics {
        avg_days_to_expiry_at_toss: avg_days.0,
        tossed_before_expiry: before.0,
        tossed_after_expiry: after.0,
        tossed_too_early: too_early.0,
        total_tossed: total_tossed.0,
        total_items_added: total_added.0,
        total_tasks_completed: total_completed.0,
        task_streak_days: streak,
        freshness_score: freshness,
        waste_score: waste,
        avg_items_added_per_day: avg_added_per_day.0,
        avg_items_tossed_per_day: avg_tossed_per_day.0,
        task_ontime_score: task_ontime,
        tasks_overdue: overdue_tasks.0,
        tasks_active: active_tasks.0,
    })
}
