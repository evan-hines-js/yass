-- Allow multiple undo entries per page (stack of up to 20).
DROP INDEX IF EXISTS idx_undo_page;
CREATE INDEX idx_undo_page_created ON undo_stack(page, created_at DESC);
