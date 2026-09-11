"use client";

import { useState, type ReactNode } from "react";
import type { Category } from "@/lib/categories";
import { groupCategories, isMajor, isMinor } from "@/lib/categories";
import {
  WEEKDAY_LABELS,
  buildMonthCells,
  formatWon,
  monthLabel,
  shiftMonth,
  shiftWeek,
  sumByDate,
  weekDateKeys,
  weekRangeLabel,
  type TxRow,
} from "@/lib/statsPeriod";

const PASTEL = {
  balance: "bg-[#8fb8a8]",
  expense: "bg-[#e8a0a0]",
  income: "bg-[#8eb6d9]",
  incomeAlt: "bg-[#a8c5a0]",
  expenseAlt: "bg-[#d4a574]",
} as const;

/** 항목 열용 엷은 파스텔 (테마별) */
const LABEL_PASTEL = {
  expense: "bg-[#f8e4e4] text-rose-900",
  income: "bg-[#e2eef8] text-sky-900",
  headerExpense: "bg-[#f3d6d6] text-rose-800",
  headerIncome: "bg-[#d4e4f4] text-sky-800",
  headerAll: "bg-[#e8eee9] text-slate-700",
} as const;

function resolveMajorId(
  categories: Category[],
  categoryId: number | null,
): number | null {
  if (categoryId == null) return null;
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return null;
  if (isMinor(cat)) return cat.parent_id;
  if (isMajor(cat)) return cat.id;
  return null;
}

function majorAmountsByDate(rows: TxRow[], categories: Category[]) {
  const groups = groupCategories(categories);
  const majors = groups.map((g) => ({ id: g.major.id, name: g.major.name }));
  const byDateMajor = new Map<string, Map<number, number>>();
  const uncategorizedByDate = new Map<string, number>();

  for (const row of rows) {
    const majorId = resolveMajorId(categories, row.category_id);
    if (majorId == null) {
      uncategorizedByDate.set(
        row.date,
        (uncategorizedByDate.get(row.date) ?? 0) + row.amount,
      );
      continue;
    }
    if (!byDateMajor.has(row.date)) byDateMajor.set(row.date, new Map());
    const dayMap = byDateMajor.get(row.date)!;
    dayMap.set(majorId, (dayMap.get(majorId) ?? 0) + row.amount);
  }

  return { majors, byDateMajor, uncategorizedByDate };
}

function PeriodToggle({
  mode,
  onMode,
  weeklyLabel,
  monthlyLabel,
}: {
  mode: "week" | "month";
  onMode: (mode: "week" | "month") => void;
  weeklyLabel: string;
  monthlyLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onMode(mode === "week" ? "month" : "week")}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        {mode === "week" ? monthlyLabel : weeklyLabel}
      </button>
    </div>
  );
}

function NavBar({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onPrev}
        className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
      >
        ‹
      </button>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <button
        type="button"
        onClick={onNext}
        className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
      >
        ›
      </button>
    </div>
  );
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex w-full items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-white sm:text-[10px] ${className}`}
    >
      {children}
    </span>
  );
}

function cellAmount(amount: number) {
  if (amount === 0) return <span className="text-slate-300">-</span>;
  return formatWon(amount);
}

function WeeklyGrid({
  rowLabels,
  values,
  showWeekSubtotal = false,
  labelThemes,
  labelHeaderTheme = "all",
}: {
  rowLabels: string[];
  values: number[][];
  showWeekSubtotal?: boolean;
  /** 행별 항목 열 테마 (expense | income). 없으면 헤더 테마를 따름 */
  labelThemes?: Array<"expense" | "income">;
  labelHeaderTheme?: "expense" | "income" | "all";
}) {
  const headerClass =
    labelHeaderTheme === "expense"
      ? LABEL_PASTEL.headerExpense
      : labelHeaderTheme === "income"
        ? LABEL_PASTEL.headerIncome
        : LABEL_PASTEL.headerAll;

  const fallbackTheme: "expense" | "income" =
    labelHeaderTheme === "income" ? "income" : "expense";

  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <table
        className={`w-full border-collapse text-center text-xs sm:text-sm ${
          showWeekSubtotal ? "min-w-[600px]" : "min-w-[520px]"
        }`}
      >
        <thead>
          <tr className="bg-slate-50 text-slate-600">
            <th
              className={`sticky left-0 z-10 px-2 py-2.5 text-left font-semibold ${headerClass}`}
            >
              항목
            </th>
            {WEEKDAY_LABELS.map((label) => (
              <th key={label} className="px-1.5 py-2.5 font-semibold">
                {label}
              </th>
            ))}
            {showWeekSubtotal && (
              <th className="bg-[#e8f2ec] px-1.5 py-2.5 font-semibold text-emerald-800">
                주간 잔액
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((label, rowIndex) => {
            const dayValues = values[rowIndex] ?? [];
            const weekSubtotal = dayValues.reduce((a, b) => a + b, 0);
            const theme = labelThemes?.[rowIndex] ?? fallbackTheme;
            const labelClass = LABEL_PASTEL[theme];
            return (
              <tr
                key={`${label}-${rowIndex}`}
                className="border-t border-slate-100"
              >
                <th
                  className={`sticky left-0 z-10 max-w-[9rem] px-2 py-2.5 text-left text-[11px] font-semibold leading-snug sm:max-w-[11rem] sm:text-xs ${labelClass}`}
                >
                  {label}
                </th>
                {dayValues.map((amount, dayIndex) => (
                  <td
                    key={`${rowIndex}-${dayIndex}`}
                    className="px-1 py-2 tabular-nums text-slate-700"
                  >
                    {cellAmount(amount)}
                  </td>
                ))}
                {showWeekSubtotal && (
                  <td className="bg-[#f3faf6] px-1 py-2 font-semibold tabular-nums text-emerald-800">
                    {cellAmount(weekSubtotal)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WeekBalanceBar({ balance }: { balance: number }) {
  return (
    <div className="mt-3 flex justify-end">
      <div className="flex w-1/2 min-w-[11rem] max-w-full overflow-hidden rounded-xl border border-[#c5ddd2] bg-[#dceee6] text-sm shadow-sm sm:text-base">
        <div className="flex w-[42%] items-center justify-center border-r border-[#c5ddd2] bg-[#cfe6db] px-2 py-2.5 font-semibold text-emerald-900">
          Balance
        </div>
        <div className="flex flex-1 items-center justify-end px-3 py-2.5 font-semibold tabular-nums text-slate-800">
          {formatWon(balance)}
        </div>
      </div>
    </div>
  );
}

function MonthCalendarShell({
  anchorKey,
  renderDay,
}: {
  anchorKey: string;
  renderDay: (dateKey: string) => ReactNode;
}) {
  const cells = buildMonthCells(anchorKey);
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-0.5 py-2 text-center text-[10px] font-semibold text-slate-500 sm:text-xs"
          >
            {label.replace("요일", "")}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((dateKey, index) => (
          <div
            key={`${dateKey ?? "empty"}-${index}`}
            className="min-h-[88px] border-b border-r border-slate-100 p-1 sm:min-h-[104px]"
          >
            {dateKey ? (
              <>
                <p className="mb-1 text-[10px] font-semibold text-slate-500 sm:text-xs">
                  {Number(dateKey.slice(8))}
                </p>
                <div className="flex flex-col gap-0.5">{renderDay(dateKey)}</div>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverallPeriodPanel({
  incomeRows,
  expenseRows,
  anchorKey,
  onAnchorKey,
}: {
  incomeRows: TxRow[];
  expenseRows: TxRow[];
  anchorKey: string;
  onAnchorKey: (key: string) => void;
}) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const incomeByDate = sumByDate(incomeRows);
  const expenseByDate = sumByDate(expenseRows);
  const weekKeys = weekDateKeys(anchorKey);

  const weekIncome = weekKeys.map((k) => incomeByDate.get(k) ?? 0);
  const weekExpense = weekKeys.map((k) => expenseByDate.get(k) ?? 0);
  const weekIncomeSum = weekIncome.reduce((a, b) => a + b, 0);
  const weekExpenseSum = weekExpense.reduce((a, b) => a + b, 0);
  const weekNetBalance = weekIncomeSum - weekExpenseSum;

  return (
    <section>
      <PeriodToggle
        mode={mode}
        onMode={setMode}
        weeklyLabel="주간 지출·수입 보기"
        monthlyLabel="월간 지출·수입 보기"
      />
      <NavBar
        label={mode === "week" ? weekRangeLabel(anchorKey) : monthLabel(anchorKey)}
        onPrev={() =>
          onAnchorKey(
            mode === "week" ? shiftWeek(anchorKey, -1) : shiftMonth(anchorKey, -1),
          )
        }
        onNext={() =>
          onAnchorKey(
            mode === "week" ? shiftWeek(anchorKey, 1) : shiftMonth(anchorKey, 1),
          )
        }
      />
      <h2 className="mt-2 text-base font-semibold text-slate-800">
        {mode === "week" ? "주간 지출·수입 보기" : "월간 지출·수입 보기"}
      </h2>

      {mode === "week" ? (
        <>
          <WeeklyGrid
            rowLabels={["지출", "수입"]}
            values={[weekExpense, weekIncome]}
            labelThemes={["expense", "income"]}
            labelHeaderTheme="all"
          />
          <WeekBalanceBar balance={weekNetBalance} />
        </>
      ) : (
        <MonthCalendarShell
          anchorKey={anchorKey}
          renderDay={(dateKey) => {
            const income = incomeByDate.get(dateKey) ?? 0;
            const expense = expenseByDate.get(dateKey) ?? 0;
            const balance = income - expense;
            if (income === 0 && expense === 0) return null;
            return (
              <>
                <Pill className={PASTEL.balance}>잔액: {formatWon(balance)}</Pill>
                <Pill className={PASTEL.expense}>당일지출: {formatWon(expense)}</Pill>
                <Pill className={PASTEL.income}>당일수입: {formatWon(income)}</Pill>
              </>
            );
          }}
        />
      )}
    </section>
  );
}

export function CategoryPeriodPanel({
  kind,
  rows,
  categories,
  anchorKey,
  onAnchorKey,
}: {
  kind: "income" | "expense";
  rows: TxRow[];
  categories: Category[];
  anchorKey: string;
  onAnchorKey: (key: string) => void;
}) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const weekKeys = weekDateKeys(anchorKey);
  const { majors, byDateMajor, uncategorizedByDate } = majorAmountsByDate(
    rows,
    categories,
  );
  const totalByDate = sumByDate(rows);

  const majorRows = majors.map((major) => {
    const dayValues = weekKeys.map(
      (k) => byDateMajor.get(k)?.get(major.id) ?? 0,
    );
    return {
      label: major.name,
      values: dayValues,
    };
  });

  const uncategorizedValues = weekKeys.map(
    (k) => uncategorizedByDate.get(k) ?? 0,
  );
  const uncategorizedSum = uncategorizedValues.reduce((a, b) => a + b, 0);
  if (uncategorizedSum > 0) {
    majorRows.push({
      label: "미분류",
      values: uncategorizedValues,
    });
  }

  const titleWeek = kind === "income" ? "주간 수입 현황" : "주간 지출 현황";
  const titleMonth = kind === "income" ? "월간 수입 현황" : "월간 지출 현황";
  const btnWeek = kind === "income" ? "주간 수입 현황" : "주간 지출 현황";
  const btnMonth = kind === "income" ? "월간 수입 현황" : "월간 지출 현황";
  const pillClass = kind === "income" ? PASTEL.incomeAlt : PASTEL.expenseAlt;

  return (
    <section>
      <PeriodToggle
        mode={mode}
        onMode={setMode}
        weeklyLabel={btnWeek}
        monthlyLabel={btnMonth}
      />
      <NavBar
        label={mode === "week" ? weekRangeLabel(anchorKey) : monthLabel(anchorKey)}
        onPrev={() =>
          onAnchorKey(
            mode === "week" ? shiftWeek(anchorKey, -1) : shiftMonth(anchorKey, -1),
          )
        }
        onNext={() =>
          onAnchorKey(
            mode === "week" ? shiftWeek(anchorKey, 1) : shiftMonth(anchorKey, 1),
          )
        }
      />
      <h2 className="mt-2 text-base font-semibold text-slate-800">
        {mode === "week" ? titleWeek : titleMonth}
      </h2>

      {mode === "week" ? (
        <WeeklyGrid
          rowLabels={majorRows.map((r) => r.label)}
          values={majorRows.map((r) => r.values)}
          showWeekSubtotal
          labelThemes={majorRows.map(() => kind)}
          labelHeaderTheme={kind}
        />
      ) : (
        <MonthCalendarShell
          anchorKey={anchorKey}
          renderDay={(dateKey) => {
            const total = totalByDate.get(dateKey) ?? 0;
            if (total === 0) return null;
            return (
              <Pill className={pillClass}>
                {kind === "income" ? "당일수입합계" : "당일지출합계"}:{" "}
                {formatWon(total)}
              </Pill>
            );
          }}
        />
      )}
    </section>
  );
}
