import { invoke } from "@tauri-apps/api/core";
import type {
  Item,
  CreateItem,
  UpdateItem,
  RecurringTask,
  CreateTask,
  UpdateTask,
  TaskCompletion,
  DailyDashboard,
  AuditEntry,
  CalendarEvent,
  RestockCandidate,
  RestockEntry,
  Analytics,
  UndoAction,
  WhatsNext,
} from "./types";

// Items
export const getItems = () => invoke<Item[]>("get_items");
export const getItem = (id: string) => invoke<Item>("get_item", { id });
export const createItem = (input: CreateItem) =>
  invoke<Item>("create_item", { input });
export const updateItem = (id: string, input: UpdateItem) =>
  invoke<Item>("update_item", { id, input });
export const removeItem = (id: string, reason?: string) =>
  invoke<void>("remove_item", { id, reason });
export const bulkCreateItems = (items: CreateItem[]) =>
  invoke<Item[]>("bulk_create_items", { items });

// Tasks
export const getTasks = () => invoke<RecurringTask[]>("get_tasks");
export const createTask = (input: CreateTask) =>
  invoke<RecurringTask>("create_task", { input });
export const updateTask = (id: string, input: UpdateTask) =>
  invoke<RecurringTask>("update_task", { id, input });
export const removeTask = (id: string) => invoke<void>("remove_task", { id });
export const completeTask = (id: string, notes?: string) =>
  invoke<TaskCompletion>("complete_task", { id, notes });

// Dashboard
export const getDailyDashboard = () =>
  invoke<DailyDashboard>("get_daily_dashboard");

// Audit
export const getAuditLog = (
  entityType?: string | null,
  limit?: number,
  offset?: number,
) => invoke<AuditEntry[]>("get_audit_log", { entityType, limit, offset });

// Restock
export const getRestockCandidates = () =>
  invoke<RestockCandidate[]>("get_restock_candidates");
export const bulkRestock = (entries: RestockEntry[]) =>
  invoke<Item[]>("bulk_restock", { entries });
export const hideFromRestock = (id: string) =>
  invoke<void>("hide_from_restock", { id });

// Calendar
export const getCalendar = (year: number, month: number) =>
  invoke<CalendarEvent[]>("get_calendar", { year, month });

// Analytics
export const getAnalytics = () => invoke<Analytics>("get_analytics");

// Settings
export const getSetting = (key: string) =>
  invoke<string | null>("get_setting", { key });
export const setSetting = (key: string, value: string) =>
  invoke<void>("set_setting", { key, value });

// Undo
export const getUndo = (page: string) =>
  invoke<UndoAction | null>("get_undo", { page });
export const executeUndo = (page: string) =>
  invoke<void>("execute_undo", { page });
export const pushUndo = (page: string, action: string, payload: string, label: string) =>
  invoke<void>("push_undo", { page, action, payload, label });

// What's Next
export const getWhatsNext = () => invoke<WhatsNext>("get_whats_next");

// Export
export const exportAuditCsv = (path: string) =>
  invoke<number>("export_audit_csv", { path });
