import type { Item, ItemGroup } from "./types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a Date as YYYY-MM-DD using local timezone (not UTC). */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function pluralize(count: number, singular: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${singular}s`;
}

/** "Mar 10" style */
export function formatShortDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** "Mar 10, 2:30 PM" style */
export function formatDateTime(dt: string): string {
  return new Date(dt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Group items by (lowercase name, expiration_date) */
export function groupItems(items: Item[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const item of items) {
    const key = `${item.name.toLowerCase()}|${item.expiration_date ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.items.push(item);
    } else {
      map.set(key, {
        key,
        name: item.name,
        expiration_date: item.expiration_date,
        count: 1,
        items: [item],
      });
    }
  }
  return Array.from(map.values());
}
