"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";

type Expense = {
  id: number;
  date: string;
  amount: number;
  description: string;
  created_at: string;
};

export default function HomePage() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}

function HomeContent() {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    const session = getSession();
    if (!session) return;

    const { data, error: fetchError } = await supabase
      .from("expenses")
      .select("id, date, amount, description, created_at")
      .eq("member_unique_id", session.uniqueId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setExpenses(data ?? []);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      await fetchExpenses();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchExpenses]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const session = getSession();
    if (!session) return;

    const parsedAmount = Number(amount);
    if (!date || !description.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("expenses").insert({
      date,
      amount: parsedAmount,
      description: description.trim(),
      member_unique_id: session.uniqueId,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setDate("");
    setAmount("");
    setDescription("");
    await fetchExpenses();
    setSaving(false);
  };

  const total = expenses.reduce((sum, item) => sum + item.amount, 0);

  const fieldClassName =
    "h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 text-lg text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-xl sm:text-base";

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#e8f5f0_0%,_#f7f8fa_45%,_#eef1f5_100%)]">
      <AppHeader loggedIn />
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
            나의 AI 가계부
          </h1>
          <p className="mt-2 text-base text-slate-500 sm:text-sm">
            지출을 간단하게 기록해 보세요
          </p>
        </header>

        <main className="flex w-full flex-1 flex-col">
          <form
            onSubmit={handleSubmit}
            className="w-full rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.25)] backdrop-blur-sm sm:p-8"
          >
            <div className="space-y-7 sm:space-y-5">
              <div className="flex flex-col gap-2.5 sm:gap-1.5">
                <label htmlFor="date" className="text-base font-medium text-slate-700 sm:text-sm">
                  날짜
                </label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className={fieldClassName}
                />
              </div>

              <div className="flex flex-col gap-2.5 sm:gap-1.5">
                <label
                  htmlFor="description"
                  className="text-base font-medium text-slate-700 sm:text-sm"
                >
                  내용
                </label>
                <input
                  id="description"
                  type="text"
                  placeholder="예: 점심식사, 교통비"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className={fieldClassName}
                />
              </div>

              <div className="flex flex-col gap-2.5 sm:gap-1.5">
                <label htmlFor="amount" className="text-base font-medium text-slate-700 sm:text-sm">
                  금액
                </label>
                <div className="relative">
                  <input
                    id="amount"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className={`${fieldClassName} pr-12`}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-slate-400 sm:text-sm">
                    원
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-base text-red-600 sm:text-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-8 flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:mt-7 sm:h-12 sm:rounded-xl sm:text-[15px]"
            >
              {saving ? "저장 중..." : "저장하기"}
            </button>
          </form>

          <section className="mt-10 w-full sm:mt-8">
            <div className="mb-4 flex items-baseline justify-between gap-3 sm:mb-3">
              <h2 className="text-lg font-semibold text-slate-700 sm:text-base">지출 내역</h2>
              <p className="text-base text-slate-500 sm:text-sm">
                합계{" "}
                <span className="font-semibold text-emerald-700">
                  {total.toLocaleString("ko-KR")}원
                </span>
              </p>
            </div>

            {loading ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-10 text-center text-base text-slate-400 sm:text-sm">
                불러오는 중...
              </p>
            ) : expenses.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-10 text-center text-base text-slate-400 sm:text-sm">
                아직 저장된 지출이 없습니다
              </p>
            ) : (
              <ul className="space-y-3.5 sm:space-y-3">
                {expenses.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-lg font-semibold text-slate-800 sm:text-[15px]">
                          {item.description}
                        </p>
                        <p className="mt-1.5 text-sm text-slate-500 sm:mt-1 sm:text-xs">
                          {item.date}
                        </p>
                      </div>
                      <p className="shrink-0 text-lg font-semibold tabular-nums text-emerald-700 sm:text-[15px]">
                        {item.amount.toLocaleString("ko-KR")}원
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
