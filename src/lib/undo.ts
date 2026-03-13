import { createSignal } from "solid-js";
import type { UndoAction } from "./types";
import { getUndo, executeUndo } from "./tauri";
import { playUndo } from "./sounds";

/**
 * Per-page undo state + actions. Call once per page component.
 * The caller must invoke `refreshUndo()` after load (typically inside their `load()` function).
 */
export function useUndo(page: string, onUndone: () => Promise<void>) {
  const [undoAction, setUndoAction] = createSignal<UndoAction | null>(null);
  const [undoConfirming, setUndoConfirming] = createSignal(false);

  const refreshUndo = async () => {
    setUndoAction(await getUndo(page));
  };

  const askUndo = async () => {
    await refreshUndo();
    if (undoAction()) setUndoConfirming(true);
  };

  const doUndo = async () => {
    await executeUndo(page);
    playUndo();
    setUndoConfirming(false);
    setUndoAction(null);
    await onUndone();
  };

  const cancelUndo = () => setUndoConfirming(false);

  return { undoAction, undoConfirming, askUndo, doUndo, cancelUndo, refreshUndo };
}
