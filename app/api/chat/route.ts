import { NextResponse } from "next/server";
import {
  analyzeExpenseMessage,
  answerStatsQuestion,
  formatExpenseConfirm,
  parseLedgerMessage,
  type LedgerRowForAi,
} from "@/lib/aiCategories";
import {
  ensureAiCategoryTrees,
  findMinorCategoryId,
} from "@/lib/aiCategoryService";
import { classifyChatIntent } from "@/lib/chatIntent";
import type { Category } from "@/lib/categories";
import { isMajor, isMinor } from "@/lib/categories";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ChatBody = {
  message?: string;
  memberUniqueId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
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
  if (trimmed === "오늘") return today;
  if (trimmed === "어제") return yesterdayInSeoul(today);
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

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY가 설정되지 않았습니다. .env.local을 확인해 주세요.",
          reply: "지금은 AI 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as ChatBody;
    const message = body.message?.trim();
    const memberUniqueId = body.memberUniqueId?.trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return NextResponse.json(
        { error: "메시지를 입력하세요", reply: "메시지를 입력해 주세요." },
        { status: 400 },
      );
    }
    if (!memberUniqueId) {
      return NextResponse.json(
        { error: "로그인이 필요합니다", reply: "로그인이 필요해요." },
        { status: 401 },
      );
    }

    const today = todayInSeoul();
    const supabase = createServerSupabase();
    const intent = classifyChatIntent(message);

    let categories;
    let expenseTree;
    let incomeTree;
    let generated;

    try {
      ({ categories, expenseTree, incomeTree, generated } =
        await ensureAiCategoryTrees(supabase, memberUniqueId));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "카테고리 준비 실패";
      return NextResponse.json(
        {
          error: detail,
          reply:
            "카테고리를 준비하는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
        },
        { status: 500 },
      );
    }

    // ——— 통계/조회 질문 ———
    if (intent === "question") {
      try {
        const { expenses, incomes } = await loadLedgerForAi(
          supabase,
          memberUniqueId,
          categories,
        );
        const reply = await answerStatsQuestion({
          question: message,
          today,
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
      } catch (err) {
        const detail = err instanceof Error ? err.message : "통계 질문 처리 실패";
        return NextResponse.json(
          {
            error: detail,
            reply:
              "지출 데이터를 살펴보는 중 문제가 생겼어요. 잠시 후 다시 물어봐 주세요.",
          },
          { status: 500 },
        );
      }
    }

    // ——— 지출/수입 기록 ———
    let analysis;
    try {
      analysis = await analyzeExpenseMessage({
        message,
        today,
        expenseTree,
        history,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Gemini API 오류";
      return NextResponse.json(
        {
          error: detail,
          reply: detail.includes("혼잡")
            ? detail
            : "AI 응답 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
        },
        { status: 500 },
      );
    }

    // analyze가 질문으로 판단한 경우 (휴리스틱 누락 보완)
    if (
      analysis.status === "chat" &&
      /얼마|뭐|어떻게|총\s*지출|가장\s*많이|지난\s*주|이번\s*달/.test(message)
    ) {
      try {
        const { expenses, incomes } = await loadLedgerForAi(
          supabase,
          memberUniqueId,
          categories,
        );
        const reply = await answerStatsQuestion({
          question: message,
          today,
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
      } catch {
        // fall through
      }
    }

    if (analysis.status === "need_info") {
      return NextResponse.json({
        reply:
          analysis.reply ||
          "날짜와 금액을 함께 알려주세요. 예: 어제 택시 20000원",
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
          reply:
            "금액과 내용을 파악하지 못했어요. 예: 오늘 점심 15000원 처럼 다시 알려주세요.",
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
        category_major: analysis.category_major,
        category_minor: analysis.category_minor,
      };

      const categoryId = findMinorCategoryId(
        categories,
        "expense",
        extracted.category_major,
        extracted.category_minor,
      );

      const { data, error } = await supabase
        .from("expenses")
        .insert({
          date: extracted.date,
          amount: extracted.amount,
          description: extracted.description,
          member_unique_id: memberUniqueId,
          category_id: categoryId,
        })
        .select("id, date, amount, description, category_id, created_at")
        .single();

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
            reply: "저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
            extracted,
          },
          { status: 500 },
        );
      }

      const categoryName =
        categories.find((c) => c.id === categoryId)?.name ??
        extracted.category_minor ??
        extracted.category_major ??
        "미분류";

      const reply = analysis.reply?.includes("저장")
        ? analysis.reply
        : formatExpenseConfirm(extracted);

      return NextResponse.json({
        reply,
        intent: "ledger",
        extracted,
        saved: {
          type: "expense" as const,
          ...data,
          categoryName,
        },
        generated,
      });
    }

    try {
      const parsed = await parseLedgerMessage({
        message,
        today,
        expenseTree,
        incomeTree,
        history,
      });

      if (parsed.intent === "clarify") {
        return NextResponse.json({
          reply:
            parsed.reply ||
            "날짜나 금액을 조금 더 알려주시면 저장할게요.",
          intent: "ledger",
          extracted: null,
          saved: null,
          generated,
        });
      }

      if (parsed.intent === "save_income") {
        const amount = Number(parsed.amount);
        const description = parsed.description?.trim();
        const date = normalizeDate(parsed.date, today) ?? today;

        if (!description || Number.isNaN(amount) || amount <= 0) {
          return NextResponse.json({
            reply:
              parsed.reply ||
              "수입 금액과 내용을 함께 알려주세요. 예: 오늘 월급 300만원",
            intent: "ledger",
            extracted: null,
            saved: null,
            generated,
          });
        }

        const categoryId = findMinorCategoryId(
          categories,
          "income",
          parsed.major,
          parsed.minor,
        );

        const { data, error } = await supabase
          .from("incomes")
          .insert({
            date,
            amount: Math.round(amount),
            description,
            member_unique_id: memberUniqueId,
            category_id: categoryId,
          })
          .select("id, date, amount, description, category_id, created_at")
          .single();

        if (error) {
          return NextResponse.json(
            {
              error: error.message,
              reply: "수입 저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
            },
            { status: 500 },
          );
        }

        return NextResponse.json({
          reply: parsed.reply,
          intent: "ledger",
          extracted: {
            date,
            description,
            amount: Math.round(amount),
            category_major: parsed.major,
            category_minor: parsed.minor,
          },
          saved: {
            type: "income" as const,
            ...data,
            categoryName:
              categories.find((c) => c.id === categoryId)?.name ??
              parsed.minor ??
              "미분류",
          },
          generated,
        });
      }

      // 일반 대화인데 통계성 표현이면 질문으로 재시도
      if (
        parsed.intent === "chat" &&
        /지출|수입|썼|샀|통계|내역/.test(message)
      ) {
        try {
          const { expenses, incomes } = await loadLedgerForAi(
            supabase,
            memberUniqueId,
            categories,
          );
          const reply = await answerStatsQuestion({
            question: message,
            today,
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
        reply: analysis.reply || "무엇을 기록할까요? 예: 오늘 점심 15000원",
        intent: "chat",
        extracted: null,
        saved: null,
        generated,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "챗봇 처리에 실패했습니다";
    return NextResponse.json(
      {
        error: message,
        reply: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}
