import { Show, onMount, onCleanup } from "solid-js";
import { focusWithRing } from "../lib/shortcuts";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal(props: ConfirmModalProps) {
  let dialogRef: HTMLDivElement | undefined;
  let previousFocus: HTMLElement | null = null;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key.toLowerCase() === "w") {
      e.preventDefault();
      props.onCancel();
      return;
    }
    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      props.onConfirm();
      return;
    }
    // Focus trap — Q/E cycle between buttons (left-hand nav), Tab kept as fallback
    const trapKey = e.key === "Tab" || e.key.toLowerCase() === "q" || e.key.toLowerCase() === "e";
    if (trapKey && dialogRef) {
      const focusable = Array.from(dialogRef.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) return;
      const idx = focusable.indexOf(document.activeElement as HTMLElement);
      const backward = e.key === "Tab" ? e.shiftKey : e.key.toLowerCase() === "q";
      const nextIdx = backward
        ? (idx <= 0 ? focusable.length - 1 : idx - 1)
        : (idx >= focusable.length - 1 ? 0 : idx + 1);
      e.preventDefault();
      focusWithRing(focusable[nextIdx]);
    }
  };

  // Auto-focus first button and restore focus on close
  const setupFocus = () => {
    if (props.open && dialogRef) {
      previousFocus = document.activeElement as HTMLElement;
      const firstButton = dialogRef.querySelector<HTMLElement>("button");
      if (firstButton) focusWithRing(firstButton);
    }
  };

  onMount(() => {
    // Watch for open changes via effect-like pattern
    if (props.open) setupFocus();
  });

  onCleanup(() => {
    previousFocus?.focus();
  });

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onKeyDown={handleKeyDown}
        ref={(el) => {
          dialogRef = el;
          // Focus first button when modal opens
          requestAnimationFrame(() => {
            const btn = el.querySelector<HTMLElement>("button");
            previousFocus = document.activeElement as HTMLElement;
            if (btn) focusWithRing(btn);
          });
        }}
      >
        <div class="absolute inset-0 bg-bark/30 backdrop-blur-sm" onClick={props.onCancel} aria-hidden="true" />
        <div class="relative bg-ivory rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 border border-champagne/50">
          <h3 id="confirm-modal-title" class="text-xl font-semibold mb-2">{props.title}</h3>
          <p class="text-bark-muted mb-6">{props.message}</p>
          <div class="flex justify-end gap-3">
            <button
              onClick={props.onCancel}
              class="px-5 py-2.5 bg-champagne rounded-xl hover:bg-champagne/80 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={props.onConfirm}
              class={
                props.confirmClass ??
                "px-5 py-2.5 bg-danger-light text-danger rounded-xl hover:bg-danger/20 transition-colors font-medium"
              }
            >
              {props.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
