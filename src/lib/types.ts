export interface Item {
  id: string;
  name: string;
  expiration_date: string | null;
  notes: string | null;
  removed_at: string | null;
  removed_reason: string | null;
  hidden_from_restock: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateItem {
  name: string;
  expiration_date?: string;
  notes?: string;
}

export interface UpdateItem {
  name?: string;
  expiration_date?: string;
  notes?: string;
}

export interface RecurringTask {
  id: string;
  name: string;
  description: string | null;
  interval_days: number;
  weekdays: string | null;
  last_completed: string | null;
  next_due_at: string;
  priority: number;
  due_time: string | null;
  removed_at: string | null;
  created_at: string;
}

export interface CreateTask {
  name: string;
  description?: string;
  interval_days: number;
  weekdays?: string;
  priority?: number;
  due_time?: string;
}

export interface UpdateTask {
  name?: string;
  description?: string;
  interval_days?: number;
  weekdays?: string;
  priority?: number;
  due_time?: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  completed_at: string;
  notes: string | null;
}

export interface DashboardStats {
  total_items: number;
  expiring_soon: number;
  tasks_completed_this_week: number;
  overdue_tasks: number;
}

export interface DailyDashboard {
  expiring_items: Item[];
  tasks_due: RecurringTask[];
  overdue_tasks: RecurringTask[];
  stats: DashboardStats;
}

export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  action: string;
  changes: string | null;
  created_at: string;
}

export interface RestockCandidate {
  id: string;
  name: string;
  expiration_date: string | null;
  removed_at: string | null;
  removed_reason: string | null;
  in_stock: boolean;
}

export interface RestockEntry {
  source_id: string;
  expiration_date?: string;
}

export interface CalendarEvent {
  date: string;
  event_type: string;
  label: string;
  entity_id: string;
  is_overdue: boolean;
  count: number;
}

export interface ItemGroup {
  key: string;
  name: string;
  expiration_date: string | null;
  count: number;
  items: Item[];
}

export interface UndoAction {
  id: string;
  page: string;
  action: string;
  payload: string;
  label: string;
  created_at: string;
}

export interface WhatsNext {
  kind: string;
  route: string;
  label: string;
}

export interface Analytics {
  avg_days_to_expiry_at_toss: number | null;
  tossed_before_expiry: number;
  tossed_after_expiry: number;
  tossed_too_early: number;
  total_tossed: number;
  total_items_added: number;
  total_tasks_completed: number;
  task_streak_days: number;
  freshness_score: number | null;
  waste_score: number | null;
  avg_items_added_per_day: number;
  avg_items_tossed_per_day: number;
  task_ontime_score: number | null;
  tasks_overdue: number;
  tasks_active: number;
}
