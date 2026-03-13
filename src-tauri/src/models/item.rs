use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub expiration_date: Option<String>,
    pub notes: Option<String>,
    pub removed_at: Option<String>,
    pub removed_reason: Option<String>,
    pub hidden_from_restock: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateItem {
    pub name: String,
    pub expiration_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateItem {
    pub name: Option<String>,
    pub expiration_date: Option<String>,
    pub notes: Option<String>,
}
