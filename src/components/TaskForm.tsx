import { createSignal, Show } from "solid-js";
import type { CreateTask, RecurringTask } from "../lib/types";
import { createTask, updateTask } from "../lib/tauri";
import { INPUT_CLASS, LABEL_CLASS } from "../lib/constants";
import { parseShortTime, formatTime } from "../lib/time";

interface Props {
  task?: RecurringTask;
  onSaved: () => void;
  onCancel: () => void;
}

// 0=Sun .. 6=Sat — matches JS getDay() and chrono num_days_from_sunday
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DEFAULT_DAYS = new Set([1, 3, 5]); // M/W/F

function parseWeekdays(wd: string | null | undefined): Set<number> {
  if (!wd) return new Set(DEFAULT_DAYS);
  const days = wd.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
  return days.length > 0 ? new Set(days) : new Set(DEFAULT_DAYS);
}

function serializeWeekdays(days: Set<number>): string {
  return Array.from(days).sort((a, b) => a - b).join(",");
}

export default function TaskForm(props: Props) {
  const [name, setName] = createSignal(props.task?.name ?? "");
  const [description, setDescription] = createSignal(props.task?.description ?? "");
  const [selectedDays, setSelectedDays] = createSignal<Set<number>>(
    parseWeekdays(props.task?.weekdays)
  );
  const [scheduled, setScheduled] = createSignal((props.task?.priority ?? 0) > 0 || !!props.task?.due_time);
  const [dueTime, setDueTime] = createSignal(props.task?.due_time ?? "");
  const [dueTimeDisplay, setDueTimeDisplay] = createSignal(props.task?.due_time ?? "");
  const [saving, setSaving] = createSignal(false);

  const toggleDay = (day: number) => {
    const next = new Set(selectedDays());
    if (next.has(day)) {
      // Don't allow deselecting the last day
      if (next.size > 1) next.delete(day);
    } else {
      next.add(day);
    }
    setSelectedDays(next);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    try {
      const wd = serializeWeekdays(selectedDays());
      const priority = scheduled() ? 1 : 0;
      const due_time = scheduled() && dueTime() ? dueTime() : undefined;
      if (props.task) {
        await updateTask(props.task.id, {
          name: name(),
          description: description() || undefined,
          interval_days: 1,
          weekdays: wd,
          priority,
          due_time,
        });
      } else {
        const input: CreateTask = {
          name: name(),
          description: description() || undefined,
          interval_days: 1,
          weekdays: wd,
          priority,
          due_time,
        };
        await createTask(input);
      }
      props.onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="space-y-4" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); props.onCancel(); } }}>
      <div>
        <label class={LABEL_CLASS}>Task Name *</label>
        <input class={INPUT_CLASS} value={name()} onInput={(e) => setName(e.currentTarget.value)} required aria-required="true" placeholder="e.g. Clean coffee pot" ref={(el) => requestAnimationFrame(() => el.focus())} />
      </div>

      <div>
        <label class={LABEL_CLASS}>Description</label>
        <textarea class={INPUT_CLASS} rows={2} value={description()} onInput={(e) => setDescription(e.currentTarget.value)} />
      </div>

      <div>
        <label class={LABEL_CLASS}>Repeat On * <span class="text-xs text-bark-muted font-normal ml-1"><kbd class="text-xs font-mono bg-champagne/50 px-1 py-0.5 rounded">Q</kbd>/<kbd class="text-xs font-mono bg-champagne/50 px-1 py-0.5 rounded">E</kbd> move, <kbd class="text-xs font-mono bg-champagne/50 px-1 py-0.5 rounded">Space</kbd> toggle</span></label>
        <div
          class="flex gap-3"
          role="toolbar"
          aria-label="Weekday picker"
          onKeyDown={(e) => {
            const btns = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button"));
            const idx = btns.indexOf(document.activeElement as HTMLElement);
            if (idx < 0) return;
            if (e.key === "q" || e.key === "Q") {
              e.preventDefault();
              btns[(idx - 1 + btns.length) % btns.length].focus();
            } else if (e.key === "e" || e.key === "E") {
              e.preventDefault();
              btns[(idx + 1) % btns.length].focus();
            }
          }}
        >
          {DAY_LABELS.map((label, i) => {
            const fullNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            return (
              <button
                type="button"
                tabIndex={i === 0 ? 0 : -1}
                onClick={() => toggleDay(i)}
                aria-pressed={selectedDays().has(i)}
                aria-label={fullNames[i]}
                class={`w-11 h-11 rounded-xl text-sm font-semibold transition-all ${
                  selectedDays().has(i)
                    ? "bg-jasmine text-bark shadow-sm"
                    : "bg-champagne/60 text-bark-muted hover:bg-champagne"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label class={LABEL_CLASS}>Priority <span class="text-xs text-bark-muted font-normal ml-1"><kbd class="text-xs font-mono bg-champagne/50 px-1 py-0.5 rounded">Q</kbd>/<kbd class="text-xs font-mono bg-champagne/50 px-1 py-0.5 rounded">E</kbd> move, <kbd class="text-xs font-mono bg-champagne/50 px-1 py-0.5 rounded">Space</kbd> select</span></label>
        <div
          class="flex gap-3"
          role="toolbar"
          aria-label="Priority picker"
          onKeyDown={(e) => {
            const btns = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button"));
            const idx = btns.indexOf(document.activeElement as HTMLElement);
            if (idx < 0) return;
            if (e.key === "q" || e.key === "Q") {
              e.preventDefault();
              btns[(idx - 1 + btns.length) % btns.length].focus();
            } else if (e.key === "e" || e.key === "E") {
              e.preventDefault();
              btns[(idx + 1) % btns.length].focus();
            }
          }}
        >
          <button
            type="button"
            tabIndex={0}
            onClick={() => { setScheduled(false); setDueTime(""); setDueTimeDisplay(""); }}
            class={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              !scheduled()
                ? "bg-jasmine text-bark shadow-sm"
                : "bg-champagne/60 text-bark-muted hover:bg-champagne"
            }`}
          >
            Low
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setScheduled(true)}
            class={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              scheduled()
                ? "bg-jasmine text-bark shadow-sm"
                : "bg-champagne/60 text-bark-muted hover:bg-champagne"
            }`}
          >
            Scheduled
          </button>
        </div>
      </div>

      <Show when={scheduled()}>
        <div>
          <label class={LABEL_CLASS}>Due Time</label>
          <input
            class={INPUT_CLASS}
            type="text"
            inputMode="numeric"
            placeholder="e.g. 9~ (9am), 9 (9pm), 12 (noon)"
            value={dueTimeDisplay()}
            onKeyDown={(e) => {
              const k = e.key.toLowerCase();
              if (k === "f" || k === "w") e.preventDefault();
            }}
            onInput={(e) => {
              const raw = e.currentTarget.value;
              setDueTimeDisplay(raw);
              const parsed = parseShortTime(raw);
              if (parsed) setDueTime(parsed);
            }}
            onBlur={(e) => {
              const parsed = parseShortTime(e.currentTarget.value);
              if (parsed) {
                setDueTime(parsed);
                setDueTimeDisplay(formatTime(parsed));
              }
            }}
          />
        </div>
      </Show>

      <div class="flex gap-3 pt-2">
        <button type="submit" disabled={saving() || !name().trim()} class="px-5 py-2.5 bg-jasmine text-bark font-semibold rounded-xl hover:bg-jasmine-dark disabled:opacity-50 transition-colors shadow-sm">
          {saving() ? "Saving..." : props.task ? "Update" : "Add Task"}
        </button>
        <button type="button" onClick={props.onCancel} class="px-5 py-2.5 bg-champagne text-bark-muted rounded-xl hover:bg-champagne/80 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
