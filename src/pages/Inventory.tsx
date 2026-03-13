import { createSignal, createMemo, onMount, For, Show } from "solid-js";
import type { Item, ItemGroup } from "../lib/types";
import { getItems, removeItem, pushUndo } from "../lib/tauri";
import ItemForm from "../components/ItemForm";
import ExpirationBadge from "../components/ExpirationBadge";
import ConfirmModal from "../components/ConfirmModal";
import { titleCase, pluralize, groupItems, todayStr } from "../lib/format";
import { usePageShortcuts, useListNavigation, focusFTarget } from "../lib/shortcuts";
import { useUndo } from "../lib/undo";
import { playSuccess } from "../lib/sounds";

export default function Inventory() {
  const [items, setItems] = createSignal<Item[]>([]);
  const [showForm, setShowForm] = createSignal(false);
  const [editingItem, setEditingItem] = createSignal<Item | undefined>();
  const [expanded, setExpanded] = createSignal<string | null>(null);
  const [selected, setSelected] = createSignal<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = createSignal<{
    reason: string;
    title: string;
    message: string;
    label: string;
  } | null>(null);
  const [tossAction, setTossAction] = createSignal<{
    items: Item[];
    name: string;
  } | null>(null);
  const [confirmAction, setConfirmAction] = createSignal<{
    items: Item[];
    reason: string;
    title: string;
    message: string;
    label: string;
  } | null>(null);

  const load = async () => {
    setItems(await getItems());
    setSelected(new Set<string>());
    await undo.refreshUndo();
    focusFTarget();
  };
  onMount(load);

  const undo = useUndo("inventory", load);

  useListNavigation();
  usePageShortcuts({
    a: () => handleAdd(),
    s: () => selectExpiringSoon(),
    ss: () => selectAll(),
    f: () => tossOrAdd(),
    z: () => undo.askUndo(),
  });

  const groups = createMemo(() => groupItems(items()));


  const handleAdd = () => {
    setEditingItem(undefined);
    setShowForm(true);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleSaved = async () => {
    setShowForm(false);
    setEditingItem(undefined);
    await load();
  };

  const askTossGroup = (group: ItemGroup) => {
    setTossAction({
      items: group.items,
      name: titleCase(group.name),
    });
  };

  const askRemoveGroup = (group: ItemGroup) => {
    const name = titleCase(group.name);
    const n = group.items.length;
    setConfirmAction({
      items: group.items,
      reason: "mistake",
      title: "Remove Item",
      message: `Remove "${name}"? Use this if it was added by mistake.`,
      label: n > 1 ? `Remove ${n}` : "Remove",
    });
  };

  const doToss = async () => {
    const action = tossAction();
    if (!action) return;
    try {
      for (const item of action.items) {
        await removeItem(item.id, "tossed");
      }
      const ids = action.items.map((i) => i.id);
      await pushUndo("inventory", "tossed", JSON.stringify({ type: "toss_full", item_ids: ids }), `Tossed ${action.name}`);
      setTossAction(null);
      playSuccess();
      await load();
    } catch (e) {
      console.error("Toss failed:", e);
    }
  };

  const doRemove = async () => {
    const action = confirmAction();
    if (!action) return;
    try {
      for (const item of action.items) {
        await removeItem(item.id, action.reason);
      }
      const ids = action.items.map((i) => i.id);
      const label = `Removed ${action.items.length} items`;
      await pushUndo("inventory", "remove", JSON.stringify({ type: "remove", item_ids: ids }), label);
      setConfirmAction(null);
      playSuccess();
      await load();
    } catch (e) {
      console.error("Remove failed:", e);
    }
  };

  const toggleGroup = (group: ItemGroup) => {
    const next = new Set(selected());
    const allSelected = group.items.every((i) => next.has(i.id));
    if (allSelected) {
      for (const i of group.items) next.delete(i.id);
    } else {
      for (const i of group.items) next.add(i.id);
    }
    setSelected(next);
  };

  const selectAll = () => {
    if (selected().size === items().length) {
      setSelected(new Set<string>());
    } else {
      setSelected(new Set(items().map((i) => i.id)));
    }
    focusFTarget();
  };

  const selectExpiringSoon = () => {
    const today = new Date(todayStr() + "T00:00:00");
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 5);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const urgent = items().filter(
      (i) => i.expiration_date && i.expiration_date <= cutoffStr
    );
    if (urgent.length === 0) return;

    const allAlready = urgent.every((i) => selected().has(i.id));
    if (allAlready) {
      setSelected(new Set<string>());
    } else {
      setSelected(new Set(urgent.map((i) => i.id)));
    }
    focusFTarget();
  };

  const firstExpiringSoonKey = () => {
    const today = new Date(todayStr() + "T00:00:00");
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 5);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const sorted = groups()
      .filter((g) => g.expiration_date && g.expiration_date <= cutoffStr)
      .sort((a, b) => a.expiration_date!.localeCompare(b.expiration_date!));
    return sorted.length > 0 ? sorted[0].key : null;
  };

  const tossOrAdd = () => {
    const key = firstExpiringSoonKey();
    const group = key ? groups().find((g) => g.key === key) : null;
    if (group) askTossGroup(group);
    else handleAdd();
  };

  const selCount = () => selected().size;

  const askBulk = (reason: string) => {
    const n = selCount();
    const isToss = reason === "tossed";
    setBulkAction({
      reason,
      title: isToss ? `Toss ${pluralize(n, "Item")}` : `Remove ${pluralize(n, "Item")}`,
      message: isToss
        ? `Mark ${pluralize(n, "item")} as tossed? They'll move out of your active inventory.`
        : `Remove ${pluralize(n, "item")}? Use this if they were added by mistake.`,
      label: isToss ? `Toss ${n}` : `Remove ${n}`,
    });
  };

  const doBulk = async () => {
    const action = bulkAction();
    if (!action) return;
    try {
      const ids = Array.from(selected());
      for (const id of ids) {
        await removeItem(id, action.reason);
      }
      const isToss = action.reason === "tossed";
      const label = `${isToss ? "Tossed" : "Removed"} ${ids.length} items`;
      const type = isToss ? "toss_full" : "remove";
      await pushUndo("inventory", action.reason, JSON.stringify({ type, item_ids: ids }), label);
      setBulkAction(null);
      playSuccess();
      await load();
    } catch (e) {
      console.error("Bulk remove failed:", e);
    }
  };

  const toggleExpand = (key: string) => {
    setExpanded(expanded() === key ? null : key);
  };

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <h2 class="text-2xl font-bold">Inventory</h2>
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
          + Add Item
          <kbd class="text-xs bg-bark/10 px-1.5 py-0.5 rounded font-mono">A</kbd>
        </button>
      </div>

      <Show when={showForm()}>
        <div class="bg-cream rounded-xl p-5 mb-6 border border-champagne/40 shadow-sm">
          <h3 class="text-lg font-semibold mb-4">
            {editingItem() ? "Edit Item" : "New Item"}
          </h3>
          <ItemForm
            item={editingItem()}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        </div>
      </Show>

      <Show
        when={items().length > 0}
        fallback={
          <div class="text-center py-16 text-bark-muted">
            <p class="text-lg">No items yet</p>
            <p class="text-sm mt-1">Add your first inventory item to get started.</p>
          </div>
        }
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <button
              onClick={selectExpiringSoon}
              class="text-sm text-bark-muted hover:text-bark transition-colors flex items-center gap-1.5"
            >
              Select expiring
              <kbd class="text-xs bg-champagne/60 px-1.5 py-0.5 rounded font-mono">S</kbd>
            </button>
            <button
              onClick={selectAll}
              class="text-sm text-bark-muted hover:text-bark transition-colors flex items-center gap-1.5"
            >
              {selected().size === items().length ? "Deselect all" : "All"}
              <kbd class="text-xs bg-champagne/60 px-1.5 py-0.5 rounded font-mono">SS</kbd>
            </button>
          </div>
          <Show when={selCount() > 0}>
            <div class="flex gap-3">
              <button
                onClick={() => askBulk("tossed")}
                class="px-5 py-3 bg-warning-light text-bark rounded-xl font-medium hover:bg-warning/20 transition-colors flex items-center gap-2"
                data-f-target
              >
                Toss {pluralize(selCount(), "item")}
                <kbd class="text-xs bg-bark/10 px-1.5 py-0.5 rounded font-mono">F</kbd>
              </button>
              <button
                onClick={() => askBulk("mistake")}
                class="px-5 py-3 bg-danger-light text-danger rounded-xl font-medium hover:bg-danger/20 transition-colors"
              >
                Remove {pluralize(selCount(), "item")}
              </button>
            </div>
          </Show>
        </div>

        <div class="space-y-2" role="list" aria-label="Inventory items">
          <For each={groups()}>
            {(group) => {
              const allSelected = () => group.items.every((i) => selected().has(i.id));
              const isExpanded = () => expanded() === group.key;
              return (
                <div
                  role="listitem"
                  class={`flex flex-wrap items-center gap-3 rounded-xl px-5 py-4 border card-hover transition-all ${
                    allSelected()
                      ? "border-jasmine bg-jasmine-light"
                      : "border-champagne/30 bg-surface"
                  }`}
                >
                  <div
                    role="checkbox"
                    aria-checked={allSelected()}
                    aria-label={`Select ${titleCase(group.name)}`}
                    tabindex="-1"
                    class="flex items-center gap-3 cursor-pointer shrink-0 flex-1 min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-jasmine focus-visible:ring-offset-2"
                    onClick={() => toggleGroup(group)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        toggleGroup(group);
                      }
                    }}
                  >
                    <div
                      class={`w-10 h-10 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                        allSelected()
                          ? "bg-jasmine border-jasmine"
                          : "border-champagne bg-white"
                      }`}
                    >
                      <Show when={allSelected()}>
                        <svg class="w-5 h-5 text-bark" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </Show>
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-lg font-medium">
                          {titleCase(group.name)}
                          <Show when={group.count > 1}>
                            <span class="text-bark-muted font-normal text-sm ml-1">x{group.count}</span>
                          </Show>
                        </p>
                        <ExpirationBadge date={group.expiration_date} />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    tabindex={-1}
                    class="p-3 -mr-2 rounded-xl hover:bg-champagne transition-colors shrink-0"
                    onClick={() => toggleExpand(group.key)}
                    aria-expanded={isExpanded()}
                    aria-label={`${isExpanded() ? "Collapse" : "Expand"} actions for ${titleCase(group.name)}`}
                  >
                    <svg
                      class={`w-5 h-5 text-bark-muted transition-transform ${isExpanded() ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                      aria-hidden="true"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <button
                    onClick={() => askTossGroup(group)}
                    class="px-5 py-3 bg-warning-light text-bark rounded-xl font-medium hover:bg-warning/20 transition-colors shrink-0"
                    {...(firstExpiringSoonKey() === group.key ? { "data-f-target": "" } : {})}
                  >
                    Toss
                  </button>

                  <Show when={isExpanded()}>
                    <div class="flex gap-3 pt-3 mt-3 border-t border-champagne/40 w-full">
                      <button
                        tabindex={-1}
                        onClick={() => handleEdit(group.items[0])}
                        class="flex-1 py-3 bg-champagne text-bark rounded-xl font-medium hover:bg-jasmine-light transition-colors text-center focus-visible:ring-2 focus-visible:ring-jasmine focus-visible:ring-offset-2"
                      >
                        Edit
                      </button>
                      <button
                        tabindex={-1}
                        onClick={() => askRemoveGroup(group)}
                        class="flex-1 py-3 bg-danger-light text-danger rounded-xl font-medium hover:bg-danger/20 transition-colors text-center focus-visible:ring-2 focus-visible:ring-jasmine focus-visible:ring-offset-2"
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
        open={!!tossAction()}
        title={`Toss ${tossAction()?.name ?? ""}`}
        message={`Mark "${tossAction()?.name ?? ""}" as tossed?`}
        confirmLabel="Toss"
        confirmClass="px-5 py-2.5 bg-warning/30 text-bark rounded-xl hover:bg-warning/50 transition-colors font-medium"
        onConfirm={doToss}
        onCancel={() => setTossAction(null)}
      />

      <ConfirmModal
        open={!!bulkAction()}
        title={bulkAction()?.title ?? ""}
        message={bulkAction()?.message ?? ""}
        confirmLabel={bulkAction()?.label}
        confirmClass={
          bulkAction()?.reason === "tossed"
            ? "px-5 py-2.5 bg-warning/30 text-bark rounded-xl hover:bg-warning/50 transition-colors font-medium"
            : undefined
        }
        onConfirm={doBulk}
        onCancel={() => setBulkAction(null)}
      />

      <ConfirmModal
        open={!!confirmAction()}
        title={confirmAction()?.title ?? ""}
        message={confirmAction()?.message ?? ""}
        confirmLabel={confirmAction()?.label}
        onConfirm={doRemove}
        onCancel={() => setConfirmAction(null)}
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
