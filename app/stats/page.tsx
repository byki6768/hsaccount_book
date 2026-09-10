"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import {
  CategoryPeriodPanel,
  OverallPeriodPanel,
} from "@/components/StatsPeriodViews";
import { getSession } from "@/lib/auth";
import type { Category } from "@/lib/categories";
import { todayKeySeoul, type TxRow } from "@/lib/statsPeriod";
import { supabase } from "@/lib/supabase/client";

type Tab = "all" | "income" | "expense";

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
  const [anchorKey, setAnchorKey] = useState(todayKeySeoul);

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

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "all", label: "전체 통계" },
    { id: "income", label: "수입 통계" },
    { id: "expense", label: "지출 통계" },
  ];

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#e8f5f0_0%,_#f7f8fa_45%,_#eef1f5_100%)]">
      <AppHeader loggedIn />
      <div className="mx-auto flex w-full max-w-2xl flex-col px-3 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">통계</h1>
        <p className="mt-1 text-sm text-slate-500">주간·월간 수입·지출 현황</p>

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
          <p className="mt-10 text-center text-slate-400">통계 준비 중...</p>
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
          <div className="mt-5">
            {tab === "all" && (
              <OverallPeriodPanel
                incomeRows={incomeRows}
                expenseRows={expenseRows}
                anchorKey={anchorKey}
                onAnchorKey={setAnchorKey}
              />
            )}
            {tab === "income" && (
              <CategoryPeriodPanel
                kind="income"
                rows={incomeRows}
                categories={incomeCategories}
                anchorKey={anchorKey}
                onAnchorKey={setAnchorKey}
              />
            )}
            {tab === "expense" && (
              <CategoryPeriodPanel
                kind="expense"
                rows={expenseRows}
                categories={expenseCategories}
                anchorKey={anchorKey}
                onAnchorKey={setAnchorKey}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
