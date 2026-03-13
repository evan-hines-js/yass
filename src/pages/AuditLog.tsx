import { createSignal, onMount, For, Show } from "solid-js";
import type { AuditEntry } from "../lib/types";
import { getAuditLog, exportAuditCsv } from "../lib/tauri";
import { titleCase, todayStr, formatDateTime } from "../lib/format";
import { save } from "@tauri-apps/plugin-dialog";

const PAGE_SIZE = 50;

export default function AuditLog() {
  const [entries, setEntries] = createSignal<AuditEntry[]>([]);
  const [filter, setFilter] = createSignal<string | null>(null);
  const [offset, setOffset] = createSignal(0);
  const [exporting, setExporting] = createSignal(false);
  const [exportMsg, setExportMsg] = createSignal<string | null>(null);

  const load = async () => {
    setEntries(await getAuditLog(filter(), PAGE_SIZE, offset()));
  };

  onMount(load);

  const changeFilter = async (f: string | null) => {
    setFilter(f);
    setOffset(0);
    await load();
  };

  const prevPage = async () => {
    setOffset(Math.max(0, offset() - PAGE_SIZE));
    await load();
  };

  const nextPage = async () => {
    setOffset(offset() + PAGE_SIZE);
    await load();
  };

  const actionColor = (action: string) => {
    switch (action) {
      case "added":
      case "imported":
        return "bg-success";
      case "updated":
        return "bg-jasmine";
      case "tossed":
        return "bg-warning";
      case "completed":
        return "bg-info";
      case "restocked":
        return "bg-info";
      case "removed":
        return "bg-danger";
      default:
        return "bg-bark-muted";
    }
  };

  const formatChanges = (changes: string | null): string => {
    if (!changes) return "";
    try {
      const parsed = JSON.parse(changes);
      return Object.entries(parsed)
        .map(([key, val]) => {
          if (typeof val === "object" && val !== null && "old" in val && "new" in val) {
            const v = val as { old: unknown; new: unknown };
            return `${key}: ${v.old ?? "(empty)"} → ${v.new ?? "(empty)"}`;
          }
          return `${key}: ${typeof val === "object" ? JSON.stringify(val) : val}`;
        })
        .join(" · ");
    } catch {
      return changes;
    }
  };

  const handleExport = async () => {
    const path = await save({
      defaultPath: `yass-history-${todayStr()}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!path) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const count = await exportAuditCsv(path);
      setExportMsg(`Exported ${count} entries`);
      setTimeout(() => setExportMsg(null), 4000);
    } catch (e) {
      setExportMsg(`Export failed: ${e}`);
    } finally {
      setExporting(false);
    }
  };

  const filterBtn = (label: string, value: string | null) => (
    <button
      onClick={() => changeFilter(value)}
      class={`px-5 py-3 rounded-xl transition-colors ${
        filter() === value
          ? "bg-jasmine text-bark font-medium"
          : "bg-champagne text-bark-muted hover:bg-champagne/80"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold">History</h2>
        <button
          onClick={handleExport}
          disabled={exporting()}
          class="px-5 py-3 bg-champagne text-bark rounded-xl font-medium hover:bg-champagne/80 disabled:opacity-50 transition-colors"
        >
          {exporting() ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      <Show when={exportMsg()}>
        <div class="bg-success-light rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <p class="text-sm font-medium">{exportMsg()}</p>
          <button onClick={() => setExportMsg(null)} class="text-xs text-bark-muted hover:text-bark">
            Dismiss
          </button>
        </div>
      </Show>

      <div class="flex gap-4 mb-6">
        {filterBtn("All", null)}
        {filterBtn("Inventory", "item")}
        {filterBtn("Tasks", "task")}
      </div>

      <Show
        when={entries().length > 0}
        fallback={
          <p class="text-bark-muted text-sm py-8 text-center">
            No activity recorded yet.
          </p>
        }
      >
        <div class="bg-surface rounded-xl p-4 space-y-0">
          <For each={entries()}>
            {(entry) => (
              <div class="flex gap-3 py-3 border-b border-champagne last:border-0">
                <div
                  class={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${actionColor(entry.action)}`}
                />
                <div class="flex-1 min-w-0">
                  <div class="text-sm">
                    <span class="font-semibold">{entry.action}</span>{" "}
                    <span class="text-bark-muted">
                      {entry.entity_type}
                    </span>{" "}
                    <span class="font-medium">{titleCase(entry.entity_name)}</span>
                  </div>
                  <div class="text-xs text-bark-muted mt-0.5">
                    {formatDateTime(entry.created_at)}
                  </div>
                  <Show when={entry.changes}>
                    <div class="text-xs text-bark-muted mt-1">
                      {formatChanges(entry.changes)}
                    </div>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>

        <div class="flex items-center justify-between mt-4">
          <button
            onClick={prevPage}
            disabled={offset() === 0}
            class="px-5 py-3 bg-champagne text-bark-muted rounded-xl hover:bg-champagne/80 disabled:opacity-40 transition-colors"
          >
            ← Newer
          </button>
          <span class="text-sm text-bark-muted">
            Showing {offset() + 1}–{offset() + entries().length}
          </span>
          <button
            onClick={nextPage}
            disabled={entries().length < PAGE_SIZE}
            class="px-5 py-3 bg-champagne text-bark-muted rounded-xl hover:bg-champagne/80 disabled:opacity-40 transition-colors"
          >
            Older →
          </button>
        </div>
      </Show>
    </div>
  );
}
