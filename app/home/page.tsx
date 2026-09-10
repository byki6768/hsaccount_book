"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  reply?: string;
  error?: string;
  saved?: {
    type: "expense" | "income";
    id: number;
    date: string;
    amount: number;
    description: string;
    categoryName?: string;
  } | null;
};

export default function HomePage() {
  return (
    <AuthGuard>
      <ChatHome />
    </AuthGuard>
  );
}

function ChatHome() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "안녕하세요! AI 가계부 챗봇이에요.\n기록: \"오늘 점심 12000원\"\n질문: \"이번 달 총 지출이 얼마야?\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
      setLoadingList(true);
      await fetchExpenses();
      if (!cancelled) setLoadingList(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchExpenses]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const session = getSession();
    if (!session) return;

    const text = input.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const history = nextMessages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          memberUniqueId: session.uniqueId,
          history: history.slice(0, -1),
        }),
      });

      const data = (await res.json()) as ChatResponse;
      if (!res.ok) {
        throw new Error(data.reply || data.error || "응답에 실패했습니다");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply || "처리했어요.",
        },
      ]);

      if (data.saved?.type === "expense") {
        await fetchExpenses();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "전송에 실패했습니다";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: "assistant",
          content: msg.startsWith("죄송") ? msg : `죄송해요. ${msg}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-[#eceff4]">
      <AppHeader loggedIn />

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
        <header className="mb-3 shrink-0 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl">
            AI 가계부 챗봇
          </h1>
          <p className="mt-1 text-sm text-slate-500">대화로 수입·지출을 기록하세요</p>
        </header>

        <section className="mb-3 shrink-0">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-600">저장된 지출 내역</h2>
            <span className="text-xs text-slate-400">{expenses.length}건</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {loadingList ? (
              <div className="w-full rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-400">
                불러오는 중...
              </div>
            ) : expenses.length === 0 ? (
              <div className="w-full rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-400">
                아직 저장된 지출이 없습니다
              </div>
            ) : (
              expenses.map((item) => (
                <article
                  key={item.id}
                  className="min-w-[9.5rem] max-w-[11rem] shrink-0 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm"
                >
                  <p className="truncate text-xs text-slate-400">{item.date}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">
                    {item.description}
                  </p>
                  <p className="mt-2 text-sm font-semibold tabular-nums text-emerald-700">
                    {item.amount.toLocaleString("ko-KR")}원
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-[#f5f6f8] shadow-sm">
          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "rounded-br-md bg-[#fee500] text-slate-900"
                      : "rounded-bl-md bg-white text-slate-800"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
                  입력 중…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <form
            onSubmit={handleSend}
            className="flex items-end gap-2 border-t border-slate-200/80 bg-white px-3 py-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요"
              disabled={sending}
              className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-base text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="flex h-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              전송
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
