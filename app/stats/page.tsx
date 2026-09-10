"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { CategoryChart } from "@/components/CategoryChart";
import { SpeechBubble } from "@/components/SpeechBubble";
import { getSession } from "@/lib/auth";
import {
  Category,
  CategoryKind,
  CategoryStat,
  MAX_CATEGORIES_PER_KIND,
  groupCategories,
} from "@/lib/categories";
import {
  buildMajorStats,
  buildMinorStats,
  createMajorCategory,
  createMinorCategory,
  ensureDefaultCategories,
} from "@/lib/categoryService";
import { supabase } from "@/lib/supabase/client";

type TxRow = {
  amount: number;
  category_id: number | null;
};

type CreateMode = {
  kind: CategoryKind;
  level: "major" | "minor";
};

export default function StatsPage() {
  return (
    <AuthGuard>
      <StatsContent />
    </AuthGuard>
  );
}

function StatsContent() {
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseMajorStats, setExpenseMajorStats] = useState<CategoryStat[]>([]);
  const [expenseMinorStats, setExpenseMinorStats] = useState<CategoryStat[]>([]);
  const [incomeMajorStats, setIncomeMajorStats] = useState<CategoryStat[]>([]);
  const [incomeMinorStats, setIncomeMinorStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedMajorId, setSelectedMajorId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const expenseGroups = useMemo(
    () => groupCategories(expenseCategories),
    [expenseCategories],
  );
  const incomeGroups = useMemo(
    () => groupCategories(incomeCategories),
    [incomeCategories],
  );

  const load = useCallback(async () => {
    const session = getSession();
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const { expense, income } = await ensureDefaultCategories(session.uniqueId);
      setExpenseCategories(expense);
      setIncomeCategories(income);

      const [{ data: expenses }, { data: incomes }] = await Promise.all([
        supabase
          .from("expenses")
          .select("amount, category_id")
          .eq("member_unique_id", session.uniqueId),
        supabase
          .from("incomes")
          .select("amount, category_id")
          .eq("member_unique_id", session.uniqueId),
      ]);

      const expenseRows = (expenses ?? []) as TxRow[];
      const incomeRows = (incomes ?? []) as TxRow[];

      setExpenseMajorStats(buildMajorStats(expenseRows, expense));
      setExpenseMinorStats(buildMinorStats(expenseRows, expense));
      setIncomeMajorStats(buildMajorStats(incomeRows, income));
      setIncomeMinorStats(buildMinorStats(incomeRows, income));
    } catch (err) {
      setError(err instanceof Error ? err.message : "통계를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = (kind: CategoryKind) => {
    setCreateMode({ kind, level: "major" });
    setNewName("");
    setSelectedMajorId("");
    setError(null);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createMode) return;

    const session = getSession();
    if (!session) return;

    setSaving(true);
    setError(null);

    try {
      if (createMode.level === "major") {
        await createMajorCategory(session.uniqueId, createMode.kind, newName);
      } else {
        if (selectedMajorId === "") {
          throw new Error("대분류를 선택하세요");
        }
        await createMinorCategory(
          session.uniqueId,
          createMode.kind,
          selectedMajorId,
          newName,
        );
      }
      setNewName("");
      setSelectedMajorId("");
      setCreateMode(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "항목 생성에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const majorsForCreate =
    createMode?.kind === "income" ? incomeGroups : expenseGroups;

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#e8f5f0_0%,_#f7f8fa_45%,_#eef1f5_100%)]">
      <AppHeader loggedIn />
      <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-lg flex-col px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        <h1 className="text-3xl font-semibold text-slate-800">통계</h1>
        <p className="mt-2 text-base text-slate-500">
          대분류·소분류로 관리하고, AI 자동 분류를 준비합니다
        </p>

        {loading ? (
          <p className="mt-10 text-center text-slate-400">불러오는 중...</p>
        ) : (
          <>
            <div className="mt-8 flex-1 space-y-6">
              {error && <SpeechBubble message={error} />}

              <CategoryChart title="지출 통계 (대분류)" stats={expenseMajorStats} />
              <CategoryChart title="지출 통계 (소분류)" stats={expenseMinorStats} />
              <CategoryChart
                title="수입 통계 (대분류)"
                stats={incomeMajorStats}
                accentClassName="bg-sky-500"
              />
              <CategoryChart
                title="수입 통계 (소분류)"
                stats={incomeMinorStats}
                accentClassName="bg-sky-500"
              />

              <CategoryTreeSection
                title="지출 카테고리"
                groups={expenseGroups}
                tone="expense"
              />
              <CategoryTreeSection
                title="수입 카테고리"
                groups={incomeGroups}
                tone="income"
              />

              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-500">
                AI가 내용을 분석하면 소분류(`category_id`)로 저장하고, 대분류는
                소분류의 상위 항목으로 집계됩니다. 대분류·소분류는 각각 최대{" "}
                {MAX_CATEGORIES_PER_KIND}개까지 등록할 수 있습니다.
              </p>
            </div>

            <div className="mt-10 flex flex-col items-end gap-3">
              {createMode && (
                <form
                  onSubmit={handleCreate}
                  className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="mb-3 text-sm font-medium text-slate-700">
                    {createMode.kind === "expense" ? "지출항목생성" : "수입항목생성"}
                  </p>

                  <div className="mb-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateMode({ ...createMode, level: "major" })}
                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                        createMode.level === "major"
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 text-slate-600"
                      }`}
                    >
                      대분류
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateMode({ ...createMode, level: "minor" })}
                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                        createMode.level === "minor"
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 text-slate-600"
                      }`}
                    >
                      소분류
                    </button>
                  </div>

                  {createMode.level === "minor" && (
                    <select
                      value={selectedMajorId}
                      onChange={(e) =>
                        setSelectedMajorId(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className="mb-3 h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      required
                    >
                      <option value="">대분류 선택</option>
                      {majorsForCreate.map((group) => (
                        <option key={group.major.id} value={group.major.id}>
                          {group.major.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={
                      createMode.level === "major"
                        ? "예: 식대, 교통비, 배움"
                        : "예: 식대(아점), 교통비(기타)"
                    }
                    className="mb-3 h-11 w-full rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateMode(null);
                        setNewName("");
                        setSelectedMajorId("");
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? "저장 중..." : "추가"}
                    </button>
                  </div>
                </form>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openCreate("expense")}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  지출항목생성
                </button>
                <button
                  type="button"
                  onClick={() => openCreate("income")}
                  className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  수입항목생성
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CategoryTreeSection({
  title,
  groups,
  tone,
}: {
  title: string;
  groups: ReturnType<typeof groupCategories>;
  tone: "expense" | "income";
}) {
  const majorCount = groups.length;
  const minorCount = groups.reduce((sum, group) => sum + group.minors.length, 0);
  const chipMajor =
    tone === "expense"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-sky-200 bg-sky-50 text-sky-900";
  const chipMinor =
    tone === "expense"
      ? "border-emerald-100 bg-white text-emerald-700"
      : "border-sky-100 bg-white text-sky-700";

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <span className="text-sm text-slate-400">
          대분류 {majorCount}/{MAX_CATEGORIES_PER_KIND} · 소분류 {minorCount}
        </span>
      </div>
      <ul className="space-y-4">
        {groups.map((group) => (
          <li key={group.major.id}>
            <div
              className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${chipMajor}`}
            >
              대분류 · {group.major.name}
            </div>
            {group.minors.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2 pl-1">
                {group.minors.map((minor) => (
                  <li
                    key={minor.id}
                    className={`rounded-full border px-3 py-1 text-sm font-medium ${chipMinor}`}
                  >
                    소분류 · {minor.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 pl-1 text-xs text-slate-400">소분류 없음</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
