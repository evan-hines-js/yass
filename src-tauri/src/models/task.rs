use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RecurringTask {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub interval_days: i32,
    pub weekdays: Option<String>,
    pub last_completed: Option<String>,
    pub next_due_at: String,
    pub priority: i32,
    pub due_time: Option<String>,
    pub removed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTask {
    pub name: String,
    pub description: Option<String>,
    pub interval_days: i32,
    pub weekdays: Option<String>,
    pub priority: Option<i32>,
    pub due_time: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTask {
    pub name: Option<String>,
    pub description: Option<String>,
    pub interval_days: Option<i32>,
    pub weekdays: Option<String>,
    pub priority: Option<i32>,
    pub due_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TaskCompletion {
    pub id: String,
    pub task_id: String,
    pub completed_at: String,
    pub notes: Option<String>,
}
