import { createSignal } from "solid-js";
import { parseShortDate } from "../lib/date";

interface Props {
  value: string;
  onChange: (date: string) => void;
  class?: string;
  placeholder?: string;
  required?: boolean;
  "data-restock-date"?: string;
  "data-date-input"?: boolean;
}

/**
 * Shorthand date input — accepts day (25), month+day (325, 3~25), or full ISO.
 * Shows raw text while typing; resolves to YYYY-MM-DD on blur.
 */
export default function DateInput(props: Props) {
  const [display, setDisplay] = createSignal(props.value);

  return (
    <input
      type="text"
      placeholder={props.placeholder ?? "e.g. 25, 3~25"}
      class={props.class}
      value={display()}
      data-restock-date={props["data-restock-date"]}
      data-date-input={props["data-date-input"] || props["data-restock-date"] ? "" : undefined}
      required={props.required}
      aria-required={props.required ? "true" : undefined}
      onKeyDown={(e) => {
        const k = e.key.toLowerCase();
        if (k === "f") {
          e.preventDefault();
          // Jump to the first EMPTY date input (skip filled ones).
          // If all are filled, jump to the [data-f-target] submit button.
          const dateInputs = Array.from(
            document.querySelectorAll<HTMLInputElement>("input[data-date-input]")
          );
          const firstEmpty = dateInputs.find((el) => !el.value.trim());
          if (firstEmpty) {
            firstEmpty.focus();
          } else {
            const target = document.querySelector<HTMLElement>("[data-f-target]");
            if (target) target.focus();
          }
        } else if (k === "w") {
          e.preventDefault();
          // Blur first so global W handler can fire via re-dispatch
          e.currentTarget.blur();
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "w", code: "KeyW", bubbles: true }));
        } else if (
          // Block letters when there's no leading digit yet.
          // Letters after a digit are fine — they act as separators (e.g. "2e2" = Feb 2).
          e.key.length === 1 &&
          /[a-zA-Z]/.test(e.key) &&
          !e.ctrlKey && !e.metaKey && !e.altKey &&
          (!/^\d/.test(e.currentTarget.value) || /^\d{4}-\d{2}-\d{2}$/.test(e.currentTarget.value))
        ) {
          e.preventDefault();
        }
      }}
      onInput={(e) => {
        const raw = e.currentTarget.value;
        setDisplay(raw);
        const parsed = parseShortDate(raw);
        // Always update parent — clear stored date when input is invalid
        props.onChange(parsed ?? "");
      }}
      onBlur={(e) => {
        const raw = e.currentTarget.value;
        if (!raw) return;
        const parsed = parseShortDate(raw);
        if (parsed) {
          props.onChange(parsed);
          setDisplay(parsed);
        } else {
          // Invalid input — clear it
          props.onChange("");
          setDisplay("");
        }
      }}
    />
  );
}
