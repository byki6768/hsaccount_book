import { NextResponse } from "next/server";
import { formatSavedConfirm } from "@/lib/aiCategories";
import { GeminiBusyError } from "@/lib/gemini";
import { formatMoney } from "@/lib/i18n/format";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";
import {
  ensureAiCategoryTrees,
  findMinorCategoryId,
} from "@/lib/aiCategoryService";
import {
  buildReceiptDescription,
  extractReceiptFromImage,
} from "@/lib/receiptVision";
import { recordExpenseLabels, saveExpenseLineItems } from "@/lib/ledgerLabels";
import { getSessionMember } from "@/lib/session";
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

const MAX_BYTES = 4 * 1024 * 1024; // 4MB, within Vercel's request body limit

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

    const form = await request.formData();
    const file = form.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required", reply: m.needImage },
        { status: 400 },
      );
    }

    const mimeType = (file.type || "image/jpeg").toLowerCase();
    if (!ALLOWED_MIME.has(mimeType) && !mimeType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Unsupported image type", reply: m.unsupportedImage },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image is too large", reply: m.imageTooLarge },
        { status: 400 },
      );
    }

    const today = todayInSeoul();
    const supabase = createServerSupabase();
    const { categories, expenseTree, generated } = await ensureAiCategoryTrees(
      supabase,
      memberUniqueId,
      locale,
    );

    const base64 = bufferToBase64(await file.arrayBuffer());
    const extracted = await extractReceiptFromImage({
      imageBase64: base64,
      mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
      today,
      locale,
      expenseTree,
    });

    const amount = extracted.amount;
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({
        reply: m.receiptNoAmount,
        extracted,
        saved: null,
        generated,
      });
    }

    const date = normalizeDate(extracted.date, today);
    const description = buildReceiptDescription(extracted, locale);
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

    // With line items, item totals are accumulated from line_items only (avoids double counting)
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
        { error: error.message, reply: m.receiptSaveFailed, extracted },
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
      getMessages(locale).common.uncategorized;

    const storeLine = extracted.store_name
      ? ` (${extracted.store_name})`
      : "";
    const itemsLine =
      extracted.line_items.length > 0
        ? `\n${m.receiptItems}: ${extracted.line_items
            .slice(0, 5)
            .map((line) =>
              line.amount ? `${line.name} ${formatMoney(line.amount, locale)}` : line.name,
            )
            .join(", ")}`
        : extracted.items.length > 0
          ? `\n${m.receiptItems}: ${extracted.items.slice(0, 5).join(", ")}`
          : "";

    const reply = `${formatSavedConfirm(
      "expense",
      { date, description, amount: Math.round(amount) },
      locale,
    )}${storeLine}${itemsLine}\n${m.receiptCategory}: ${categoryName}`;

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
    const message = err instanceof Error ? err.message : "Receipt analysis failed";
    const m = getMessages(locale).server;
    return NextResponse.json(
      { error: message, reply: err instanceof GeminiBusyError ? m.aiBusy : m.receiptFailed },
      { status: 500 },
    );
  }
}
