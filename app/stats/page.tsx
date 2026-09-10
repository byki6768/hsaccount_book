"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import {
  StatsBarChart,
  StatsLineChart,
  StatsTable,
  SummaryCards,
} from "@/components/StatsVisuals";
import { getSession } from "@/lib/auth";
import {
  Category,
  CategoryStat,
  groupCategories,
} from "@/lib/categories";
import {
  buildMajorStats,
  buildMinorStats,
} from "@/lib/categoryService";
import { supabase } from "@/lib/supabase/client";

type Tab = "all" | "income" | "expense";

type TxRow = {
  date: string;
  amount: number;
  category_id: number | null;
};

function buildDailyPoints(rows: TxRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.date, (map.get(row.date) ?? 0) + row.amount);
  }
  return Array.from(map.entries()).map(([date, amount]) => ({ date, amount }));
}

function buildBalancePoints(incomeRows: TxRow[], expenseRows: TxRow[]) {
  const map = new Map<string, number>();
  for (const row of incomeRows) {
    map.set(row.date, (map.get(row.date) ?? 0) + row.amount);
  }
  for (const row of expenseRows) {
    map.set(row.date, (map.get(row.date) ?? 0) - row.amount);
  }
  return Array.from(map.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default function StatsPage() {
  return (
    <AuthGuard>
      <StatsContent />
    </AuthGuard>
  );
}

function StatsContent() {
  const [tab, setTab] = useState<Tab>("all");
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseRows, setExpenseRows] = useState<TxRow[]>([]);
  const [incomeRows, setIncomeRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const session = getSession();
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const ensureRes = await fetch("/api/categories/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUniqueId: session.uniqueId }),
      });
      const ensureData = await ensureRes.json();
      if (!ensureRes.ok) {
        throw new Error(ensureData.error || "카테고리를 준비하지 못했습니다");
      }

      const [{ data: categories, error: catError }, { data: expenses }, { data: incomes }] =
        await Promise.all([
          supabase
            .from("categories")
            .select("*")
            .eq("member_unique_id", session.uniqueId)
            .order("sort_order", { ascending: true }),
          supabase
            .from("expenses")
            .select("date, amount, category_id")
            .eq("member_unique_id", session.uniqueId),
          supabase
            .from("incomes")
            .select("date, amount, category_id")
            .eq("member_unique_id", session.uniqueId),
        ]);

      if (catError) throw new Error(catError.message);

      const cats = (categories ?? []) as Category[];
      setExpenseCategories(cats.filter((c) => c.kind === "expense"));
      setIncomeCategories(cats.filter((c) => c.kind === "income"));
      setExpenseRows((expenses ?? []) as TxRow[]);
      setIncomeRows((incomes ?? []) as TxRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "통계를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const expenseMajorStats = useMemo(
    () => buildMajorStats(expenseRows, expenseCategories),
    [expenseRows, expenseCategories],
  );
  const expenseMinorStats = useMemo(
    () => buildMinorStats(expenseRows, expenseCategories),
    [expenseRows, expenseCategories],
  );
  const incomeMajorStats = useMemo(
    () => buildMajorStats(incomeRows, incomeCategories),
    [incomeRows, incomeCategories],
  );
  const incomeMinorStats = useMemo(
    () => buildMinorStats(incomeRows, incomeCategories),
    [incomeRows, incomeCategories],
  );

  const incomeTotal = incomeRows.reduce((sum, row) => sum + row.amount, 0);
  const expenseTotal = expenseRows.reduce((sum, row) => sum + row.amount, 0);

  const overallMajorStats = useMemo(() => {
    const merged = new Map<string, CategoryStat>();
    for (const item of incomeMajorStats) {
      const key = `수입·${item.name}`;
      merged.set(key, {
        ...item,
        name: key,
        amount: item.amount,
        count: item.count,
      });
    }
    for (const item of expenseMajorStats) {
      const key = `지출·${item.name}`;
      const prev = merged.get(key);
      if (prev) {
        prev.amount += item.amount;
        prev.count += item.count;
      } else {
        merged.set(key, {
          ...item,
          name: key,
        });
      }
    }
    return Array.from(merged.values()).sort((a, b) => b.amount - a.amount);
  }, [incomeMajorStats, expenseMajorStats]);

  const expenseGroups = useMemo(
    () => groupCategories(expenseCategories),
    [expenseCategories],
  );
  const incomeGroups = useMemo(
    () => groupCategories(incomeCategories),
    [incomeCategories],
  );

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "all", label: "전체 통계" },
    { id: "income", label: "수입 통계" },
    { id: "expense", label: "지출 통계" },
  ];

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#e8f5f0_0%,_#f7f8fa_45%,_#eef1f5_100%)]">
      <AppHeader loggedIn />
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">통계</h1>
        <p className="mt-1 text-sm text-slate-500">
          AI가 만든 대분류·소분류 기준으로 집계합니다
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200/80">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-xl px-2 py-2.5 text-sm font-semibold transition ${
                tab === item.id
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="mt-10 text-center text-slate-400">AI 카테고리·통계 준비 중...</p>
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
        ) : (
          <div className="mt-6 space-y-4">
            {tab === "all" && (
              <>
                <SummaryCards incomeTotal={incomeTotal} expenseTotal={expenseTotal} />
                <StatsTable title="수치 통계표 (대분류)" stats={overallMajorStats} />
                <StatsBarChart title="막대그래프 (대분류 비교)" stats={overallMajorStats} />
                <StatsLineChart
                  title="선그래프 (일자별 순잔액)"
                  points={buildBalancePoints(incomeRows, expenseRows)}
                  color="#334155"
                />
                <CategoryTreePreview title="수입 카테고리 (AI)" groups={incomeGroups} tone="income" />
                <CategoryTreePreview title="지출 카테고리 (AI)" groups={expenseGroups} tone="expense" />
              </>
            )}

            {tab === "income" && (
              <>
                <SummaryCards incomeTotal={incomeTotal} expenseTotal={0} />
                <StatsTable title="수치 통계표 (대분류)" stats={incomeMajorStats} />
                <StatsTable title="수치 통계표 (소분류)" stats={incomeMinorStats} />
                <StatsBarChart
                  title="막대그래프 (대분류)"
                  stats={incomeMajorStats}
                  color="#0ea5e9"
                />
                <StatsLineChart
                  title="선그래프 (일자별 수입)"
                  points={buildDailyPoints(incomeRows)}
                  color="#0ea5e9"
                />
                <CategoryTreePreview title="수입 카테고리 (AI)" groups={incomeGroups} tone="income" />
              </>
            )}

            {tab === "expense" && (
              <>
                <SummaryCards incomeTotal={0} expenseTotal={expenseTotal} />
                <StatsTable title="수치 통계표 (대분류)" stats={expenseMajorStats} />
                <StatsTable title="수치 통계표 (소분류)" stats={expenseMinorStats} />
                <StatsBarChart
                  title="막대그래프 (대분류)"
                  stats={expenseMajorStats}
                  color="#059669"
                />
                <StatsLineChart
                  title="선그래프 (일자별 지출)"
                  points={buildDailyPoints(expenseRows)}
                  color="#059669"
                />
                <CategoryTreePreview title="지출 카테고리 (AI)" groups={expenseGroups} tone="expense" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryTreePreview({
  title,
  groups,
  tone,
}: {
  title: string;
  groups: ReturnType<typeof groupCategories>;
  tone: "expense" | "income";
}) {
  const chipMajor =
    tone === "expense"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-sky-200 bg-sky-50 text-sky-900";
  const chipMinor =
    tone === "expense"
      ? "border-emerald-100 bg-white text-emerald-700"
      : "border-sky-100 bg-white text-sky-700";

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 text-base font-semibold text-slate-800">{title}</h3>
      <ul className="space-y-3">
        {groups.map((group) => (
          <li key={group.major.id}>
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${chipMajor}`}
            >
              {group.major.name}
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5 pl-1">
              {group.minors.map((minor) => (
                <li
                  key={minor.id}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${chipMinor}`}
                >
                  {minor.name}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
