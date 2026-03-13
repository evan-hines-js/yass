import { createSignal, onMount, For, Show } from "solid-js";
import type { RestockCandidate } from "../lib/types";
import { getRestockCandidates, bulkRestock, hideFromRestock } from "../lib/tauri";
import { titleCase, pluralize, formatShortDate } from "../lib/format";
import { usePageShortcuts, useListNavigation, focusFTarget } from "../lib/shortcuts";
import { useUndo } from "../lib/undo";
import { playSuccess } from "../lib/sounds";
import DateInput from "../components/DateInput";
import ConfirmModal from "../components/ConfirmModal";

interface SelectedItem {
  candidate: RestockCandidate;
  expiration_date: string;
}

function enrichCandidate(c: RestockCandidate): SelectedItem {
  return { candidate: c, expiration_date: "" };
}

export default function Restock() {
  const [candidates, setCandidates] = createSignal<RestockCandidate[]>([]);
  const [selected, setSelected] = createSignal<Map<string, SelectedItem>>(new Map());
  const [saving, setSaving] = createSignal(false);
  const [done, setDone] = createSignal(false);
  const [restockedCount, setRestockedCount] = createSignal(0);
  const [hidingCandidate, setHidingCandidate] = createSignal<RestockCandidate | null>(null);

  const load = async () => {
    setCandidates(await getRestockCandidates());
    setSelected(new Map());
    setDone(false);
    await undo.refreshUndo();
  };

  onMount(load);

  const undo = useUndo("restock", load);

  useListNavigation();
  usePageShortcuts({
    s: () => selectOutOfStock(),
    ss: () => selectAll(),
    f: () => { if (selected().size > 0) handleRestock(); },
    z: () => undo.askUndo(),
  });


  const toggle = (c: RestockCandidate) => {
    const next = new Map(selected());
    if (next.has(c.id)) {
      next.delete(c.id);
    } else {
      next.set(c.id, enrichCandidate(c));
    }
    setSelected(next);
  };

  const selectAll = () => {
    if (selected().size === candidates().length) {
      setSelected(new Map());
    } else {
      const next = new Map<string, SelectedItem>();
      for (const c of candidates()) {
        next.set(c.id, enrichCandidate(c));
      }
      setSelected(next);
    }
    focusFTarget();
  };

  /** Select only out-of-stock items (the ones she actually needs to restock) */
  const selectOutOfStock = () => {
    const oos = candidates().filter((c) => !c.in_stock);
    if (oos.length === 0) return;
    const allAlready = oos.every((c) => selected().has(c.id));
    if (allAlready) {
      setSelected(new Map());
    } else {
      const next = new Map<string, SelectedItem>();
      for (const c of oos) {
        next.set(c.id, enrichCandidate(c));
      }
      setSelected(next);
    }
    focusFTarget();
  };

  const updateSelected = (id: string, patch: Partial<SelectedItem>) => {
    const next = new Map(selected());
    const item = next.get(id);
    if (item) {
      next.set(id, { ...item, ...patch });
      setSelected(next);
    }
  };

  const missingDates = () =>
    Array.from(selected().values()).filter((s) => !s.expiration_date);

  const handleRestock = async () => {
    const items = Array.from(selected().values());
    if (items.length === 0) return;
    if (missingDates().length > 0) {
      // Focus the first empty date input
      const firstMissingId = missingDates()[0].candidate.id;
      const el = document.querySelector<HTMLElement>(`[data-restock-date="${firstMissingId}"]`);
      el?.focus();
      return;
    }

    setSaving(true);
    try {
      await bulkRestock(
        items.map((s) => ({
          source_id: s.candidate.id,
          expiration_date: s.expiration_date || undefined,
        })),
      );
      setRestockedCount(items.length);
      playSuccess();
      setDone(true);
      setCandidates(await getRestockCandidates());
      setSelected(new Map());
    } finally {
      setSaving(false);
    }
  };

  const doHide = async () => {
    const c = hidingCandidate();
    if (!c) return;
    await hideFromRestock(c.id);
    setCandidates(await getRestockCandidates());
    const next = new Map(selected());
    next.delete(c.id);
    setSelected(next);
    setHidingCandidate(null);
  };

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <div>
          <div class="flex items-center gap-3">
            <h2 class="text-2xl font-bold">Buy Again</h2>
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
          <p class="text-sm text-bark-muted mt-1">
            Pick items you bought, set new expiration dates, and add them all at once.
          </p>
        </div>
        <Show when={selected().size > 0}>
          <div class="flex items-center gap-3">
            <Show when={missingDates().length > 0}>
              <p class="text-sm text-danger">{pluralize(missingDates().length, "item")} missing expiration date</p>
            </Show>
            <button
              onClick={handleRestock}
              disabled={saving() || missingDates().length > 0}
              class="px-5 py-2.5 bg-jasmine text-bark font-semibold rounded-lg hover:bg-jasmine/80 disabled:opacity-50 transition-colors flex items-center gap-2"
              data-f-target
            >
              {saving()
                ? "Restocking..."
                : `Restock ${pluralize(selected().size, "item")}`}
              <kbd class="text-xs bg-bark/10 px-1.5 py-0.5 rounded font-mono">F</kbd>
            </button>
          </div>
        </Show>
      </div>

      <Show when={done()}>
        <div class="bg-success/20 rounded-xl px-4 py-3 mb-6 flex items-center justify-between" role="status">
          <p class="text-sm font-medium">
            Restocked {pluralize(restockedCount(), "item")}!
          </p>
          <button
            onClick={() => setDone(false)}
            class="text-xs text-bark-muted hover:text-bark px-3 py-2"
          >
            Dismiss
          </button>
        </div>
      </Show>

      <Show
        when={candidates().length > 0}
        fallback={
          <div class="text-center py-12 text-bark-muted">
            <p class="text-lg">No items yet</p>
            <p class="text-sm mt-1">
              Add items to your inventory first — they'll appear here for quick re-ordering.
            </p>
          </div>
        }
      >
        <div class="mb-3 flex items-center gap-3">
          <button
            onClick={selectOutOfStock}
            class="text-sm text-bark-muted hover:text-bark transition-colors flex items-center gap-1.5"
          >
            Select out-of-stock
            <kbd class="text-xs bg-champagne/60 px-1.5 py-0.5 rounded font-mono">S</kbd>
          </button>
          <button
            onClick={selectAll}
            class="text-sm text-bark-muted hover:text-bark transition-colors flex items-center gap-1.5"
          >
            {selected().size === candidates().length ? "Deselect all" : "All"}
            <kbd class="text-xs bg-champagne/60 px-1.5 py-0.5 rounded font-mono">SS</kbd>
          </button>
        </div>

        <div class="space-y-2" role="list" aria-label="Restock candidates">
          <For each={candidates()}>
            {(c) => {
              const isSelected = () => selected().has(c.id);
              const sel = () => selected().get(c.id);

              return (
                <div
                  role="listitem"
                  class={`rounded-xl px-4 py-4 transition-all border-2 ${
                    isSelected()
                      ? "border-jasmine bg-jasmine-light"
                      : "border-transparent bg-surface hover:border-champagne"
                  }`}
                >
                  <div class="flex items-center gap-3">
                    {/* Checkbox + item info — click anywhere here to toggle selection */}
                    <div
                      role="checkbox"
                      aria-checked={isSelected()}
                      aria-label={`Select ${titleCase(c.name)}`}
                      tabindex="0"
                      class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-jasmine focus-visible:ring-offset-2"
                      onClick={() => toggle(c)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggle(c);
                        }
                      }}
                    >
                      <div
                        class={`w-10 h-10 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected()
                            ? "bg-jasmine border-jasmine"
                            : "border-champagne bg-white"
                        }`}
                      >
                        <Show when={isSelected()}>
                          <svg
                            class="w-5 h-5 text-bark"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="3"
                            aria-hidden="true"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </Show>
                      </div>

                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <p class="text-lg font-medium">{titleCase(c.name)}</p>
                          <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            c.in_stock
                              ? "bg-success/20 text-bark"
                              : "bg-bark-muted/15 text-bark-muted"
                          }`}>
                            {c.in_stock ? "In Stock" : "Out"}
                          </span>
                        </div>
                      </div>

                      <Show when={!isSelected() && c.expiration_date}>
                        <span class="text-xs text-bark-muted">
                          was {formatShortDate(c.expiration_date)}
                        </span>
                      </Show>
                    </div>

                    <Show when={isSelected() && sel()}>
                      <div class="flex items-center gap-3 ml-2">
                        <div>
                          <label class="text-xs uppercase text-bark-muted font-semibold">
                            Expires
                          </label>
                          <DateInput
                            value={sel()!.expiration_date}
                            onChange={(d) => updateSelected(c.id, { expiration_date: d })}
                            class="w-28 px-2 py-2 text-sm rounded-lg border border-champagne bg-white text-bark focus:outline-none focus:ring-2 focus:ring-jasmine"
                            data-restock-date={c.id}
                          />
                        </div>
                      </div>
                    </Show>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHidingCandidate(c);
                      }}
                      tabindex={-1}
                      class="ml-3 p-3 text-bark-light hover:text-danger hover:bg-danger-light rounded-xl transition-colors shrink-0"
                      title="Hide from Buy Again"
                      aria-label={`Hide ${titleCase(c.name)} from Buy Again`}
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      <ConfirmModal
        open={!!hidingCandidate()}
        title="Hide from Buy Again"
        message={`Hide "${titleCase(hidingCandidate()?.name ?? "")}"? It won't show up in this list anymore.`}
        confirmLabel="Hide"
        onConfirm={doHide}
        onCancel={() => setHidingCandidate(null)}
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
