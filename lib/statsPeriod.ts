/** Asia/Seoul 기준 YYYY-MM-DD 유틸 (주=월~일) */

export const WEEKDAY_LABELS = [
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
  "일요일",
] as const;

export function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

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

/** 해당 날짜가 속한 주(월~일)의 월요일 */
export function startOfWeekMonday(dateKey: string): Date {
  const date = parseDateKey(dateKey);
  const day = date.getDay(); // 0=일 … 6=토
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

export function monthLabel(anchorKey: string): string {
  const { year, month } = monthParts(anchorKey);
  return `${year}년 ${month}월`;
}

export function weekRangeLabel(anchorKey: string): string {
  const keys = weekDateKeys(anchorKey);
  const a = parseDateKey(keys[0]);
  const b = parseDateKey(keys[6]);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(a)} ~ ${fmt(b)}`;
}

/** 월간 캘린더 셀 (월요일 시작), null = 빈 칸 */
export function buildMonthCells(anchorKey: string): Array<string | null> {
  const { year, month } = monthParts(anchorKey);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = first.getDay(); // 0=일
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
