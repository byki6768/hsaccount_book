"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { ReceiptUploadButton } from "@/components/ReceiptUploadButton";
import { VoiceMicButton } from "@/components/VoiceMicButton";
import { useSpeechToText } from "@/components/useSpeechToText";
import { formatMoney } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/useI18n";

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

class ChatReplyError extends Error {}

function ChatExamplePreview() {
  const { m } = useI18n();
  const today = new Date();
  const examples = m.home.examples(
    m.home.exampleDate(today, true),
    m.home.exampleDate(today, false),
  );
  return (
    <div className="space-y-4">
      <p className="px-1 text-center text-sm font-semibold tracking-tight text-slate-500">
        {m.home.examplesTitle}
      </p>
      {examples.map((ex, index) => (
        <div key={index} className="space-y-2.5">
          <div className="flex justify-start">
            <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-dashed border-slate-200 bg-white/80 px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-500 shadow-sm sm:text-[15px]">
              {ex.user}
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-800 shadow-sm sm:text-[15px]">
              {ex.assistant}
            </div>
          </div>
        </div>
      ))}
      <p className="px-1 text-center text-xs text-slate-400">
        {m.home.examplesFooter}
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
  const { m, locale } = useI18n();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Newest on the right: oldest to newest
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
        <h2 className="text-sm font-semibold text-slate-600">{m.home.savedExpenses}</h2>
        <span className="text-xs text-slate-400">{m.common.itemCount(expenses.length)}</span>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            aria-label={m.home.previousExpenses}
            onClick={() => scrollByCards(-1)}
            className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/85 text-lg text-slate-500 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-slate-700"
          >
            ‹
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            aria-label={m.home.nextExpenses}
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
              {m.common.loading}
            </div>
          ) : ordered.length === 0 ? (
            <div className="w-full rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-400">
              {m.home.noExpenses}
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
                  {formatMoney(item.amount, locale)}
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
  const { m } = useI18n();
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
    try {
      const res = await fetch("/api/ledger?include=expenses", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(m.home.loadExpensesFailed);
        return;
      }
      setExpenses(data.expenses ?? []);
      setError(null);
    } catch {
      setError(m.home.loadExpensesFailed);
    }
  }, [m]);

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
          .filter((msg) => msg.id !== "welcome")
          .map((msg) => ({ role: msg.role, content: msg.content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: history.slice(0, -1),
          }),
        });

        const data = (await res.json()) as ChatResponse;
        if (!res.ok) {
          throw new ChatReplyError(data.reply || m.common.sorry(m.home.sendFailed));
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.reply || m.home.processed,
          },
        ]);

        if (data.saved?.type === "expense") {
          await fetchExpenses();
        }
      } catch (err) {
        const msg =
          err instanceof ChatReplyError ? err.message : m.common.sorry(m.home.sendFailed);
        setError(msg);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-err-${Date.now()}`,
            role: "assistant",
            content: msg,
          },
        ]);
      } finally {
        setSending(false);
        sendingRef.current = false;
      }
    },
    [fetchExpenses, m],
  );

  const handleReceiptFile = useCallback(
    async (file: File) => {
      if (sendingRef.current || uploadingReceipt) return;

      if (!file.type.startsWith("image/")) {
        setError(m.home.imagesOnly);
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
          content: m.home.receiptUploaded(file.name || "image"),
        },
      ]);

      try {
        const form = new FormData();
        form.append("image", file);

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
          throw new ChatReplyError(data.reply || m.common.sorry(m.home.receiptFailed));
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-receipt-${Date.now()}`,
            role: "assistant",
            content: data.reply || m.home.receiptProcessed,
          },
        ]);

        if (data.saved?.type === "expense") {
          await fetchExpenses();
        }
      } catch (err) {
        const msg =
          err instanceof ChatReplyError ? err.message : m.common.sorry(m.home.receiptFailed);
        setError(msg);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-receipt-err-${Date.now()}`,
            role: "assistant",
            content: msg,
          },
        ]);
      } finally {
        setUploadingReceipt(false);
      }
    },
    [fetchExpenses, uploadingReceipt, m],
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
    disabled: sending || uploadingReceipt,
    onInterimTranscript: (text) => {
      setInput(text);
      setVoiceHint(m.home.hintListening);
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
            {m.common.headerTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {m.home.subtitle}
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
                ? m.home.placeholderListening
                : uploadingReceipt
                  ? m.home.placeholderReceipt
                  : m.home.placeholder
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
            {m.home.send}
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
                ? m.home.bannerReceipt
                : listening
                  ? m.home.bannerListening
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
                  {m.home.typing}
                </div>
              </div>
            )}
            {uploadingReceipt && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
                  {m.home.recognizingReceipt}
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
