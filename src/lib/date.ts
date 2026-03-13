/** Parse shorthand date input into YYYY-MM-DD.
 *
 * Designed for one-handed input — any non-digit character works as a
 * month/day separator, so you can hit whatever key is nearest.
 *
 * If the resulting date is in the past:
 *  - Day-only input: bumps to next month (e.g. "25" on Mar 28 → Apr 25)
 *  - Month+day input: bumps to next year (e.g. "2~15" on Mar 10 → 2027-02-15)
 *  - Full ISO dates are never bumped
 *
 * Examples (assuming current date is March 10, 2026):
 *  "25"      → 2026-03-25  (current month, day 25)
 *  "5"       → 2026-04-05  (Mar 5 is past → bumped to Apr 5)
 *  "325"     → 2026-03-25  (1-digit month + 2-digit day)
 *  "1225"    → 2026-12-25  (2-digit month + 2-digit day)
 *  "3/25"    → 2026-03-25  (any separator works: / - ~ ` . ! @ # etc.)
 *  "3 25"    → 2026-03-25  (space works too)
 *  "1~5"     → 2027-01-05  (Jan 5 is past → bumped to next year)
 *  Full ISO  → pass through as-is
 *
 * Returns null if the input can't be parsed into a valid date.
 */
export function parseShortDate(raw: string, now?: Date): string | null {
  // Normalize: strip trailing non-digit characters
  let s = raw.trim().replace(/\D+$/, "");
  if (!s) return null;

  const ref = now ?? new Date();
  const year = ref.getFullYear();
  const month = ref.getMonth() + 1;
  const day = ref.getDate();

  const fmtYmd = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const fmt = (m: number, d: number) => fmtYmd(year, m, d);
  const valid = (y: number, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  };
  const ok = (m: number, d: number) => valid(year, m, d);

  // Check if m/d in the given year is before today
  const isPast = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d) < new Date(year, month - 1, day);

  // Day-only: bump to next month if in the past
  const dayResult = (m: number, d: number) => {
    if (!ok(m, d)) return null;
    if (!isPast(year, m, d)) return fmt(m, d);
    // Bump month
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? year + 1 : year;
    if (valid(ny, nm, d)) return fmtYmd(ny, nm, d);
    return fmt(m, d); // fallback (e.g. Jan 31 → Feb 31 invalid)
  };

  // Month+day: bump to next year if in the past
  const monthDayResult = (m: number, d: number) => {
    if (!ok(m, d)) return null;
    if (!isPast(year, m, d)) return fmt(m, d);
    if (valid(year + 1, m, d)) return fmtYmd(year + 1, m, d);
    return fmt(m, d); // fallback
  };

  // Full ISO date — pass through, no bumping
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // With any non-digit separator: "3/25", "3~25", "3 25", "3!25", etc.
  const sep = s.match(/^(\d{1,2})\D+(\d{1,2})$/);
  if (sep) {
    return monthDayResult(parseInt(sep[1]), parseInt(sep[2]));
  }

  // Pure digits from here
  s = s.replace(/\D/g, "");

  // 1-2 digits: just a day in the current month
  if (/^\d{1,2}$/.test(s)) {
    return dayResult(month, parseInt(s));
  }

  // 3 digits: "325" → month 3, day 25; "101" → month 10, day 1
  // A leading zero on the day is never intentional, so if the middle digit
  // is 0 we read it as a 2-digit month + 1-digit day instead.
  if (/^\d{3}$/.test(s)) {
    if (s[1] === "0") {
      // e.g. "101" → month 10, day 1 (not month 1, day 01)
      const m2 = parseInt(s.slice(0, 2));
      const d2 = parseInt(s[2]);
      if (ok(m2, d2)) return monthDayResult(m2, d2);
    }
    return monthDayResult(parseInt(s[0]), parseInt(s.slice(1)));
  }

  // 4 digits: "1225" → month 12, day 25
  if (/^\d{4}$/.test(s)) {
    return monthDayResult(parseInt(s.slice(0, 2)), parseInt(s.slice(2)));
  }

  return null;
}
