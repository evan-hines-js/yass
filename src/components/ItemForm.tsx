import { createSignal } from "solid-js";
import type { CreateItem, Item } from "../lib/types";
import { createItem, updateItem } from "../lib/tauri";
import { INPUT_CLASS, LABEL_CLASS } from "../lib/constants";
import DateInput from "./DateInput";

interface Props {
  item?: Item;
  onSaved: () => void;
  onCancel: () => void;
}

export default function ItemForm(props: Props) {
  const [name, setName] = createSignal(props.item?.name ?? "");
  const [expirationDate, setExpirationDate] = createSignal(props.item?.expiration_date ?? "");
  const [notes, setNotes] = createSignal(props.item?.notes ?? "");
  const [saving, setSaving] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    try {
      const input: CreateItem = {
        name: name(),
        expiration_date: expirationDate(),
        notes: notes() || undefined,
      };
      if (props.item) {
        await updateItem(props.item.id, input);
      } else {
        await createItem(input);
      }
      props.onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="space-y-4" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); props.onCancel(); } }}>
      <div>
        <label class={LABEL_CLASS}>Name *</label>
        <input
          class={INPUT_CLASS}
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          required
          aria-required="true"
          ref={(el) => requestAnimationFrame(() => el.focus())}
        />
      </div>

      <div>
        <label class={LABEL_CLASS}>Expiration Date *</label>
        <DateInput
          value={expirationDate()}
          onChange={setExpirationDate}
          class={INPUT_CLASS}
          placeholder="e.g. 25, 325, 3~25"
          required
        />
        <p class="text-xs text-bark-muted mt-1">Type day (25), month+day (325 or 3~25), or full date</p>
      </div>

      <div>
        <label class={LABEL_CLASS}>Notes</label>
        <textarea class={INPUT_CLASS} rows={2} value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} />
      </div>

      <div class="flex gap-3 pt-2">
        <button type="submit" disabled={saving()} class="px-5 py-2.5 bg-jasmine text-bark font-semibold rounded-xl hover:bg-jasmine-dark disabled:opacity-50 transition-colors shadow-sm">
          {saving() ? "Saving..." : props.item ? "Update" : "Add Item"}
        </button>
        <button type="button" onClick={props.onCancel} class="px-5 py-2.5 bg-champagne text-bark-muted rounded-xl hover:bg-champagne/80 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
