import { NextResponse } from "next/server";
import { formatExpenseConfirm } from "@/lib/aiCategories";
import {
  ensureAiCategoryTrees,
  findMinorCategoryId,
} from "@/lib/aiCategoryService";
import {
  buildReceiptDescription,
  extractReceiptFromImage,
} from "@/lib/receiptVision";
import { recordExpenseLabels, saveExpenseLineItems } from "@/lib/ledgerLabels";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const MAX_BYTES = 4 * 1024 * 1024; // 4MB (Vercel 요청 한도 고려)

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeDate(raw: string | null, today: string): string {
  if (!raw) return today;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const loose = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (loose) {
    const [, yy, mm, dd] = loose;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return today;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY가 없습니다",
          reply: "AI 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요.",
        },
        { status: 500 },
      );
    }

    const form = await request.formData();
    const memberUniqueId = String(form.get("memberUniqueId") ?? "").trim();
    const file = form.get("image");

    if (!memberUniqueId) {
      return NextResponse.json(
        { error: "로그인이 필요합니다", reply: "로그인이 필요해요." },
        { status: 401 },
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "이미지 파일이 필요합니다",
          reply: "영수증 사진을 선택해 주세요.",
        },
        { status: 400 },
      );
    }

    const mimeType = (file.type || "image/jpeg").toLowerCase();
    if (!ALLOWED_MIME.has(mimeType) && !mimeType.startsWith("image/")) {
      return NextResponse.json(
        {
          error: "지원하지 않는 이미지 형식입니다",
          reply: "JPG, PNG, WEBP 같은 이미지로 올려 주세요.",
        },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          error: "이미지 용량이 너무 큽니다",
          reply: "4MB 이하 영수증 사진으로 다시 올려 주세요.",
        },
        { status: 400 },
      );
    }

    const today = todayInSeoul();
    const supabase = createServerSupabase();
    const { categories, expenseTree, generated } = await ensureAiCategoryTrees(
      supabase,
      memberUniqueId,
    );

    const base64 = bufferToBase64(await file.arrayBuffer());
    const extracted = await extractReceiptFromImage({
      imageBase64: base64,
      mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
      today,
      expenseTree,
    });

    const amount = extracted.amount;
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({
        reply:
          "영수증에서 금액을 읽지 못했어요. 더 선명한 사진으로 다시 찍거나, 텍스트로 알려 주세요.",
        extracted,
        saved: null,
        generated,
      });
    }

    const date = normalizeDate(extracted.date, today);
    const description = buildReceiptDescription(extracted);
    const categoryId = findMinorCategoryId(
      categories,
      "expense",
      extracted.category_major,
      extracted.category_minor,
    );

    const representativeItem =
      extracted.line_items[0]?.name ??
      extracted.items[0] ??
      extracted.description ??
      extracted.store_name ??
      null;

    // 개별 품목이 있으면 품목 합계는 line_items에서만 누적 (중복 방지)
    const labels = await recordExpenseLabels(
      supabase,
      memberUniqueId,
      Math.round(amount),
      {
        itemName: extracted.line_items.length > 0 ? null : representativeItem,
        place: extracted.store_name,
      },
    );

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        date,
        amount: Math.round(amount),
        description,
        item_name: labels.item_name ?? representativeItem,
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
        {
          error: error.message,
          reply: "인식은 됐지만 저장에 실패했어요. 잠시 후 다시 시도해 주세요.",
          extracted,
        },
        { status: 500 },
      );
    }

    if (extracted.line_items.length > 0) {
      await saveExpenseLineItems(supabase, {
        expenseId: data.id,
        memberUniqueId,
        lines: extracted.line_items,
      });
    }

    const categoryName =
      categories.find((c) => c.id === categoryId)?.name ??
      extracted.category_minor ??
      extracted.category_major ??
      "미분류";

    const storeLine = extracted.store_name
      ? ` (${extracted.store_name})`
      : "";
    const itemsLine =
      extracted.line_items.length > 0
        ? `\n품목: ${extracted.line_items
            .slice(0, 5)
            .map((line) =>
              line.amount
                ? `${line.name} ${line.amount.toLocaleString("ko-KR")}원`
                : line.name,
            )
            .join(", ")}`
        : extracted.items.length > 0
          ? `\n품목: ${extracted.items.slice(0, 5).join(", ")}`
          : "";

    const reply = `${formatExpenseConfirm({
      date,
      description,
      amount: Math.round(amount),
    })}${storeLine}${itemsLine}\n분류: ${categoryName}`;

    return NextResponse.json({
      reply,
      extracted: {
        store_name: extracted.store_name,
        date,
        amount: Math.round(amount),
        items: extracted.items,
        line_items: extracted.line_items,
        description,
        category_major: extracted.category_major,
        category_minor: extracted.category_minor,
        confidence: extracted.confidence,
      },
      saved: {
        type: "expense" as const,
        ...data,
        categoryName,
        line_items: extracted.line_items,
      },
      generated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "영수증 분석 실패";
    return NextResponse.json(
      {
        error: message,
        reply: message.includes("혼잡")
          ? message
          : "영수증 분석 중 오류가 났어요. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 },
    );
  }
}
