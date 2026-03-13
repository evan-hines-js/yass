import { createSignal, onMount, For, Show, onCleanup } from "solid-js";
import type { RecurringTask } from "../lib/types";
import { getTasks, removeTask, completeTask } from "../lib/tauri";
import TaskForm from "../components/TaskForm";
import ConfirmModal from "../components/ConfirmModal";
import { titleCase, todayStr } from "../lib/format";
import { formatTime } from "../lib/time";
import { usePageShortcuts, useListNavigation, focusFTarget } from "../lib/shortcuts";
import { useUndo } from "../lib/undo";
import { playSuccess } from "../lib/sounds";

export default function Tasks() {
  const [tasks, setTasks] = createSignal<RecurringTask[]>([]);
  const [showForm, setShowForm] = createSignal(false);
  const [editingTask, setEditingTask] = createSignal<RecurringTask | undefined>();
  const [removingTask, setRemovingTask] = createSignal<RecurringTask | null>(null);
  const [expanded, setExpanded] = createSignal<string | null>(null);
  const [toast, setToast] = createSignal<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => { if (toastTimer) clearTimeout(toastTimer); });

  const showToast = (msg: string) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToast(msg);
    toastTimer = setTimeout(() => setToast(null), 5000);
  };

  const load = async () => {
    setTasks(await getTasks());
    await undo.refreshUndo();
    focusFTarget();
  };
  onMount(load);

  const undo = useUndo("tasks", load);

  const completeFirstDue = async () => {
    const today = todayStr();
    const due = tasks().find((t) => t.next_due_at <= today);
    if (due) {
      const name = titleCase(due.name);
      await completeTask(due.id);
      playSuccess();
      await load();
      showToast(`Marked "${name}" as done!`);
    }
  };

  useListNavigation();
  usePageShortcuts({
    a: () => handleAdd(),
    f: () => completeFirstDue(),
    z: () => undo.askUndo(),
  });

  const handleAdd = () => {
    setEditingTask(undefined);
    setShowForm(true);
  };

  const handleEdit = (task: RecurringTask) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleSaved = async () => {
    setShowForm(false);
    setEditingTask(undefined);
    await load();
  };

  const handleComplete = async (id: string) => {
    await completeTask(id);
    playSuccess();
    await load();
  };

  const doRemove = async () => {
    const task = removingTask();
    if (!task) return;
    try {
      await removeTask(task.id);
      setRemovingTask(null);
      await load();
    } catch (e) {
      console.error("Remove failed:", e);
    }
  };

  const isDue = (task: RecurringTask) => {
    const today = todayStr();
    return task.next_due_at <= today;
  };

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const scheduleLabel = (task: RecurringTask) => {
    if (!task.weekdays) return `Every ${task.interval_days} day${task.interval_days > 1 ? "s" : ""}`;
    const days = task.weekdays.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    if (days.length === 7) return "Every day";
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "Weekdays";
    return days.map((d) => DAY_NAMES[d]).join(", ");
  };

  const toggleExpand = (id: string) => {
    setExpanded(expanded() === id ? null : id);
  };

  return (
    <div>
      <Show when={toast()}>
        <div class="bg-success/20 rounded-xl px-4 py-3 mb-6" role="status">
          <p class="text-sm font-medium">{toast()}</p>
        </div>
      </Show>

      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <h2 class="text-2xl font-bold">Recurring Tasks</h2>
          <Show when={undo.undoAction()}>
            <button
              onClick={() => undo.askUndo()}
              class="px-3 py-1.5 text-sm bg-champagne text-bark rounded-lg hover:bg-champagne/80 transition-colors flex items-center gap-1.5"
            >
              Undo
              <kbd class="text-xs bg-bark/10 px-1 py-0.5 rounded font-mono">Z</kbd>
            </button>
          </Show>
        </div>
        <button
          onClick={handleAdd}
          class="px-5 py-2.5 bg-jasmine text-bark font-semibold rounded-xl hover:bg-jasmine-dark transition-colors shadow-sm flex items-center gap-2"
        >
          + Add Task
          <kbd class="text-xs bg-bark/10 px-1.5 py-0.5 rounded font-mono">A</kbd>
        </button>
      </div>

      <Show when={showForm()}>
        <div class="bg-cream rounded-xl p-5 mb-6 border border-champagne/40 shadow-sm">
          <h3 class="text-lg font-semibold mb-4">
            {editingTask() ? "Edit Task" : "New Task"}
          </h3>
          <TaskForm
            task={editingTask()}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        </div>
      </Show>

      <Show
        when={tasks().length > 0}
        fallback={
          <div class="text-center py-16 text-bark-muted">
            <p class="text-lg">No tasks yet</p>
            <p class="text-sm mt-1">Add a recurring task to get started.</p>
          </div>
        }
      >
        <div class="space-y-2" role="list" aria-label="Recurring tasks">
          <For each={tasks()}>
            {(task) => {
              const isExpanded = () => expanded() === task.id;
              return (
                <div
                  role="listitem"
                  class={`flex flex-wrap items-center gap-3 rounded-xl px-5 py-4 border card-hover ${
                    isDue(task)
                      ? "bg-danger-light border-danger/20"
                      : "bg-surface border-champagne/30"
                  }`}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    class="flex-1 min-w-0 text-left cursor-pointer bg-transparent border-none p-0 rounded-xl focus-visible:ring-2 focus-visible:ring-jasmine focus-visible:ring-offset-2"
                    onClick={() => toggleExpand(task.id)}
                    aria-expanded={isExpanded()}
                    aria-label={`${titleCase(task.name)}, ${isExpanded() ? "collapse" : "expand"} actions`}
                  >
                    <div class="flex items-center gap-2">
                      <p class="text-lg font-medium">{titleCase(task.name)}</p>
                      <svg
                        class={`w-4 h-4 text-bark-muted transition-transform ${isExpanded() ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                        aria-hidden="true"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <p class="text-sm text-bark-muted">
                      {scheduleLabel(task)}
                      {task.due_time ? ` at ${formatTime(task.due_time)}` : ""}
                      {" — "}
                      <span class={isDue(task) ? "text-danger font-medium" : ""}>
                        {isDue(task) ? "Due!" : `Next: ${task.next_due_at}`}
                      </span>
                    </p>
                  </button>
                  <button
                    onClick={() => handleComplete(task.id)}
                    class="px-6 py-3 bg-success/20 text-bark rounded-xl font-medium hover:bg-success/30 transition-colors shrink-0 flex items-center gap-2"
                    {...(isDue(task) && tasks().find((t) => t.next_due_at <= todayStr())?.id === task.id ? { "data-f-target": "" } : {})}
                  >
                    Done
                    <Show when={isDue(task) && tasks().find((t) => t.next_due_at <= todayStr())?.id === task.id}>
                      <kbd class="text-xs bg-bark/10 px-1.5 py-0.5 rounded font-mono">F</kbd>
                    </Show>
                  </button>
                  <Show when={isExpanded()}>
                    <div class="flex gap-3 pt-3 mt-3 border-t border-champagne/40 w-full">
                      <button
                        tabindex={-1}
                        onClick={() => handleEdit(task)}
                        class="flex-1 py-3 bg-champagne text-bark rounded-xl font-medium hover:bg-jasmine-light transition-colors text-center"
                      >
                        Edit
                      </button>
                      <button
                        tabindex={-1}
                        onClick={() => setRemovingTask(task)}
                        class="flex-1 py-3 bg-danger-light text-danger rounded-xl font-medium hover:bg-danger/20 transition-colors text-center"
                      >
                        Remove
                      </button>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      <ConfirmModal
        open={!!removingTask()}
        title="Remove Task"
        message={`Remove "${titleCase(removingTask()?.name ?? "")}"? It won't appear in your task list anymore.`}
        confirmLabel="Remove"
        onConfirm={doRemove}
        onCancel={() => setRemovingTask(null)}
      />

      <ConfirmModal
        open={undo.undoConfirming()}
        title="Undo"
        message={`Undo: ${undo.undoAction()?.label}?`}
        confirmLabel="Undo"
        onConfirm={undo.doUndo}
        onCancel={undo.cancelUndo}
      />
    </div>
  );
}
