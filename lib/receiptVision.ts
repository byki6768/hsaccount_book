import { extractJson, generateGeminiText } from "@/lib/gemini";
import type { AiCategoryTree } from "@/lib/aiCategories";
import { LOCALE_ENGLISH_NAMES, type Locale } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";

export type ReceiptLineItem = {
  name: string;
  amount: number | null;
};

export type ReceiptExtraction = {
  store_name: string | null;
  date: string | null;
  amount: number | null;
  /** @deprecated use line_items */
  items: string[];
  line_items: ReceiptLineItem[];
  description: string | null;
  category_major: string | null;
  category_minor: string | null;
  confidence: "high" | "medium" | "low";
};

export async function extractReceiptFromImage(params: {
  imageBase64: string;
  mimeType: string;
  today: string;
  locale: Locale;
  expenseTree: AiCategoryTree;
}): Promise<ReceiptExtraction> {
  const language = LOCALE_ENGLISH_NAMES[params.locale];
  const prompt = `You are a receipt OCR and household-ledger analyzer. Receipts may be Korean, Japanese, or English.
Today's date (Asia/Seoul): ${params.today}

Read the receipt image and return ONLY JSON.

Fields:
- store_name: store/business name (null if none)
- date: payment/issue date YYYY-MM-DD (null if none; if the year is missing use ${params.today.slice(0, 4)})
- amount: total paid as an integer in the receipt's currency. Prefer the grand total / amount due / amount paid.
- line_items: array of individual items, each {"name":"item name","amount":integer or null}
  - Extract as many item names and per-item amounts as possible (max 30), names as printed
  - If an amount is not visible, amount=null but keep the name
- items: array of just the line_items names (for compatibility)
- description: a short one-line summary in ${language} for the ledger (store + main item recommended)
- category_major / category_minor: choose only from the expense category tree below. If unsure, use the major's catch-all "other" minor.
- confidence: high|medium|low

Expense categories:
${JSON.stringify(params.expenseTree, null, 2)}

Rules:
- If it's not a receipt, amount=null and confidence=low
- Never invent an amount. If unreadable, null
- No text outside the JSON

Format:
{"store_name":"Starbucks","date":"2026-09-11","amount":11000,"line_items":[{"name":"Americano","amount":5500},{"name":"Cafe Latte","amount":5500}],"items":["Americano","Cafe Latte"],"description":"Starbucks · Americano and more","category_major":"Food","category_minor":"Food (Other)","confidence":"high"}`;

  const text = await generateGeminiText(prompt, {
    image: {
      data: params.imageBase64,
      mimeType: params.mimeType,
    },
  });

  const parsed = extractJson<ReceiptExtraction>(text);

  const rawLines = Array.isArray(parsed.line_items) ? parsed.line_items : [];
  parsed.line_items = rawLines
    .map((line) => {
      const name = String(line?.name ?? "").trim();
      if (!name) return null;
      const amountRaw = line?.amount;
      const amountNum =
        amountRaw == null || amountRaw === ("" as unknown)
          ? null
          : Math.round(Number(amountRaw));
      return {
        name: name.slice(0, 120),
        amount: amountNum != null && Number.isFinite(amountNum) && amountNum > 0
          ? amountNum
          : null,
      };
    })
    .filter((line): line is ReceiptLineItem => line != null);

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    parsed.items = parsed.line_items.map((line) => line.name);
  } else {
    parsed.items = parsed.items.map((name) => String(name).trim()).filter(Boolean);
  }

  // Fill line_items from item names when the model only returned names
  if (parsed.line_items.length === 0 && parsed.items.length > 0) {
    parsed.line_items = parsed.items.map((name) => ({ name, amount: null }));
  }

  if (parsed.amount != null) {
    const n = Number(parsed.amount);
    parsed.amount = Number.isFinite(n) ? Math.round(n) : null;
  }
  if (parsed.description) parsed.description = parsed.description.trim();
  if (parsed.store_name) parsed.store_name = parsed.store_name.trim();

  return parsed;
}

export function buildReceiptDescription(
  extracted: ReceiptExtraction,
  locale: Locale,
): string {
  if (extracted.description?.trim()) return extracted.description.trim();

  const m = getMessages(locale).server;
  const store = extracted.store_name?.trim();
  const names = extracted.line_items.map((line) => line.name).filter(Boolean);
  if (store && names.length > 0) {
    const head = names.slice(0, 2).join(", ");
    const more = names.length > 2 ? m.receiptAndMore : "";
    return `${store} · ${head}${more}`;
  }
  if (store) return store;
  if (names.length > 0) return names.slice(0, 3).join(", ");
  return m.receiptFallbackDescription;
}
