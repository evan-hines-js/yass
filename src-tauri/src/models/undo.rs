use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Serialize, FromRow)]
pub struct UndoAction {
    pub id: String,
    pub page: String,
    pub action: String,
    pub payload: String,
    pub label: String,
    pub created_at: String,
}
