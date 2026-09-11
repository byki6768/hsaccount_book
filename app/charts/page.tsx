"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { getSession } from "@/lib/auth";
import type { Category, CategoryStat } from "@/lib/categories";
import { buildMajorStats, buildMinorStats } from "@/lib/categoryService";
import { supabase } from "@/lib/supabase/client";

type TxRow = {
  date: string;
  amount: number;
  category_id: number | null;
};

type KindTab = "expense" | "income";

type Theme = {
  pageBg: string;
  tabActive: string;
  accentText: string;
  bar: string;
  cardBorder: string;
  cardBg: string;
  pie: string[];
  selectFocus: string;
};

const EXPENSE_THEME: Theme = {
  pageBg:
    "bg-[radial-gradient(ellipse_at_top,_#fde8e8_0%,_#faf6f2_45%,_#f3eee8_100%)]",
  tabActive: "bg-[#e8a0a0] text-white",
  accentText: "text-[#c47878]",
  bar: "#e8a0a0",
  cardBorder: "border-[#f0d0d0]",
  cardBg: "bg-[#fff8f7]",
  pie: [
    "#e8a0a0",
    "#f0c0a8",
    "#f5d0c0",
    "#d4a5a5",
    "#e8b4b8",
    "#c9a89a",
    "#f2c4c4",
    "#deb887",
    "#e6b8a2",
    "#d9a5b3",
  ],
  selectFocus: "focus:border-[#e8a0a0] focus:ring-[#f5d5d5]",
};

const INCOME_THEME: Theme = {
  pageBg:
    "bg-[radial-gradient(ellipse_at_top,_#e4f0fa_0%,_#f4f8fc_45%,_#eef2f7_100%)]",
  tabActive: "bg-[#8eb6d9] text-white",
  accentText: "text-[#6a9bc2]",
  bar: "#8eb6d9",
  cardBorder: "border-[#c5d9eb]",
  cardBg: "bg-[#f7fbff]",
  pie: [
    "#8eb6d9",
    "#a8c5e2",
    "#b8d4e8",
    "#9bb8d4",
    "#7eafc9",
    "#c3d9eb",
    "#a3c4d9",
    "#6fa3c4",
    "#d0e4f2",
    "#8aaec8",
  ],
  selectFocus: "focus:border-[#8eb6d9] focus:ring-[#d6e8f5]",
};

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${y}.${Number(m)}`;
}

function buildMonthlyTotals(rows: TxRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.date || row.date.length < 7) continue;
    const key = monthKey(row.date);
    map.set(key, (map.get(key) ?? 0) + row.amount);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => ({
      month: key,
      label: monthLabel(key),
      amount,
    }));
}

export default function ChartsPage() {
  return (
    <AuthGuard>
      <ChartsContent />
    </AuthGuard>
  );
}

function ChartsContent() {
  const [tab, setTab] = useState<KindTab>("expense");
  const [expenseRows, setExpenseRows] = useState<TxRow[]>([]);
  const [incomeRows, setIncomeRows] = useState<TxRow[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenseMonth, setExpenseMonth] = useState("all");
  const [incomeMonth, setIncomeMonth] = useState("all");

  const theme = tab === "expense" ? EXPENSE_THEME : INCOME_THEME;

  const load = useCallback(async () => {
    const session = getSession();
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const [
        { data: expenses, error: expenseError },
        { data: incomes, error: incomeError },
        { data: cats, error: catError },
      ] = await Promise.all([
        supabase
          .from("expenses")
          .select("date, amount, category_id")
          .eq("member_unique_id", session.uniqueId)
          .order("date", { ascending: true }),
        supabase
          .from("incomes")
          .select("date, amount, category_id")
          .eq("member_unique_id", session.uniqueId)
          .order("date", { ascending: true }),
        supabase
          .from("categories")
          .select("*")
          .eq("member_unique_id", session.uniqueId)
          .order("sort_order", { ascending: true }),
      ]);

      if (expenseError) throw new Error(expenseError.message);
      if (incomeError) throw new Error(incomeError.message);
      if (catError) throw new Error(catError.message);

      const allCats = (cats ?? []) as Category[];
      setExpenseRows((expenses ?? []) as TxRow[]);
      setIncomeRows((incomes ?? []) as TxRow[]);
      setExpenseCategories(allCats.filter((c) => c.kind === "expense"));
      setIncomeCategories(allCats.filter((c) => c.kind === "income"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "차트를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={`min-h-full transition-colors ${theme.pageBg}`}>
      <AppHeader loggedIn />
      <div className="page-main flex w-full flex-col py-5 sm:py-6">
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">통계 보기</h1>
        <p className="mt-1 text-sm text-slate-500">
          지출·수입을 월별·카테고리별로 따로 확인합니다
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-white/80 p-1 shadow-sm ring-1 ring-slate-200/70">
          <button
            type="button"
            onClick={() => setTab("expense")}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              tab === "expense" ? theme.tabActive : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            지출 통계
          </button>
          <button
            type="button"
            onClick={() => setTab("income")}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              tab === "income"
                ? INCOME_THEME.tabActive
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            수입 통계
          </button>
        </div>

        {loading ? (
          <p className="mt-10 text-center text-slate-400">차트 준비 중...</p>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
            <button
              type="button"
              onClick={load}
              className="mt-2 block font-semibold underline"
            >
              다시 시도
            </button>
          </div>
        ) : tab === "expense" ? (
          <KindCharts
            kind="expense"
            theme={EXPENSE_THEME}
            rows={expenseRows}
            categories={expenseCategories}
            selectedMonth={expenseMonth}
            onSelectedMonth={setExpenseMonth}
            emptyText="아직 저장된 지출이 없습니다"
            barTitle="월별 총 지출"
          />
        ) : (
          <KindCharts
            kind="income"
            theme={INCOME_THEME}
            rows={incomeRows}
            categories={incomeCategories}
            selectedMonth={incomeMonth}
            onSelectedMonth={setIncomeMonth}
            emptyText="아직 저장된 수입이 없습니다"
            barTitle="월별 총 수입"
          />
        )}
      </div>
    </div>
  );
}

function KindCharts({
  kind,
  theme,
  rows,
  categories,
  selectedMonth,
  onSelectedMonth,
  emptyText,
  barTitle,
}: {
  kind: KindTab;
  theme: Theme;
  rows: TxRow[];
  categories: Category[];
  selectedMonth: string;
  onSelectedMonth: (value: string) => void;
  emptyText: string;
  barTitle: string;
}) {
  const monthlyData = useMemo(() => buildMonthlyTotals(rows), [rows]);

  const filteredRows = useMemo(() => {
    if (selectedMonth === "all") return rows;
    return rows.filter((row) => monthKey(row.date) === selectedMonth);
  }, [rows, selectedMonth]);

  const majorStats = useMemo(
    () => buildMajorStats(filteredRows, categories).filter((s) => s.amount > 0),
    [filteredRows, categories],
  );
  const minorStats = useMemo(
    () => buildMinorStats(filteredRows, categories).filter((s) => s.amount > 0),
    [filteredRows, categories],
  );

  const periodTotal = filteredRows.reduce((sum, row) => sum + row.amount, 0);
  const allTotal = rows.reduce((sum, row) => sum + row.amount, 0);

  if (rows.length === 0) {
    return (
      <p className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-12 text-center text-sm text-slate-400">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <section
        className={`rounded-2xl border ${theme.cardBorder} ${theme.cardBg} p-4 shadow-sm sm:p-5`}
      >
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-800">{barTitle}</h2>
          <p className="text-sm text-slate-500">
            전체{" "}
            <span className={`font-semibold ${theme.accentText}`}>
              {formatWon(allTotal)}
            </span>
          </p>
        </div>
        <div className="h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7a746c" }} />
              <YAxis
                width={52}
                tick={{ fontSize: 11, fill: "#7a746c" }}
                tickFormatter={(v) =>
                  v >= 10000 ? `${Math.round(Number(v) / 10000)}만` : String(v)
                }
              />
              <Tooltip
                formatter={(value) => formatWon(Number(value ?? 0))}
                labelFormatter={(_, payload) =>
                  String(payload?.[0]?.payload?.month ?? "")
                }
              />
              <Bar dataKey="amount" fill={theme.bar} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-slate-600">원 그래프 기간</label>
        <select
          value={selectedMonth}
          onChange={(e) => onSelectedMonth(e.target.value)}
          className={`h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-4 ${theme.selectFocus}`}
        >
          <option value="all">전체 기간</option>
          {[...monthlyData].reverse().map((item) => (
            <option key={item.month} value={item.month}>
              {item.month}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">
          합계{" "}
          <span className={`font-semibold ${theme.accentText}`}>
            {formatWon(periodTotal)}
          </span>
        </span>
      </div>

      <PieSection
        title={`${kind === "expense" ? "지출" : "수입"} 카테고리 대분류`}
        stats={majorStats}
        theme={theme}
      />
      <PieSection
        title={`${kind === "expense" ? "지출" : "수입"} 카테고리 소분류`}
        stats={minorStats}
        theme={theme}
      />
    </div>
  );
}

function PieSection({
  title,
  stats,
  theme,
}: {
  title: string;
  stats: CategoryStat[];
  theme: Theme;
}) {
  const data = stats.map((item) => ({
    name: item.name,
    value: item.amount,
    count: item.count,
  }));

  return (
    <section
      className={`rounded-2xl border ${theme.cardBorder} ${theme.cardBg} p-4 shadow-sm sm:p-5`}
    >
      <h2 className="mb-3 text-base font-semibold text-slate-800">{title}</h2>
      {data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
          표시할 데이터가 없습니다
        </p>
      ) : (
        <div className="h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="48%"
                outerRadius="70%"
                innerRadius="28%"
                paddingAngle={1}
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`${entry.name}-${index}`}
                    fill={theme.pie[index % theme.pie.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name, item) => [
                  `${formatWon(Number(value ?? 0))} (${item?.payload?.count ?? 0}건)`,
                  String(name ?? ""),
                ]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-xs text-slate-600">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
