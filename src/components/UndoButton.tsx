import { Show } from "solid-js";
import ConfirmModal from "./ConfirmModal";
import type { useUndo } from "../lib/undo";

type UndoHook = ReturnType<typeof useUndo>;

/**
 * Undo button (shown when an undo action exists) + confirm modal.
 * Drop this into any page header alongside the useUndo hook.
 */
export default function UndoButton(props: { undo: UndoHook }) {
  return (
    <>
      <Show when={props.undo.undoAction()}>
        <button
          onClick={() => props.undo.askUndo()}
          class="px-3 py-1.5 text-sm bg-champagne text-bark rounded-lg hover:bg-champagne/80 transition-colors flex items-center gap-1.5"
        >
          Undo
          <kbd class="text-xs bg-bark/10 px-1 py-0.5 rounded font-mono">Z</kbd>
        </button>
      </Show>

      <ConfirmModal
        open={props.undo.undoConfirming()}
        title="Undo"
        message={`Undo: ${props.undo.undoAction()?.label}?`}
        confirmLabel="Undo"
        onConfirm={props.undo.doUndo}
        onCancel={props.undo.cancelUndo}
      />
    </>
  );
}
