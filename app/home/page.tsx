"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { ReceiptUploadButton } from "@/components/ReceiptUploadButton";
import { VoiceMicButton } from "@/components/VoiceMicButton";
import { useSpeechToText } from "@/components/useSpeechToText";
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

function formatExampleDate(d = new Date()) {
  const yy = String(d.getFullYear()).slice(2);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${yy}년${d.getMonth() + 1}월${d.getDate()}일(${weekdays[d.getDay()]})`;
}

const CHAT_EXAMPLES = [
  {
    user: '무엇이든 말하거나 입력해 보세요!\n기록: "오늘 점심 칼국수 8000원"',
    assistant: (dateLabel: string) =>
      `${dateLabel} 점심식대로 칼국수 8000원을 쓰셨어요! 잘 저장해 두겠습니다.`,
  },
  {
    user: '무엇이든 말하거나 입력해 보세요!\n질문: "이번 달 총 지출이 얼마야?"',
    assistant: (dateLabel: string) =>
      `${dateLabel.replace(/\([일월화수목금토]\)/, "")} 오늘까지 이번 주는 교통비로 "**,***원", 식대로 "**,***원", 주간소계로 "***,***원" 지출하셨습니다.\n둘째 주는 ${dateLabel} 점심식대로 칼국수 8000원을 쓰셨어요! 잘 저장해 두겠습니다.`,
  },
  {
    user: '무엇이든 말하거나 입력해 보세요!\n검색: "스타벅스 찾아줘"',
    assistant: () =>
      '스타벅스 관련 기록을 찾아봤어요.\n예: 커피·카페 지출 몇 건이 검색됩니다. 마이크·영수증 사진으로도 입력할 수 있어요.',
  },
] as const;

function ChatExamplePreview() {
  const dateLabel = formatExampleDate();
  return (
    <div className="space-y-4">
      <p className="px-1 text-center text-sm font-semibold tracking-tight text-slate-500">
        &lt;사용 예시&gt;
      </p>
      {CHAT_EXAMPLES.map((ex, index) => (
        <div key={index} className="space-y-2.5">
          <div className="flex justify-start">
            <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-dashed border-slate-200 bg-white/80 px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-500 shadow-sm sm:text-[15px]">
              {ex.user}
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-800 shadow-sm sm:text-[15px]">
              {ex.assistant(dateLabel)}
            </div>
          </div>
        </div>
      ))}
      <p className="px-1 text-center text-xs text-slate-400">
        마이크·영수증 사진으로도 입력할 수 있어요.
      </p>
    </div>
  );
}

function SavedExpenseStrip({
  expenses,
  loading,
}: {
  expenses: Expense[];
  loading: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // 최신이 오른쪽: 오래된 → 최신 순
  const ordered = [...expenses].reverse();

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || ordered.length === 0) return;
    el.scrollLeft = el.scrollWidth;
    updateScrollState();
  }, [ordered.length, loading, updateScrollState]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [ordered.length, updateScrollState]);

  const scrollByCards = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.85;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <section className="mb-3 shrink-0">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-600">저장된 지출 내역</h2>
        <span className="text-xs text-slate-400">{expenses.length}건</span>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            aria-label="이전 지출 내역"
            onClick={() => scrollByCards(-1)}
            className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/85 text-lg text-slate-500 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-slate-700"
          >
            ‹
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            aria-label="다음 지출 내역"
            onClick={() => scrollByCards(1)}
            className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-lg text-slate-400 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-slate-600"
          >
            ›
          </button>
        )}

        <div
          ref={scrollerRef}
          className="flex gap-2 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {loading ? (
            <div className="w-full rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-400">
              불러오는 중...
            </div>
          ) : ordered.length === 0 ? (
            <div className="w-full rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-400">
              아직 저장된 지출이 없습니다
            </div>
          ) : (
            ordered.map((item) => (
              <article
                key={item.id}
                className="min-w-0 shrink-0 basis-[calc((100%-2rem)/5)] rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm sm:p-3"
              >
                <p className="truncate text-[10px] text-slate-400 sm:text-xs">
                  {item.date}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug text-slate-800 sm:text-sm">
                  {item.description}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold tabular-nums text-emerald-700 sm:mt-2 sm:text-sm">
                  {item.amount.toLocaleString("ko-KR")}원
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <ChatHome />
    </AuthGuard>
  );
}

function ChatHome() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const sendingRef = useRef(sending);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

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
  }, [messages, sending, voiceHint, uploadingReceipt]);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const session = getSession();
      if (!session) return;

      const text = rawText.trim();
      if (!text || sendingRef.current) return;

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
      };

      const nextMessages = [...messagesRef.current, userMessage];
      setMessages(nextMessages);
      setInput("");
      setVoiceHint(null);
      setSending(true);
      setError(null);
      sendingRef.current = true;

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
        sendingRef.current = false;
      }
    },
    [fetchExpenses],
  );

  const handleReceiptFile = useCallback(
    async (file: File) => {
      const session = getSession();
      if (!session || sendingRef.current || uploadingReceipt) return;

      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 업로드할 수 있어요.");
        return;
      }

      setError(null);
      setVoiceHint(null);
      setUploadingReceipt(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `u-receipt-${Date.now()}`,
          role: "user",
          content: `영수증 사진을 올렸어요 (${file.name || "image"})`,
        },
      ]);

      try {
        const form = new FormData();
        form.append("image", file);
        form.append("memberUniqueId", session.uniqueId);

        const res = await fetch("/api/receipt", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as ChatResponse & {
          extracted?: {
            store_name?: string | null;
            date?: string | null;
            amount?: number | null;
            items?: string[];
            description?: string | null;
          };
        };

        if (!res.ok) {
          throw new Error(data.reply || data.error || "영수증 분석에 실패했습니다");
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-receipt-${Date.now()}`,
            role: "assistant",
            content: data.reply || "영수증을 처리했어요.",
          },
        ]);

        if (data.saved?.type === "expense") {
          await fetchExpenses();
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "영수증 업로드에 실패했습니다";
        setError(msg);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-receipt-err-${Date.now()}`,
            role: "assistant",
            content: msg.startsWith("죄송") ? msg : `죄송해요. ${msg}`,
          },
        ]);
      } finally {
        setUploadingReceipt(false);
      }
    },
    [fetchExpenses, uploadingReceipt],
  );

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  const {
    supported: speechSupported,
    securable: speechSecurable,
    listening,
    toggle: toggleSpeech,
  } = useSpeechToText({
    lang: "ko-KR",
    disabled: sending || uploadingReceipt,
    onInterimTranscript: (text) => {
      setInput(text);
      setVoiceHint("듣는 중…");
    },
    onFinalTranscript: (text) => {
      setInput(text);
      setVoiceHint(null);
      void sendMessage(text);
    },
    onError: (message) => {
      setVoiceHint(null);
      setError(message);
    },
  });

  const micUnsupported = !speechSupported || !speechSecurable;

  return (
    <div className="flex min-h-full flex-col bg-[#eceff4]">
      <AppHeader loggedIn />

      <div className="page-main flex w-full flex-1 flex-col pt-3 sm:pt-4">
        <header className="mb-3 shrink-0 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl">
            AI 가계부 챗봇
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            텍스트 또는 음성으로 수입·지출을 기록하세요
          </p>
        </header>

        <SavedExpenseStrip expenses={expenses} loading={loadingList} />

        <form
          onSubmit={handleSend}
          className="mb-3 flex shrink-0 items-end gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm sm:px-4 sm:py-3.5"
        >
          <VoiceMicButton
            listening={listening}
            disabled={sending || uploadingReceipt}
            unsupported={micUnsupported}
            onClick={() => {
              setError(null);
              toggleSpeech();
            }}
          />
          <ReceiptUploadButton
            disabled={sending || listening}
            uploading={uploadingReceipt}
            onFile={(file) => {
              void handleReceiptFile(file);
            }}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending && !uploadingReceipt && !listening && input.trim()) {
                  void sendMessage(input);
                }
              }
            }}
            placeholder={
              listening
                ? "음성 인식 중…"
                : uploadingReceipt
                  ? "영수증 분석 중…"
                  : "여기에 무엇이든 말하거나 입력해 보세요!\n음성입력, 메시지입력, 사진(영수증) 등 뭐든지 가능해요!"
            }
            disabled={sending || uploadingReceipt}
            rows={4}
            className="min-h-[11rem] min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
            autoComplete="off"
            enterKeyHint="send"
            inputMode="text"
          />
          <button
            type="submit"
            disabled={
              sending ||
              uploadingReceipt ||
              !input.trim() ||
              listening
            }
            className="flex h-11 shrink-0 items-center justify-center self-end rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            전송
          </button>
        </form>

        {(error || voiceHint || listening || uploadingReceipt) && (
          <p
            className={`mb-3 rounded-xl px-3 py-2 text-xs ${
              error
                ? "bg-red-50 text-red-600"
                : uploadingReceipt
                  ? "bg-sky-50 text-sky-700"
                  : "bg-rose-50 text-rose-600"
            }`}
          >
            {error ??
              (uploadingReceipt
                ? "영수증에서 금액·날짜·품목을 읽는 중…"
                : listening
                  ? "듣고 있어요. 말씀해 주세요…"
                  : voiceHint)}
          </p>
        )}

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-[#f5f6f8] shadow-sm">
          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4"
          >
            {messages.length === 0 ? (
              <ChatExamplePreview />
            ) : (
              messages.map((msg) => (
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
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
                  입력 중…
                </div>
              </div>
            )}
            {uploadingReceipt && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
                  영수증 인식 중…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </main>
      </div>
    </div>
  );
}
