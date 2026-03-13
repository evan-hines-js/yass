import { createSignal, onMount, For, Show } from "solid-js";
import type { CalendarEvent } from "../lib/types";
import { getCalendar } from "../lib/tauri";
import { pluralize, todayStr } from "../lib/format";
import { usePageShortcuts } from "../lib/shortcuts";

interface DaySummary {
  type: string;
  label: string;
  color: string;
  events: CalendarEvent[];
}

export default function Calendar() {
  const now = new Date();
  const [year, setYear] = createSignal(now.getFullYear());
  const [month, setMonth] = createSignal(now.getMonth() + 1);
  const [events, setEvents] = createSignal<CalendarEvent[]>([]);
  const [selectedDay, setSelectedDay] = createSignal<{
    dateStr: string;
    dayLabel: string;
    summaries: DaySummary[];
  } | null>(null);

  let dayModalRef: HTMLDivElement | undefined;
  let previousFocus: HTMLElement | null = null;

  const load = async () => {
    setEvents(await getCalendar(year(), month()));
    setSelectedDay(null);
  };

  onMount(load);

  const prevMonth = async () => {
    if (month() === 1) { setMonth(12); setYear(year() - 1); }
    else { setMonth(month() - 1); }
    await load();
  };

  const nextMonth = async () => {
    if (month() === 12) { setMonth(1); setYear(year() + 1); }
    else { setMonth(month() + 1); }
    await load();
  };

  usePageShortcuts({
    q: () => { if (!selectedDay()) prevMonth(); },
    e: () => { if (!selectedDay()) nextMonth(); },
  });

  const monthName = () =>
    new Date(year(), month() - 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  /** Group events by type for a single day, producing rolled-up summaries */
  const summarizeDay = (dayEvents: CalendarEvent[]): DaySummary[] => {
    const groups: Record<string, CalendarEvent[]> = {};
    for (const e of dayEvents) {
      (groups[e.event_type] ??= []).push(e);
    }

    const summaries: DaySummary[] = [];

    if (groups.received) {
      const n = groups.received.reduce((s, e) => s + e.count, 0);
      summaries.push({
        type: "received",
        label: `${pluralize(n, "item")} received`,
        color: "bg-success-light text-success",
        events: groups.received,
      });
    }

    if (groups.expiration) {
      const n = groups.expiration.reduce((s, e) => s + e.count, 0);
      const anyOverdue = groups.expiration.some((e) => e.is_overdue);
      summaries.push({
        type: "expiration",
        label: `${pluralize(n, "item")} expiring`,
        color: anyOverdue ? "bg-danger-light text-danger" : "bg-warning-light text-warning",
        events: groups.expiration,
      });
    }

    if (groups.task_due) {
      const n = groups.task_due.length;
      const anyOverdue = groups.task_due.some((e) => e.is_overdue);
      summaries.push({
        type: "task_due",
        label: `${pluralize(n, "task")} due`,
        color: anyOverdue ? "bg-danger-light text-danger" : "bg-info-light text-info",
        events: groups.task_due,
      });
    }

    return summaries;
  };

  const dayCells = () => {
    const firstDay = new Date(year(), month() - 1, 1).getDay();
    const daysInMonth = new Date(year(), month(), 0).getDate();
    const today = todayStr();

    const cells: {
      day: number;
      dateStr: string;
      isToday: boolean;
      isOtherMonth: boolean;
      summaries: DaySummary[];
    }[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: 0, dateStr: "", isToday: false, isOtherMonth: true, summaries: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year()}-${String(month()).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayEvents = events().filter((e) => e.date === dateStr);
      cells.push({
        day: d,
        dateStr,
        isToday: dateStr === today,
        isOtherMonth: false,
        summaries: summarizeDay(dayEvents),
      });
    }

    return cells;
  };

  const formatDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  const openDay = (dateStr: string, summaries: DaySummary[]) => {
    if (summaries.length === 0) return;
    setSelectedDay({ dateStr, dayLabel: formatDayLabel(dateStr), summaries });
  };

  const closeDay = () => {
    setSelectedDay(null);
    previousFocus?.focus();
  };

  const handleDayModalKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDay();
      return;
    }
    if (e.key === "Tab" && dayModalRef) {
      const focusable = dayModalRef.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <h2 class="text-2xl font-bold mb-6">Calendar</h2>

      <div class="flex items-center gap-4 mb-6">
        <button
          onClick={prevMonth}
          class="px-5 py-3 bg-champagne text-bark-muted rounded-xl hover:bg-champagne/80 transition-colors"
          aria-label="Previous month"
        >
          ← Prev
          <kbd class="text-xs bg-bark/10 px-1.5 py-0.5 rounded font-mono ml-1">Q</kbd>
        </button>
        <h3 class="text-lg font-semibold min-w-[180px] text-center" aria-live="polite">{monthName()}</h3>
        <button
          onClick={nextMonth}
          class="px-5 py-3 bg-champagne text-bark-muted rounded-xl hover:bg-champagne/80 transition-colors"
          aria-label="Next month"
        >
          Next →
          <kbd class="text-xs bg-bark/10 px-1.5 py-0.5 rounded font-mono ml-1">E</kbd>
        </button>
      </div>

      <div class="grid grid-cols-7 border border-champagne/40 rounded-xl overflow-hidden shadow-sm" role="grid" aria-label="Calendar">
        <For each={weekdays}>
          {(day) => (
            <div class="bg-cream px-2 py-2 text-center text-xs font-semibold text-bark-muted border-b border-champagne/40" role="columnheader">
              {day}
            </div>
          )}
        </For>

        <For each={dayCells()}>
          {(cell) => (
            <div
              role="gridcell"
              class={`min-h-[110px] p-2 border-b border-r border-champagne/30 transition-colors ${
                cell.isOtherMonth
                  ? "bg-ivory"
                  : cell.isToday
                    ? "bg-jasmine-light"
                    : "bg-white hover:bg-surface"
              } ${!cell.isOtherMonth && cell.summaries.length > 0 ? "cursor-pointer" : ""}`}
              onClick={() => !cell.isOtherMonth && openDay(cell.dateStr, cell.summaries)}
              tabindex={!cell.isOtherMonth && cell.summaries.length > 0 ? "0" : undefined}
              aria-label={!cell.isOtherMonth && cell.summaries.length > 0
                ? `${formatDayLabel(cell.dateStr)}: ${cell.summaries.map(s => s.label).join(", ")}`
                : undefined}
              onKeyDown={(e) => {
                if (!cell.isOtherMonth && cell.summaries.length > 0 && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  openDay(cell.dateStr, cell.summaries);
                }
              }}
            >
              <Show when={!cell.isOtherMonth}>
                <div class={`text-xs font-semibold mb-1 ${cell.isToday ? "text-bark" : "text-bark-muted"}`}>
                  {cell.day}
                </div>
                <For each={cell.summaries}>
                  {(summary) => (
                    <div class={`text-xs leading-snug px-1.5 py-1 rounded mb-0.5 truncate font-medium ${summary.color}`} title={summary.label}>
                      {summary.label}
                    </div>
                  )}
                </For>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Day detail modal */}
      <Show when={selectedDay()}>
        {(day) => (
          <div
            class="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-modal-title"
            onKeyDown={handleDayModalKeyDown}
            ref={(el) => {
              dayModalRef = el;
              previousFocus = document.activeElement as HTMLElement;
              requestAnimationFrame(() => {
                const btn = el.querySelector<HTMLElement>("button");
                btn?.focus();
              });
            }}
          >
            <div class="absolute inset-0 bg-bark/30 backdrop-blur-sm" onClick={closeDay} aria-hidden="true" />
            <div class="relative bg-ivory rounded-2xl shadow-xl max-w-lg w-full mx-4 border border-champagne/50 overflow-hidden">
              <div class="flex items-center justify-between px-6 py-5 border-b border-champagne/40">
                <h3 id="day-modal-title" class="text-lg font-semibold">{day().dayLabel}</h3>
                <button
                  onClick={closeDay}
                  class="p-3 text-bark-muted hover:text-bark rounded-xl hover:bg-champagne transition-colors"
                  aria-label="Close"
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div class="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                <For each={day().summaries}>
                  {(summary) => (
                    <div>
                      <h4 class="text-sm font-semibold text-bark-muted uppercase tracking-wide mb-2">
                        {summary.type === "received" ? "Items Received" : summary.type === "expiration" ? "Expiring" : "Tasks Due"}
                      </h4>
                      <div class="space-y-1.5">
                        <For each={summary.events}>
                          {(event) => (
                            <div class={`flex items-center px-4 py-3 rounded-xl ${summary.color}`}>
                              <span class="font-medium">{event.label}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
