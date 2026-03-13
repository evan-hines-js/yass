import { describe, it, expect } from "vitest";
import { parseShortDate } from "./date";

// Fix "now" to March 10, 2026 for deterministic tests
const NOW = new Date(2026, 2, 10); // month is 0-indexed → March
const Y = "2026";
const NY = "2027"; // next year (for past-date bumping)

describe("parseShortDate", () => {
  // ── Day only (1-2 digits) ──────────────────────────────────────────
  describe("day only", () => {
    it("future day in current month stays", () => {
      expect(parseShortDate("25", NOW)).toBe(`${Y}-03-25`);
    });
    it("today stays in current month", () => {
      expect(parseShortDate("10", NOW)).toBe(`${Y}-03-10`);
    });
    it("past day bumps to next month", () => {
      expect(parseShortDate("5", NOW)).toBe(`${Y}-04-05`);
    });
    it("day 1 bumps to next month (past)", () => {
      expect(parseShortDate("1", NOW)).toBe(`${Y}-04-01`);
    });
    it("day 31 stays in current month (future)", () => {
      expect(parseShortDate("31", NOW)).toBe(`${Y}-03-31`);
    });
    it("day 0 is invalid", () => {
      expect(parseShortDate("0", NOW)).toBeNull();
    });
    it("day 32 is invalid", () => {
      expect(parseShortDate("32", NOW)).toBeNull();
    });
    it("past day in December wraps to January next year", () => {
      const dec25 = new Date(2026, 11, 25); // Dec 25
      expect(parseShortDate("5", dec25)).toBe(`${NY}-01-05`);
    });
  });

  // ── Separator formats ──────────────────────────────────────────────
  describe("with slash separator", () => {
    it("future month+day stays", () => {
      expect(parseShortDate("3/25", NOW)).toBe(`${Y}-03-25`);
    });
    it("future month stays", () => {
      expect(parseShortDate("12/25", NOW)).toBe(`${Y}-12-25`);
    });
    it("past month bumps to next year", () => {
      expect(parseShortDate("1/5", NOW)).toBe(`${NY}-01-05`);
    });
    it("past day in current month bumps to next year", () => {
      expect(parseShortDate("3/5", NOW)).toBe(`${NY}-03-05`);
    });
  });

  describe("with dash separator", () => {
    it("future stays", () => {
      expect(parseShortDate("3-25", NOW)).toBe(`${Y}-03-25`);
    });
    it("future month stays", () => {
      expect(parseShortDate("12-31", NOW)).toBe(`${Y}-12-31`);
    });
    it("past bumps to next year", () => {
      expect(parseShortDate("2-15", NOW)).toBe(`${NY}-02-15`);
    });
  });

  describe("with dot separator", () => {
    it("future stays", () => {
      expect(parseShortDate("3.25", NOW)).toBe(`${Y}-03-25`);
    });
    it("future month stays", () => {
      expect(parseShortDate("11.1", NOW)).toBe(`${Y}-11-01`);
    });
  });

  // ── Tilde separator (one-handed friendly) ──────────────────────────
  describe("with tilde separator", () => {
    it("future stays", () => {
      expect(parseShortDate("3~25", NOW)).toBe(`${Y}-03-25`);
    });
    it("past month bumps to next year", () => {
      expect(parseShortDate("1~5", NOW)).toBe(`${NY}-01-05`);
    });
    it("future month stays", () => {
      expect(parseShortDate("12~25", NOW)).toBe(`${Y}-12-25`);
    });
    it("trailing tilde stripped, past bumps", () => {
      expect(parseShortDate("1~5~", NOW)).toBe(`${NY}-01-05`);
    });
    it("trailing tildes stripped, future stays", () => {
      expect(parseShortDate("3~25~~", NOW)).toBe(`${Y}-03-25`);
    });
  });

  // ── Backtick separator (one-handed friendly) ───────────────────────
  describe("with backtick separator", () => {
    it("future stays", () => {
      expect(parseShortDate("3`25", NOW)).toBe(`${Y}-03-25`);
    });
    it("past month bumps to next year", () => {
      expect(parseShortDate("1`5", NOW)).toBe(`${NY}-01-05`);
    });
    it("trailing backtick, future stays", () => {
      expect(parseShortDate("3`5`", NOW)).toBe(`${NY}-03-05`);
    });
    it("trailing backtick, past bumps", () => {
      expect(parseShortDate("1`5`", NOW)).toBe(`${NY}-01-05`);
    });
  });

  // ── Compact digit formats (no separator) ───────────────────────────
  describe("3-digit compact (Mdd)", () => {
    it("future stays: 325 → March 25", () => {
      expect(parseShortDate("325", NOW)).toBe(`${Y}-03-25`);
    });
    it("no leading zero: 105 → Oct 5 (not Jan 05)", () => {
      expect(parseShortDate("105", NOW)).toBe(`${Y}-10-05`);
    });
    it("invalid month/day: 931 (Sept has 30 days)", () => {
      expect(parseShortDate("931", NOW)).toBeNull();
    });
    it("invalid: 230 (Feb 30)", () => {
      expect(parseShortDate("230", NOW)).toBeNull();
    });
    it("past bumps: 115 → next year Jan 15", () => {
      expect(parseShortDate("115", NOW)).toBe(`${NY}-01-15`);
    });
    it("future stays: 415 → April 15", () => {
      expect(parseShortDate("415", NOW)).toBe(`${Y}-04-15`);
    });
    it("no leading zero: 101 → Oct 1", () => {
      expect(parseShortDate("101", NOW)).toBe(`${Y}-10-01`);
    });
    it("no leading zero: 109 → Oct 9", () => {
      expect(parseShortDate("109", NOW)).toBe(`${Y}-10-09`);
    });
    it("no leading zero: 100 → invalid (Oct 0)", () => {
      expect(parseShortDate("100", NOW)).toBeNull();
    });
  });

  describe("4-digit compact (MMdd)", () => {
    it("future stays: 1225 → Dec 25", () => {
      expect(parseShortDate("1225", NOW)).toBe(`${Y}-12-25`);
    });
    it("future stays: 0325 → March 25", () => {
      expect(parseShortDate("0325", NOW)).toBe(`${Y}-03-25`);
    });
    it("past bumps: 0105 → next year Jan 5", () => {
      expect(parseShortDate("0105", NOW)).toBe(`${NY}-01-05`);
    });
    it("future stays: 1231 → Dec 31", () => {
      expect(parseShortDate("1231", NOW)).toBe(`${Y}-12-31`);
    });
    it("invalid month 13", () => {
      expect(parseShortDate("1301", NOW)).toBeNull();
    });
    it("Feb 29 invalid in non-leap 2026", () => {
      expect(parseShortDate("0229", NOW)).toBeNull();
    });
  });

  // ── Full ISO date passthrough (never bumped) ─────────────────────
  describe("full ISO date", () => {
    it("passes through valid ISO", () => {
      expect(parseShortDate("2026-03-25", NOW)).toBe("2026-03-25");
    });
    it("passes through any year", () => {
      expect(parseShortDate("2027-12-31", NOW)).toBe("2027-12-31");
    });
    it("past ISO is NOT bumped", () => {
      expect(parseShortDate("2026-01-01", NOW)).toBe("2026-01-01");
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("empty string", () => {
      expect(parseShortDate("", NOW)).toBeNull();
    });
    it("whitespace only", () => {
      expect(parseShortDate("   ", NOW)).toBeNull();
    });
    it("leading/trailing spaces trimmed", () => {
      expect(parseShortDate("  25  ", NOW)).toBe(`${Y}-03-25`);
    });
    it("letters are invalid", () => {
      expect(parseShortDate("abc", NOW)).toBeNull();
    });
    it("letters work as separators: 3a5 → March 5", () => {
      expect(parseShortDate("3a5", NOW)).toBe(`${NY}-03-05`);
    });
    it("only separator", () => {
      expect(parseShortDate("~", NOW)).toBeNull();
    });
    it("only backtick", () => {
      expect(parseShortDate("`", NOW)).toBeNull();
    });
    it("multiple separators: 3//25 → March 25", () => {
      expect(parseShortDate("3//25", NOW)).toBe(`${Y}-03-25`);
    });
    it("5+ digits rejected", () => {
      expect(parseShortDate("12345", NOW)).toBeNull();
    });
  });

  // ── Month boundary validation ──────────────────────────────────────
  describe("month boundary validation", () => {
    it("Feb 28 past bumps to next year", () => {
      expect(parseShortDate("2/28", NOW)).toBe(`${NY}-02-28`);
    });
    it("Feb 29 invalid in 2026 (non-leap)", () => {
      expect(parseShortDate("2/29", NOW)).toBeNull();
    });
    it("Feb 29 valid in 2028 (leap year)", () => {
      const leap = new Date(2028, 2, 1); // March 1, 2028
      // Feb 29 is past relative to March 1 → bumps to 2029, but 2029 is non-leap
      // So it falls back to 2028-02-29
      expect(parseShortDate("2/29", leap)).toBe("2028-02-29");
    });
    it("Feb 29 valid when ref is in Feb of leap year", () => {
      const feb2028 = new Date(2028, 1, 1); // Feb 1, 2028
      expect(parseShortDate("2/29", feb2028)).toBe("2028-02-29");
    });
    it("Apr 30 future stays", () => {
      expect(parseShortDate("4/30", NOW)).toBe(`${Y}-04-30`);
    });
    it("Apr 31 invalid", () => {
      expect(parseShortDate("4/31", NOW)).toBeNull();
    });
    it("Jun 30 future stays", () => {
      expect(parseShortDate("6/30", NOW)).toBe(`${Y}-06-30`);
    });
    it("Jun 31 invalid", () => {
      expect(parseShortDate("6/31", NOW)).toBeNull();
    });
  });

  // ── Different reference months ─────────────────────────────────────
  describe("respects reference month for day-only input", () => {
    it("future day in January stays", () => {
      const jan = new Date(2026, 0, 1);
      expect(parseShortDate("15", jan)).toBe("2026-01-15");
    });
    it("future day in December stays", () => {
      const dec = new Date(2026, 11, 1);
      expect(parseShortDate("28", dec)).toBe("2026-12-28");
    });
    it("day 31 in February is invalid", () => {
      const feb = new Date(2026, 1, 1);
      expect(parseShortDate("31", feb)).toBeNull();
    });
    it("day 29 in Feb non-leap is invalid", () => {
      const feb = new Date(2026, 1, 1);
      expect(parseShortDate("29", feb)).toBeNull();
    });
  });

  // ── Past-date bumping scenarios ────────────────────────────────────
  describe("past-date auto-bump", () => {
    it("day-only: past day bumps to next month", () => {
      const mar28 = new Date(2026, 2, 28);
      expect(parseShortDate("5", mar28)).toBe("2026-04-05");
    });
    it("day-only: today is not bumped", () => {
      expect(parseShortDate("10", NOW)).toBe(`${Y}-03-10`);
    });
    it("month+day: past month bumps to next year", () => {
      expect(parseShortDate("2~15", NOW)).toBe(`${NY}-02-15`);
    });
    it("month+day: past day in same month bumps to next year", () => {
      expect(parseShortDate("3/5", NOW)).toBe(`${NY}-03-05`);
    });
    it("month+day: today's month, future day, no bump", () => {
      expect(parseShortDate("3/15", NOW)).toBe(`${Y}-03-15`);
    });
    it("month+day: future month, no bump", () => {
      expect(parseShortDate("6~15", NOW)).toBe(`${Y}-06-15`);
    });
    it("ISO date: past date NOT bumped", () => {
      expect(parseShortDate("2025-01-01", NOW)).toBe("2025-01-01");
    });
    it("day-only: Dec 31 past day wraps to Jan next year", () => {
      const dec31 = new Date(2026, 11, 31);
      expect(parseShortDate("15", dec31)).toBe("2027-01-15");
    });
    it("compact 3-digit: no leading zero, 205 → Feb 05 (middle digit not 0)", () => {
      expect(parseShortDate("205", NOW)).toBe(`${NY}-02-05`);
    });
    it("compact 4-digit: past bumps", () => {
      expect(parseShortDate("0205", NOW)).toBe(`${NY}-02-05`);
    });
  });

  // ── Real-world one-handed scenarios ────────────────────────────────
  describe("one-handed typing scenarios", () => {
    it("typing just a future day: 15", () => {
      expect(parseShortDate("15", NOW)).toBe(`${Y}-03-15`);
    });
    it("month~day with tilde: 4~15", () => {
      expect(parseShortDate("4~15", NOW)).toBe(`${Y}-04-15`);
    });
    it("month`day with backtick: 4`15", () => {
      expect(parseShortDate("4`15", NOW)).toBe(`${Y}-04-15`);
    });
    it("compact no separator: 415", () => {
      expect(parseShortDate("415", NOW)).toBe(`${Y}-04-15`);
    });
    it("single digit day with tilde: 4~5", () => {
      expect(parseShortDate("4~5", NOW)).toBe(`${Y}-04-05`);
    });
    it("trailing tilde habit: 4~5~", () => {
      expect(parseShortDate("4~5~", NOW)).toBe(`${Y}-04-05`);
    });
    it("trailing backtick habit: 4`5`", () => {
      expect(parseShortDate("4`5`", NOW)).toBe(`${Y}-04-05`);
    });
    it("double digit month backtick: 12`5`", () => {
      expect(parseShortDate("12`5`", NOW)).toBe(`${Y}-12-05`);
    });
    it("space separator: 4 15", () => {
      expect(parseShortDate("4 15", NOW)).toBe(`${Y}-04-15`);
    });
    it("exclamation separator: 4!15", () => {
      expect(parseShortDate("4!15", NOW)).toBe(`${Y}-04-15`);
    });
    it("at sign separator: 4@15", () => {
      expect(parseShortDate("4@15", NOW)).toBe(`${Y}-04-15`);
    });
    it("hash separator: 4#15", () => {
      expect(parseShortDate("4#15", NOW)).toBe(`${Y}-04-15`);
    });
  });
});
