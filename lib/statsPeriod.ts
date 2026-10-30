/** YYYY-MM-DD helpers based on Asia/Seoul (weeks run Monday to Sunday) */

import { formatYearMonth } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKeySeoul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Monday of the week (Mon-Sun) that contains the date */
export function startOfWeekMonday(dateKey: string): Date {
  const date = parseDateKey(dateKey);
  const day = date.getDay(); // 0=Sun ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function weekDateKeys(anchorKey: string): string[] {
  const monday = startOfWeekMonday(anchorKey);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateKey(d);
  });
}

export function shiftWeek(anchorKey: string, deltaWeeks: number): string {
  const monday = startOfWeekMonday(anchorKey);
  monday.setDate(monday.getDate() + deltaWeeks * 7);
  return toDateKey(monday);
}

export function monthParts(anchorKey: string): { year: number; month: number } {
  const [y, m] = anchorKey.split("-").map(Number);
  return { year: y, month: m };
}

export function shiftMonth(anchorKey: string, deltaMonths: number): string {
  const { year, month } = monthParts(anchorKey);
  const d = new Date(year, month - 1 + deltaMonths, 1);
  return toDateKey(d);
}

export function monthLabel(anchorKey: string, locale: Locale): string {
  const { year, month } = monthParts(anchorKey);
  return formatYearMonth(year, month, locale);
}

export function weekRangeLabel(anchorKey: string): string {
  const keys = weekDateKeys(anchorKey);
  const a = parseDateKey(keys[0]);
  const b = parseDateKey(keys[6]);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(a)} ~ ${fmt(b)}`;
}

/** Monthly calendar cells (Monday first); null = empty cell */
export function buildMonthCells(anchorKey: string): Array<string | null> {
  const { year, month } = monthParts(anchorKey);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = first.getDay(); // 0=Sun
  const leading = firstDow === 0 ? 6 : firstDow - 1;

  const cells: Array<string | null> = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toDateKey(new Date(year, month - 1, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export type TxRow = {
  date: string;
  amount: number;
  category_id: number | null;
};

export function sumByDate(rows: TxRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.date, (map.get(row.date) ?? 0) + row.amount);
  }
  return map;
}
