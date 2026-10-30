import { NextResponse } from "next/server";
import {
  analyzeExpenseMessage,
  answerStatsQuestion,
  formatSavedConfirm,
  parseLedgerMessage,
  type LedgerRowForAi,
} from "@/lib/aiCategories";
import {
  ensureAiCategoryTrees,
  findMinorCategoryId,
} from "@/lib/aiCategoryService";
import {
  classifyChatIntent,
  extractSearchQuery,
  looksLikeStatsQuestion,
  mentionsLedgerTopic,
} from "@/lib/chatIntent";
import type { Category } from "@/lib/categories";
import { isMajor, isMinor } from "@/lib/categories";
import { GeminiBusyError, generateGeminiText } from "@/lib/gemini";
import { RELATIVE_DAYS } from "@/lib/i18n/intentPatterns";
import { DEFAULT_LOCALE, LOCALE_ENGLISH_NAMES, type Locale } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";
import { recordExpenseLabels, recordIncomeLabels } from "@/lib/ledgerLabels";
import {
  formatSearchHitsForAi,
  formatSearchHitsForUi,
  searchMemberLedger,
  type SearchHit,
} from "@/lib/ledgerSearch";
import { getSessionMember } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ChatTurn = { role: "user" | "assistant"; content: string };

type ChatBody = {
  message?: string;
  history?: ChatTurn[];
};

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function yesterdayInSeoul(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function normalizeDate(raw: string | null, today: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const loose = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (loose) {
    const [, yy, mm, dd] = loose;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const lower = trimmed.toLowerCase();
  if (RELATIVE_DAYS.today.includes(lower)) return today;
  if (RELATIVE_DAYS.yesterday.includes(lower)) return yesterdayInSeoul(today);
  return null;
}

function resolveCategoryNames(
  categories: Category[],
  categoryId: number | null,
): { major: string | null; minor: string | null } {
  if (categoryId == null) return { major: null, minor: null };
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return { major: null, minor: null };
  if (isMinor(cat)) {
    const major = categories.find((c) => c.id === cat.parent_id);
    return { major: major?.name ?? null, minor: cat.name };
  }
  if (isMajor(cat)) return { major: cat.name, minor: null };
  return { major: null, minor: null };
}

async function loadLedgerForAi(
  supabase: SupabaseClient,
  memberUniqueId: string,
  categories: Category[],
): Promise<{ expenses: LedgerRowForAi[]; incomes: LedgerRowForAi[] }> {
  const [{ data: expenseRows, error: expenseError }, { data: incomeRows, error: incomeError }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("date, amount, description, category_id")
        .eq("member_unique_id", memberUniqueId)
        .order("date", { ascending: false }),
      supabase
        .from("incomes")
        .select("date, amount, description, category_id")
        .eq("member_unique_id", memberUniqueId)
        .order("date", { ascending: false }),
    ]);

  if (expenseError) throw new Error(expenseError.message);
  if (incomeError) throw new Error(incomeError.message);

  const mapRows = (
    rows: Array<{
      date: string;
      amount: number;
      description: string;
      category_id: number | null;
    }> | null,
    type: "expense" | "income",
  ): LedgerRowForAi[] =>
    (rows ?? []).map((row) => {
      const names = resolveCategoryNames(categories, row.category_id);
      return {
        type,
        date: row.date,
        amount: row.amount,
        description: row.description,
        category_major: names.major,
        category_minor: names.minor,
      };
    });

  return {
    expenses: mapRows(expenseRows, "expense"),
    incomes: mapRows(incomeRows, "income"),
  };
}

async function answerSearch(query: string, hits: SearchHit[], locale: Locale): Promise<string> {
  const reply = await generateGeminiText(
    `You are a friendly household-ledger search assistant. Answer in ${LOCALE_ENGLISH_NAMES[locale]}.
Never mention member identifiers or unique IDs.
Search query: ${query}
Search results (JSON):
${formatSearchHitsForAi(hits)}

Answer naturally based on the results. If there are no results, say so.
Use thousands separators for amounts. 2 to 6 sentences.`,
  );
  return reply.trim() || formatSearchHitsForUi(hits, locale);
}

export async function POST(request: Request) {
  let locale: Locale = DEFAULT_LOCALE;
  try {
    const session = await getSessionMember();
    if (!session) {
      return NextResponse.json(
        { error: "Login required", reply: getMessages(locale).server.loginRequired },
        { status: 401 },
      );
    }
    const memberUniqueId = session.uniqueId;
    locale = session.language;
    const m = getMessages(locale).server;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set", reply: m.aiConfig },
        { status: 500 },
      );
    }

    const body = (await request.json()) as ChatBody;
    const message = body.message?.trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return NextResponse.json(
        { error: "Message is required", reply: m.enterMessage },
        { status: 400 },
      );
    }

    const today = todayInSeoul();
    const supabase = createServerSupabase();
    const intent = classifyChatIntent(message);

    let trees: Awaited<ReturnType<typeof ensureAiCategoryTrees>>;
    try {
      trees = await ensureAiCategoryTrees(supabase, memberUniqueId, locale);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Category setup failed";
      return NextResponse.json({ error: detail, reply: m.categoryFailed }, { status: 500 });
    }
    const { categories, expenseTree, incomeTree, generated } = trees;

    const answerQuestion = async () => {
      const { expenses, incomes } = await loadLedgerForAi(supabase, memberUniqueId, categories);
      const reply = await answerStatsQuestion({
        question: message,
        today,
        locale,
        expenses,
        incomes,
        history,
      });
      return NextResponse.json({
        reply,
        intent: "question",
        extracted: null,
        saved: null,
        generated,
      });
    };

    const searchResponse = async (query: string) => {
      const hits = await searchMemberLedger(supabase, memberUniqueId, query);
      return NextResponse.json({
        reply: await answerSearch(query, hits, locale),
        intent: "search",
        search: { query, hits },
        extracted: null,
        saved: null,
        generated,
      });
    };

    // Stats / lookup questions
    if (intent === "question") {
      try {
        return await answerQuestion();
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Stats question failed";
        return NextResponse.json({ error: detail, reply: m.statsFailed }, { status: 500 });
      }
    }

    // Search
    if (intent === "search") {
      try {
        return await searchResponse(extractSearchQuery(message) || message);
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Search failed";
        return NextResponse.json({ error: detail, reply: m.searchFailed }, { status: 500 });
      }
    }

    // Expense / income entries
    let analysis;
    try {
      analysis = await analyzeExpenseMessage({
        message,
        today,
        locale,
        expenseTree,
        history,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Gemini API error";
      return NextResponse.json(
        { error: detail, reply: err instanceof GeminiBusyError ? m.aiBusy : m.aiError },
        { status: 500 },
      );
    }

    // The analyzer judged it a question that the heuristics missed
    if (analysis.status === "chat" && looksLikeStatsQuestion(message)) {
      try {
        return await answerQuestion();
      } catch {
        // fall through
      }
    }

    if (analysis.status === "need_info") {
      return NextResponse.json({
        reply: analysis.reply || m.needDateAmount,
        intent: "ledger",
        extracted: null,
        saved: null,
        generated,
      });
    }

    if (analysis.status === "ok") {
      const date = normalizeDate(analysis.date, today) ?? today;
      const amount = Number(analysis.amount);
      const description = analysis.description?.trim();

      if (!description || Number.isNaN(amount) || amount <= 0) {
        return NextResponse.json({
          reply: m.amountUnclear,
          intent: "ledger",
          extracted: null,
          saved: null,
          generated,
        });
      }

      const extracted = {
        date,
        description,
        amount: Math.round(amount),
        item_name: analysis.item_name,
        place: analysis.place,
        category_major: analysis.category_major,
        category_minor: analysis.category_minor,
      };

      const categoryId = findMinorCategoryId(
        categories,
        "expense",
        extracted.category_major,
        extracted.category_minor,
      );

      const labels = await recordExpenseLabels(
        supabase,
        memberUniqueId,
        extracted.amount,
        {
          itemName: extracted.item_name ?? extracted.description,
          place: extracted.place,
        },
      );

      const { data, error } = await supabase
        .from("expenses")
        .insert({
          date: extracted.date,
          amount: extracted.amount,
          description: extracted.description,
          item_name: labels.item_name,
          place: labels.place,
          member_unique_id: memberUniqueId,
          category_id: categoryId,
        })
        .select(
          "id, date, amount, description, item_name, place, category_id, created_at",
        )
        .single();

      if (error) {
        return NextResponse.json(
          { error: error.message, reply: m.saveFailed, extracted },
          { status: 500 },
        );
      }

      return NextResponse.json({
        reply: formatSavedConfirm("expense", extracted, locale),
        intent: "ledger",
        extracted,
        saved: {
          type: "expense" as const,
          ...data,
          categoryName: categories.find((c) => c.id === categoryId)?.name ?? null,
        },
        generated,
      });
    }

    try {
      const parsed = await parseLedgerMessage({
        message,
        today,
        locale,
        expenseTree,
        incomeTree,
        history,
      });

      if (parsed.intent === "clarify") {
        return NextResponse.json({
          reply: parsed.reply || m.clarify,
          intent: "ledger",
          extracted: null,
          saved: null,
          generated,
        });
      }

      if (parsed.intent === "search") {
        return await searchResponse(
          parsed.search_query?.trim() || extractSearchQuery(message) || message,
        );
      }

      if (parsed.intent === "save_income") {
        const amount = Number(parsed.amount);
        const description = parsed.description?.trim();
        const date = normalizeDate(parsed.date, today) ?? today;

        if (!description || Number.isNaN(amount) || amount <= 0) {
          return NextResponse.json({
            reply: parsed.reply || m.incomeNeedInfo,
            intent: "ledger",
            extracted: null,
            saved: null,
            generated,
          });
        }

        const categoryId = findMinorCategoryId(categories, "income", parsed.major, parsed.minor);

        const labels = await recordIncomeLabels(supabase, memberUniqueId, Math.round(amount), {
          incomeDetail: parsed.income_detail ?? description,
          incomeSource: parsed.income_source,
        });

        const { data, error } = await supabase
          .from("incomes")
          .insert({
            date,
            amount: Math.round(amount),
            description,
            income_detail: labels.income_detail,
            income_source: labels.income_source,
            member_unique_id: memberUniqueId,
            category_id: categoryId,
          })
          .select(
            "id, date, amount, description, income_detail, income_source, category_id, created_at",
          )
          .single();

        if (error) {
          return NextResponse.json(
            { error: error.message, reply: m.incomeSaveFailed },
            { status: 500 },
          );
        }

        return NextResponse.json({
          reply:
            parsed.reply ||
            formatSavedConfirm("income", { date, description, amount: Math.round(amount) }, locale),
          intent: "ledger",
          extracted: {
            date,
            description,
            amount: Math.round(amount),
            income_detail: labels.income_detail,
            income_source: labels.income_source,
            category_major: parsed.major,
            category_minor: parsed.minor,
          },
          saved: {
            type: "income" as const,
            ...data,
            categoryName: categories.find((c) => c.id === categoryId)?.name ?? null,
          },
          generated,
        });
      }

      // save_expense via the parseLedger fallback
      if (parsed.intent === "save_expense") {
        const amount = Number(parsed.amount);
        const description = parsed.description?.trim();
        const date = normalizeDate(parsed.date, today) ?? today;
        if (!description || Number.isNaN(amount) || amount <= 0) {
          return NextResponse.json({
            reply: parsed.reply || m.needAmountDescription,
            intent: "ledger",
            extracted: null,
            saved: null,
            generated,
          });
        }
        const categoryId = findMinorCategoryId(categories, "expense", parsed.major, parsed.minor);
        const labels = await recordExpenseLabels(supabase, memberUniqueId, Math.round(amount), {
          itemName: parsed.item_name ?? description,
          place: parsed.place,
        });
        const { data, error } = await supabase
          .from("expenses")
          .insert({
            date,
            amount: Math.round(amount),
            description,
            item_name: labels.item_name,
            place: labels.place,
            member_unique_id: memberUniqueId,
            category_id: categoryId,
          })
          .select(
            "id, date, amount, description, item_name, place, category_id, created_at",
          )
          .single();
        if (error) {
          return NextResponse.json({ error: error.message, reply: m.saveFailed }, { status: 500 });
        }
        return NextResponse.json({
          reply:
            parsed.reply ||
            formatSavedConfirm("expense", { date, description, amount: Math.round(amount) }, locale),
          intent: "ledger",
          extracted: {
            date,
            description,
            amount: Math.round(amount),
            item_name: labels.item_name,
            place: labels.place,
            category_major: parsed.major,
            category_minor: parsed.minor,
          },
          saved: {
            type: "expense" as const,
            ...data,
            categoryName: categories.find((c) => c.id === categoryId)?.name ?? null,
          },
          generated,
        });
      }

      // Small talk that mentions the ledger: retry as a stats question
      if (parsed.intent === "chat" && mentionsLedgerTopic(message)) {
        try {
          return await answerQuestion();
        } catch {
          // fall through
        }
      }

      return NextResponse.json({
        reply: parsed.reply || analysis.reply,
        intent: "chat",
        extracted: null,
        saved: null,
        generated,
      });
    } catch {
      return NextResponse.json({
        reply: analysis.reply || m.whatToRecord,
        intent: "chat",
        extracted: null,
        saved: null,
        generated,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json(
      { error: message, reply: getMessages(locale).server.temporaryError },
      { status: 500 },
    );
  }
}
