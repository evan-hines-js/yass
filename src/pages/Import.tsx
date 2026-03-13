import { createSignal, Index, Show } from "solid-js";
import type { CreateItem } from "../lib/types";
import { bulkCreateItems } from "../lib/tauri";
import { titleCase, pluralize } from "../lib/format";
import { parseShortDate } from "../lib/date";
import { INPUT_CLASS_SM } from "../lib/constants";
import { focusMain, focusFTarget, usePageShortcuts, useListNavigation } from "../lib/shortcuts";
import DateInput from "../components/DateInput";
interface ImportRow {
  key: string;
  name: string;
  expiration_date: string;
}

function parseCSV(text: string): ImportRow[] {
  const rows: ImportRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    const name = fields[0];
    if (!name) continue;

    const rawDate = fields[1]?.trim() || "";
    rows.push({
      key: crypto.randomUUID(),
      name,
      expiration_date: (rawDate && parseShortDate(rawDate)) || rawDate,
    });
  }
  return rows;
}

export default function Import() {
  const [rows, setRows] = createSignal<ImportRow[]>([]);
  const [parsed, setParsed] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [done, setDone] = createSignal(false);
  const [importedCount, setImportedCount] = createSignal(0);
  const [autoImportedCount, setAutoImportedCount] = createSignal(0);
  let fileInputRef: HTMLInputElement | undefined;

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      handleParse(reader.result as string);
    };
    reader.readAsText(file);
  };

  const handleParse = async (text: string) => {
    const allRows = parseCSV(text);
    if (allRows.length === 0) return;

    setParsed(true);
    setDone(false);

    const complete = allRows.filter((r) => r.expiration_date);
    const needsReview = allRows.filter((r) => !r.expiration_date);

    if (complete.length > 0) {
      const items: CreateItem[] = complete.map((r) => ({
        name: r.name,
        expiration_date: r.expiration_date,
      }));

      await bulkCreateItems(items);
      setAutoImportedCount(complete.length);
    } else {
      setAutoImportedCount(0);
    }

    if (needsReview.length === 0) {
      setImportedCount(complete.length);
      setDone(true);
      setRows([]);
      setParsed(false);
      focusMain();
      return;
    }

    setRows(needsReview);
    focusMain(".space-y-2 input");
  };

  const updateRow = (key: string, field: keyof ImportRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const allHaveDates = () => rows().every((r) => r.expiration_date);
  const missingCount = () => rows().filter((r) => !r.expiration_date).length;

  const handleImport = async () => {
    if (rows().length === 0) return;
    if (!allHaveDates()) {
      // Focus the first empty date input — same logic as DateInput's F handler
      const inputs = document.querySelectorAll<HTMLInputElement>("input[data-date-input]");
      for (const input of inputs) {
        if (!input.value) { input.focus(); return; }
      }
      return;
    }
    const items: CreateItem[] = rows().map((r) => ({
      name: r.name,
      expiration_date: r.expiration_date,
    }));

    setSaving(true);
    try {
      await bulkCreateItems(items);
      setImportedCount(items.length + autoImportedCount());
      setDone(true);
      setRows([]);
      setParsed(false);
      focusMain();
    } finally {
      setSaving(false);
    }
  };

  useListNavigation();
  usePageShortcuts({
    f: () => {
      if (parsed() && rows().length > 0) {
        handleImport();
      } else if (!parsed()) {
        fileInputRef?.click();
      }
    },
  });


  const handleReset = () => {
    setRows([]);
    setParsed(false);
    setDone(false);
    setAutoImportedCount(0);
  };

  return (
    <div>
      <h2 class="text-2xl font-bold mb-6">Import Items</h2>

      <Show when={done()}>
        <div class="bg-success-light rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <p class="text-success font-medium">
            Imported {pluralize(importedCount(), "item")}!
          </p>
          <div class="flex gap-2">
            <a
              href="/inventory"
              class="text-sm px-4 py-2 bg-success/20 text-bark rounded-lg font-medium hover:bg-success/30 transition-colors"
            >
              View Inventory
            </a>
            <button
              onClick={() => setDone(false)}
              class="text-xs text-bark-muted hover:text-bark px-3 py-1 rounded-lg hover:bg-champagne transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </Show>

      <Show when={!parsed()}>
        <div class="bg-cream rounded-xl p-5 border border-champagne/40 shadow-sm">
          <p class="text-sm text-bark-muted mb-3">
            Upload a CSV file. Format: <code class="bg-champagne/40 px-1.5 py-0.5 rounded text-xs">name,expiration_date</code>
          </p>
          <p class="text-xs text-bark-muted mb-4">
            Items with expiration dates are imported automatically — you'll only need to review items missing dates.
          </p>

          <input
            ref={(el) => (fileInputRef = el)}
            type="file"
            accept=".csv,.txt"
            class="hidden"
            tabindex={-1}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef?.click()}
            class="px-5 py-2.5 bg-jasmine text-bark font-semibold rounded-xl hover:bg-jasmine-dark transition-colors shadow-sm flex items-center gap-2"
            data-f-target
          >
            Upload CSV
            <kbd class="text-xs bg-bark/10 px-1.5 py-0.5 rounded font-mono">F</kbd>
          </button>
        </div>
      </Show>

      <Show when={parsed() && rows().length > 0}>
        <Show when={autoImportedCount() > 0}>
          <div class="bg-success-light rounded-xl px-5 py-3 mb-4">
            <p class="text-sm text-success font-medium">
              {pluralize(autoImportedCount(), "item")} with expiration dates imported automatically.
            </p>
          </div>
        </Show>

        <div class="flex items-center justify-between mb-4">
          <p class="text-sm text-bark-muted">
            {pluralize(rows().length, "item")} need expiration dates
          </p>
          <div class="flex gap-2">
            <button
              onClick={handleImport}
              disabled={saving() || rows().length === 0 || !allHaveDates()}
              class="px-5 py-2.5 bg-jasmine text-bark font-semibold rounded-xl hover:bg-jasmine-dark disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
              data-f-target
            >
              {saving()
                ? "Importing..."
                : !allHaveDates()
                  ? `${missingCount()} missing date${missingCount() > 1 ? "s" : ""}`
                  : `Import ${pluralize(rows().length, "item")}`}
              <Show when={allHaveDates() && !saving()}>
                <kbd class="text-xs bg-bark/10 px-1.5 py-0.5 rounded font-mono">F</kbd>
              </Show>
            </button>
            <button
              onClick={handleReset}
              class="px-5 py-2.5 bg-champagne text-bark-muted rounded-xl hover:bg-champagne/80 transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>

        <div class="space-y-2" role="list" aria-label="Import rows">
          <Index each={rows()}>
            {(row) => (
              <div role="listitem" class={`flex items-center gap-3 rounded-xl px-4 py-3 border ${!row().expiration_date ? "bg-warning-light border-warning/30" : "bg-surface border-champagne/30"}`}>
                <div class="flex-1 grid grid-cols-2 gap-3 items-center">
                  <p class="text-sm font-medium text-bark truncate" title={titleCase(row().name)}>
                    {titleCase(row().name)}
                  </p>
                  <DateInput
                    value={row().expiration_date}
                    onChange={(d) => updateRow(row().key, "expiration_date", d)}
                    class={INPUT_CLASS_SM}
                    data-date-input
                  />
                </div>
                <button
                  onClick={() => removeRow(row().key)}
                  class="p-3 ml-1 text-bark-light hover:text-danger hover:bg-danger-light rounded-xl transition-colors shrink-0"
                  title="Remove row"
                  aria-label={`Remove ${titleCase(row().name)}`}
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </Index>
        </div>
      </Show>
    </div>
  );
}
