use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditEntry {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub entity_name: String,
    pub action: String,
    pub changes: Option<String>,
    pub created_at: String,
}
