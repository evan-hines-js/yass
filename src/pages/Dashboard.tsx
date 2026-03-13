import { createSignal, onMount, Show } from "solid-js";
import { A } from "@solidjs/router";
import type { DailyDashboard, Analytics, Item } from "../lib/types";
import { getDailyDashboard, getAnalytics, getSetting, setSetting } from "../lib/tauri";
import { pluralize } from "../lib/format";

export default function Dashboard() {
  const [dashboard, setDashboard] = createSignal<DailyDashboard | null>(null);
  const [analytics, setAnalytics] = createSignal<Analytics | null>(null);
  const [userName, setUserName] = createSignal<string | null>(null);
  const [nameInput, setNameInput] = createSignal("");
  const [showNamePrompt, setShowNamePrompt] = createSignal(false);

  const load = async () => {
    const name = await getSetting("user_name");
    if (name) {
      setUserName(name);
    } else {
      setShowNamePrompt(true);
    }
    setDashboard(await getDailyDashboard());
    setAnalytics(await getAnalytics());
  };

  const saveName = async () => {
    const name = nameInput().trim();
    if (!name) return;
    await setSetting("user_name", name);
    setUserName(name);
    setShowNamePrompt(false);
  };

  onMount(load);

  return (
    <div>
      <Show when={showNamePrompt()}>
        <div class="bg-cream rounded-xl p-6 mb-8 border border-champagne/40 shadow-sm text-center">
          <h2 class="text-2xl font-bold mb-2">Welcome to YASS!</h2>
          <p class="text-bark-muted mb-4">What's your name?</p>
          <div class="flex items-center justify-center gap-3 max-w-sm mx-auto">
            <input
              class="flex-1 px-4 py-2.5 rounded-xl border border-champagne/60 bg-white text-bark focus:outline-none focus:ring-2 focus:ring-jasmine/50 focus:border-jasmine transition-colors"
              value={nameInput()}
              onInput={(e) => setNameInput(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="Your name"
              autofocus
            />
            <button
              onClick={saveName}
              disabled={!nameInput().trim()}
              class="px-5 py-2.5 bg-jasmine text-bark font-semibold rounded-xl hover:bg-jasmine-dark disabled:opacity-50 transition-colors shadow-sm"
            >
              Go
            </button>
          </div>
        </div>
      </Show>

      <Show when={!showNamePrompt()}>
        <div class="mb-8">
          <h2 class="text-2xl font-bold">Good {getGreeting()}{userName() ? `, ${userName()}` : ""}</h2>
          <p class="text-bark-muted mt-1">Here's what's happening today.</p>
        </div>
      </Show>

      <Show when={dashboard()} fallback={<p class="text-bark-muted">Loading...</p>}>
        {(data) => (
          <>
            {/* Action items — compact link cards */}
            <Show when={data().overdue_tasks.length > 0}>
              <A href="/tasks" class="flex items-center justify-between bg-danger-light rounded-xl px-5 py-4 mb-3 card-hover border border-danger/20 focus-visible:ring-2 focus-visible:ring-jasmine focus-visible:ring-offset-2">
                <div>
                  <p class="text-lg font-medium text-danger">
                    {pluralize(data().overdue_tasks.length, "task")} overdue
                  </p>
                </div>
                <span class="text-danger font-medium">View Tasks →</span>
              </A>
            </Show>

            <Show when={data().tasks_due.length > 0}>
              <A href="/tasks" class="flex items-center justify-between bg-surface rounded-xl px-5 py-4 mb-3 card-hover border border-champagne/30 focus-visible:ring-2 focus-visible:ring-jasmine focus-visible:ring-offset-2">
                <div>
                  <p class="text-lg font-medium">
                    {pluralize(data().tasks_due.length, "task")} due today
                  </p>
                </div>
                <span class="text-bark-muted font-medium">View Tasks →</span>
              </A>
            </Show>

            {(() => {
              const { urgent, soon } = splitExpiring(data().expiring_items);
              return (
                <>
                  <Show when={urgent.length > 0}>
                    <A href="/inventory" class="flex items-center justify-between bg-danger-light rounded-xl px-5 py-4 mb-3 card-hover border border-danger/20 focus-visible:ring-2 focus-visible:ring-jasmine focus-visible:ring-offset-2">
                      <p class="text-lg font-medium text-danger">
                        {pluralize(urgent.length, "item")} expiring today
                      </p>
                      <span class="text-danger font-medium">View Inventory →</span>
                    </A>
                  </Show>
                  <Show when={soon.length > 0}>
                    <A href="/inventory" class="flex items-center justify-between bg-warning-light rounded-xl px-5 py-4 mb-3 card-hover border border-warning/20 focus-visible:ring-2 focus-visible:ring-jasmine focus-visible:ring-offset-2">
                      <p class="text-lg font-medium text-bark">
                        {pluralize(soon.length, "item")} expiring soon
                      </p>
                      <span class="text-bark-muted font-medium">View Inventory →</span>
                    </A>
                  </Show>
                </>
              );
            })()}

            {/* All clear message when nothing needs attention */}
            <Show when={data().overdue_tasks.length === 0 && data().tasks_due.length === 0 && data().expiring_items.length === 0}>
              <div class="bg-success-light rounded-xl px-5 py-3 mb-8 text-center">
                <p class="text-success font-medium">You're all good — nothing needs attention right now.</p>
              </div>
            </Show>

            {/* Stats row */}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                value={data().stats.total_items}
                label="In Stock"
                color="text-bark"
                bg="bg-surface"
              />
              <StatCard
                value={data().stats.expiring_soon}
                label="Expiring Soon"
                color="text-warning"
                bg="bg-warning-light"
              />
              <StatCard
                value={data().stats.overdue_tasks}
                label="Tasks Overdue"
                color="text-danger"
                bg="bg-danger-light"
              />
              <StatCard
                value={data().stats.tasks_completed_this_week}
                label="Done This Week"
                color="text-success"
                bg="bg-success-light"
              />
            </div>

            {/* SLOs */}
            <Show when={analytics()}>
              {(stats) => (
                <div class="mb-8">
                  <h3 class="text-lg font-semibold mb-3">SLOs</h3>
                  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <SloCard
                      label="Freshness"
                      value={stats().freshness_score}
                      target={99}
                      comparator="gte"
                      suffix="%"
                      description="Items tossed before expiry"
                      detail={`${stats().tossed_before_expiry} of ${stats().tossed_before_expiry + stats().tossed_after_expiry} with expiry dates`}
                    />
                    <SloCard
                      label="Waste"
                      value={stats().waste_score}
                      target={5}
                      comparator="lte"
                      suffix="%"
                      description="Items tossed with more than 5 days remaining"
                      detail={`${stats().tossed_too_early} of ${stats().total_tossed} total tossed`}
                    />
                    <SloCard
                      label="Tasks On-Time"
                      value={stats().task_ontime_score}
                      target={100}
                      comparator="gte"
                      suffix="%"
                      description="Active tasks not overdue"
                      detail={`${stats().tasks_overdue} overdue of ${stats().tasks_active} active`}
                    />
                  </div>
                </div>
              )}
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}

/** Split items into "urgent" (expiring today or before next work day) vs "soon" */
function splitExpiring(items: Item[]): { urgent: Item[]; soon: Item[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  // Mon(1)->next Wed: 1d gap. Wed(3)->next Fri: 1d. Fri(5)->next Mon: 2d gap.
  const urgentDays = dow === 1 ? 1 : dow === 3 ? 1 : dow === 5 ? 2 : 0;

  const urgent: Item[] = [];
  const soon: Item[] = [];
  for (const item of items) {
    if (!item.expiration_date) { soon.push(item); continue; }
    const exp = new Date(item.expiration_date + "T00:00:00");
    exp.setHours(0, 0, 0, 0);
    const days = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= urgentDays) {
      urgent.push(item);
    } else {
      soon.push(item);
    }
  }
  return { urgent, soon };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function StatCard(props: { value: number; label: string; color: string; bg: string }) {
  return (
    <div class={`${props.bg} rounded-xl p-5 border border-champagne/40`}>
      <p class={`text-3xl font-bold ${props.color}`}>{props.value}</p>
      <p class="text-sm text-bark-muted mt-1">{props.label}</p>
    </div>
  );
}

function SloCard(props: {
  label: string;
  value: number | null;
  target: number;
  comparator: "gte" | "lte";
  suffix: string;
  description: string;
  detail: string;
}) {
  const passing = () => {
    if (props.value === null) return null;
    return props.comparator === "gte"
      ? props.value >= props.target
      : props.value <= props.target;
  };

  const displayValue = () =>
    props.value !== null ? `${Math.round(props.value * 10) / 10}${props.suffix}` : "--";

  const targetLabel = () =>
    props.comparator === "gte" ? `>= ${props.target}${props.suffix}` : `<= ${props.target}${props.suffix}`;

  const barWidth = () => {
    if (props.value === null) return 0;
    if (props.comparator === "gte") return Math.min(props.value, 100);
    // For "lte" metrics like waste, invert: 0% waste = full green bar
    return Math.max(0, 100 - props.value);
  };

  return (
    <div
      class={`rounded-xl p-5 border-2 ${
        passing() === null
          ? "bg-cream border-champagne/40"
          : passing()
          ? "bg-success-light border-success/30"
          : "bg-danger-light border-danger/30"
      }`}
    >
      <div class="flex items-center justify-between mb-1">
        <p class="text-sm font-semibold text-bark">{props.label}</p>
        <span
          class={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            passing() === null
              ? "bg-champagne text-bark-muted"
              : passing()
              ? "bg-success/20 text-success"
              : "bg-danger/20 text-danger"
          }`}
        >
          {passing() === null ? "No data" : passing() ? "PASS" : "FAIL"}
        </span>
      </div>
      <div class="flex items-baseline gap-2 mb-2">
        <p
          class={`text-3xl font-bold ${
            passing() === null ? "text-bark-muted" : passing() ? "text-success" : "text-danger"
          }`}
        >
          {displayValue()}
        </p>
        <p class="text-sm text-bark-muted">target {targetLabel()}</p>
      </div>
      {/* Progress bar */}
      <div class="w-full h-2 rounded-full bg-champagne/60 mb-2">
        <div
          class={`h-2 rounded-full transition-all ${
            passing() === null ? "bg-bark-muted" : passing() ? "bg-success" : "bg-danger"
          }`}
          style={{ width: `${barWidth()}%` }}
        />
      </div>
      <p class="text-xs text-bark-muted">{props.description}</p>
      <p class="text-xs text-bark-muted">{props.detail}</p>
    </div>
  );
}
