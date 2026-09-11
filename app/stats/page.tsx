"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import {
  CategoryPeriodPanel,
  OverallPeriodPanel,
} from "@/components/StatsPeriodViews";
import { getSession } from "@/lib/auth";
import type { Category } from "@/lib/categories";
import type { SearchHit } from "@/lib/ledgerSearch";
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchText, setSearchText] = useState("");

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

  const runSearch = async (e?: FormEvent) => {
    e?.preventDefault();
    const session = getSession();
    if (!session) return;
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          memberUniqueId: session.uniqueId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "검색에 실패했습니다");
      setSearchHits((data.hits ?? []) as SearchHit[]);
      setSearchText(String(data.text ?? ""));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "검색 실패");
      setSearchHits([]);
      setSearchText("");
    } finally {
      setSearching(false);
    }
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "all", label: "전체 보기" },
    { id: "expense", label: "지출 보기" },
    { id: "income", label: "수입 보기" },
  ];

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#e8f5f0_0%,_#f7f8fa_45%,_#eef1f5_100%)]">
      <AppHeader loggedIn />
      <div className="page-main flex w-full flex-col py-5 sm:py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">
              나의 지출·수입 보기
            </h1>
            <p className="mt-1 text-sm text-slate-500">주간 월간 지출·수입 보기</p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="mt-1 shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:text-sm"
          >
            {searchOpen ? "닫기" : "나의 가계부 검색"}
          </button>
        </div>

        {searchOpen && (
          <section className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <form onSubmit={runSearch} className="flex gap-2">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="품목·개별품목·장소·수입내역·수입처·내용 검색"
                className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="h-11 shrink-0 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {searching ? "검색 중" : "검색"}
              </button>
            </form>
            <p className="mt-2 text-xs text-slate-400">
              회원정보·고유 ID는 검색·표시되지 않습니다.
            </p>
            {searchError && (
              <p className="mt-3 text-sm text-red-600">{searchError}</p>
            )}
            {searchText && (
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                {searchText}
              </pre>
            )}
            {!searchError && searchHits.length === 0 && searchText && (
              <p className="mt-2 text-sm text-slate-400">결과 없음</p>
            )}
          </section>
        )}

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
            {tab === "expense" && (
              <CategoryPeriodPanel
                kind="expense"
                rows={expenseRows}
                categories={expenseCategories}
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
          </div>
        )}
      </div>
    </div>
  );
}
