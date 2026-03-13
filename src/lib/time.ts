/** Parse shorthand time input into HH:00 (hours only, 24h stored).
 *
 * Bare digits = PM, trailing non-digit = AM.
 * Designed for left-hand-only input.
 *
 * Examples:
 *  "9~"  → "09:00"  (9 AM)
 *  "9"   → "21:00"  (9 PM)
 *  "12"  → "12:00"  (noon)
 *  "12~" → "00:00"  (midnight)
 *  "1e"  → "01:00"  (1 AM)
 *  "5"   → "17:00"  (5 PM)
 *
 * Returns null if the input can't be parsed into a valid time.
 */
export function parseShortTime(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const am = /\D$/.test(s);
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;

  const h12 = parseInt(digits);
  if (h12 < 1 || h12 > 12) return null;

  let h24: number;
  if (am) {
    h24 = h12 === 12 ? 0 : h12;
  } else {
    h24 = h12 === 12 ? 12 : h12 + 12;
  }

  return `${String(h24).padStart(2, "0")}:00`;
}

/** Format a stored HH:00 time for display. */
export function formatTime(time: string): string {
  const h = parseInt(time.split(":")[0]);
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  if (h < 12) return `${h}am`;
  return `${h - 12}pm`;
}
