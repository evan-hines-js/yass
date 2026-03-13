CREATE TABLE items (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    expiration_date TEXT,
    notes           TEXT,
    removed_at      TEXT,
    removed_reason  TEXT,
    hidden_from_restock INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE recurring_tasks (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    interval_days   INTEGER NOT NULL,
    weekdays        TEXT,
    last_completed  TEXT,
    next_due_at     TEXT NOT NULL,
    priority        INTEGER NOT NULL DEFAULT 0,
    due_time        TEXT,
    removed_at      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE task_completions (
    id           TEXT PRIMARY KEY,
    task_id      TEXT NOT NULL REFERENCES recurring_tasks(id) ON DELETE CASCADE,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes        TEXT
);

CREATE TABLE audit_log (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    action      TEXT NOT NULL,
    changes     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE undo_stack (
    id         TEXT PRIMARY KEY,
    page       TEXT NOT NULL,
    action     TEXT NOT NULL,
    payload    TEXT NOT NULL,
    label      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_items_expiration ON items(expiration_date);
CREATE INDEX idx_tasks_due ON recurring_tasks(next_due_at);
CREATE INDEX idx_completions_task ON task_completions(task_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE UNIQUE INDEX idx_undo_page ON undo_stack(page);
