import { onMount, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { getWhatsNext } from "./tauri";

/**
 * Focus an element and force the focus ring to be visible,
 * even after a mouse click (where :focus-visible wouldn't apply).
 */
export function focusWithRing(el: HTMLElement) {
  el.focus();
  el.setAttribute("data-focus-visible", "");
  el.addEventListener("blur", () => el.removeAttribute("data-focus-visible"), { once: true });
}

/** Focus the first interactive element in #main-content (or main itself). */
export function focusMain(selector?: string) {
  // Double-rAF: first rAF lets the router commit, second lets SolidJS render.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    const first = main.querySelector<HTMLElement>(
      selector ?? 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (first) focusWithRing(first);
    else main.focus();
  }));
}

/**
 * Focus what F will do next:
 * 1. First empty [data-date-input] (F jumps to next empty date), or
 * 2. The [data-f-target] submit button (F submits).
 *
 * Skips if the user is already typing in a date input to avoid stealing focus.
 */
export function focusFTarget() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    // Don't steal focus from a date input the user is actively typing in
    if ((document.activeElement as HTMLElement)?.hasAttribute?.("data-date-input")) return;

    const dateInputs = document.querySelectorAll<HTMLInputElement>("input[data-date-input]");
    for (const input of dateInputs) {
      if (!input.value.trim()) { focusWithRing(input); return; }
    }
    const el = document.querySelector<HTMLElement>("[data-f-target]");
    if (el) focusWithRing(el);
  }));
}

/** Returns true if the user is typing in a text field */
function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    // Allow shortcuts in checkboxes/radios but not text fields
    return !["checkbox", "radio", "range"].includes(type);
  }
  return tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

/** Returns true if focus is inside a <form> element */
function isInForm(): boolean {
  return !!(document.activeElement as HTMLElement)?.closest("form");
}

/**
 * Nav shortcuts — left-hand reachable keys.
 * Number keys for workflow-ordered pages, letter keys for less frequent ones.
 */
const NAV_KEYS: Record<string, string> = {
  "1": "/tasks",      // Daily driver
  "2": "/inventory",  // Toss expired
  "3": "/restock",    // Buy again
  "c": "/calendar",   // C for Calendar
  "d": "/",           // D for Dashboard
  "4": "/import",     // Semi-common
  "5": "/audit",      // Rare
};

/**
 * Global keyboard shortcuts — call once in Layout.
 * Handles number-key navigation.
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();

  const handler = (e: KeyboardEvent) => {
    // Backtick as left-hand Backspace — works inside text fields
    if (e.key === "`" && !e.ctrlKey && !e.metaKey && !e.altKey && isTyping()) {
      e.preventDefault();
      const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
      if (el.type === "number") {
        // Number inputs don't support selectionStart — trim last digit
        const val = el.value;
        if (val.length > 0) {
          el.value = val.slice(0, -1);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } else {
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        if (start === end && start > 0) {
          el.setRangeText("", start - 1, start, "end");
        } else if (start !== end) {
          el.setRangeText("", start, end, "end");
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }

    // Space on a focused link → click it (links only respond to Enter natively,
    // but Enter is right-hand only — Space is left-hand accessible)
    if (e.key === " " && document.activeElement instanceof HTMLAnchorElement) {
      e.preventDefault();
      document.activeElement.click();
      return;
    }

    // Never intercept when modifier keys are held (Ctrl+C, etc.)
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTyping()) return;

    // Inside a form, don't intercept nav/action keys.
    // User presses Escape to close the form first, then presses the key.
    if (isInForm()) return;

    // W → What's Next: navigate to most urgent action
    if (e.key.toLowerCase() === "w") {
      e.preventDefault();
      getWhatsNext().then((next) => {
        navigate(next.route);
        focusMain();
        // Show toast via custom event (pages listen for this)
        window.dispatchEvent(
          new CustomEvent("whats-next", { detail: next })
        );
      });
      return;
    }

    // Nav keys → navigate and focus main content
    // Bare number and letter keys — no Shift needed.
    let navKey: string | null = null;
    const code = e.code;
    if (code.startsWith("Digit")) {
      navKey = code[5];
    } else {
      const k = e.key.toLowerCase();
      if (k.length === 1 && k >= "a" && k <= "z") navKey = k;
    }
    const route = navKey ? NAV_KEYS[navKey] : undefined;
    if (route) {
      e.preventDefault();
      navigate(route);
      focusMain();
      return;
    }
  };

  onMount(() => document.addEventListener("keydown", handler));
  onCleanup(() => document.removeEventListener("keydown", handler));
}

/**
 * List navigation hook:
 *   Tab   →  next row (intercepted when not typing; natural in forms)
 *   Q / E →  move between elements within the current row,
 *            wrapping across rows at the edges (Q at first → prev row last,
 *            E at last → next row first). Q at top of list → open form.
 *
 * Primary action buttons (Toss, Done) use default tabindex so Tab lands
 * on them; secondary controls use tabindex="-1" so Tab skips them
 * but Q/E still reaches them.
 *
 * Call once per page that contains a [role="list"].
 */
export function useListNavigation() {
  /** All interactive elements in a row — includes tabindex="-1" for Q/E. */
  const ALL_INTERACTIVE =
    'button, [href], input, select, textarea, [tabindex="0"], [tabindex="-1"], [role="checkbox"]';

  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const active = document.activeElement as HTMLElement | null;
    if (!active) return;

    // Don't navigate the list behind an open modal
    if (active.closest("[role='dialog']")) return;

    // ── Tab: next row (only when not in a text field) ──
    if (e.key === "Tab" && !e.shiftKey && !isTyping()) {
      const currentItem = active.closest("[role='listitem']") as HTMLElement | null;
      // Let native Tab handle focus if not in a list row
      if (!currentItem) return;

      const list = currentItem.closest("[role='list']");
      if (!list) return;
      const items = Array.from(list.querySelectorAll<HTMLElement>(":scope > [role='listitem']"));
      const idx = items.indexOf(currentItem);
      if (idx === -1) return;

      if (idx + 1 < items.length) {
        e.preventDefault();
        // Land on the first tabbable element (primary action) in the next row
        const next = items[idx + 1].querySelector<HTMLElement>(
          'button:not([tabindex="-1"]), [tabindex="0"]'
        );
        if (next) focusWithRing(next);
      }
      // At bottom of list: let native Tab leave the list
      return;
    }

    if (isTyping()) return;

    const key = e.key.toLowerCase();
    const currentItem = active.closest("[role='listitem']") as HTMLElement | null;
    if (!currentItem) return;

    // ── Q/E: move within row, wrapping across rows at edges ──
    if (key === "q" || key === "e") {
      const focusable = Array.from(currentItem.querySelectorAll<HTMLElement>(ALL_INTERACTIVE));
      const idx = focusable.indexOf(active);
      if (idx === -1) return;

      const nextIdx = key === "q" ? idx - 1 : idx + 1;

      if (nextIdx >= 0 && nextIdx < focusable.length) {
        e.preventDefault();
        focusWithRing(focusable[nextIdx]);
        return;
      }

      // Wrap across rows
      const list = currentItem.closest("[role='list']");
      if (!list) return;
      const items = Array.from(list.querySelectorAll<HTMLElement>(":scope > [role='listitem']"));
      const rowIdx = items.indexOf(currentItem);
      if (rowIdx === -1) return;

      if (key === "q" && rowIdx === 0) {
        // At top of list — Q wraps to the open form if present
        const form = document.querySelector<HTMLElement>("form");
        if (!form) return;
        const first = form.querySelector<HTMLElement>(ALL_INTERACTIVE);
        if (first) { e.preventDefault(); focusWithRing(first); }
        return;
      }

      const wrapIdx = key === "q" ? rowIdx - 1 : rowIdx + 1;
      if (wrapIdx < 0 || wrapIdx >= items.length) return;

      const wrapFocusable = Array.from(items[wrapIdx].querySelectorAll<HTMLElement>(ALL_INTERACTIVE));
      if (wrapFocusable.length === 0) return;

      e.preventDefault();
      const target = key === "q" ? wrapFocusable[wrapFocusable.length - 1] : wrapFocusable[0];
      focusWithRing(target);
      return;
    }
  };

  onMount(() => document.addEventListener("keydown", handler));
  onCleanup(() => document.removeEventListener("keydown", handler));
}

/**
 * Page-level shortcuts. Pass a map of key → action.
 * Only fires when user is NOT in a text field and no modifiers held.
 *
 * Supports double-tap: use "ss" to fire when "s" is pressed twice within 300ms.
 * When a double-tap fires, the single-tap action is cancelled.
 *
 * Example:
 *   usePageShortcuts({ a: handleAdd, s: selectExpiring, ss: selectAll });
 */
export function usePageShortcuts(shortcuts: Record<string, () => void>) {
  let lastKey = "";
  let lastTime = 0;
  let singleTimer: ReturnType<typeof setTimeout> | undefined;

  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTyping()) return;
    if (document.querySelector("[role='dialog']")) return;

    const key = e.key.toLowerCase();
    const now = Date.now();
    const hasDoubleTap = (key + key) in shortcuts;

    // Check for double-tap: same key pressed within 300ms
    if (hasDoubleTap && key === lastKey && now - lastTime < 300) {
      e.preventDefault();
      clearTimeout(singleTimer);
      lastKey = "";
      lastTime = 0;
      shortcuts[key + key]();
      return;
    }

    const action = shortcuts[key];
    if (action) {
      e.preventDefault();
      lastKey = key;
      lastTime = now;

      if (hasDoubleTap) {
        // Delay single-tap to allow double-tap window
        clearTimeout(singleTimer);
        singleTimer = setTimeout(() => {
          lastKey = "";
          action();
        }, 300);
      } else {
        action();
      }
      return;
    }
  };

  onMount(() => document.addEventListener("keydown", handler));
  onCleanup(() => {
    document.removeEventListener("keydown", handler);
    clearTimeout(singleTimer);
  });
}
