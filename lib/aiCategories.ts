import { extractJson, generateGeminiText } from "@/lib/gemini";
import type { CategoryKind } from "@/lib/categories";
import {
  DEFAULT_CATEGORY_TREES,
  OTHER_MINOR_EXAMPLES,
  containsOtherMarker,
  otherMinorName,
  type CategoryTree,
} from "@/lib/i18n/categoryDefaults";
import { formatMoney, formatMonthDay } from "@/lib/i18n/format";
import { LOCALE_ENGLISH_NAMES, type Locale } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";

export type AiCategoryTree = CategoryTree;

type ChatTurn = { role: "user" | "assistant"; content: string };

function formatHistory(history: ChatTurn[], limit: number): string {
  const text = history
    .slice(-limit)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
  return text || "(none)";
}

const AMOUNT_RULES = `- amount is an integer in the user's currency (Korean won, Japanese yen, etc.).
- "만" (Korean) and "万" (Japanese) mean x10,000, e.g. "2만원" = 20000, "3万円" = 30000.`;

export async function generateCategoryTree(
  kind: CategoryKind,
  locale: Locale,
): Promise<AiCategoryTree> {
  const language = LOCALE_ENGLISH_NAMES[locale];
  const prompt = `You design categories for a personal household ledger.
Return ONLY JSON: a tree of major and minor categories for classifying ${kind === "expense" ? "expenses" : "income"}.

Rules:
- Exactly 8 majors.
- Each major has 2 to 4 minors.
- The last minor of every major is that major's catch-all "other" bucket, written like ${OTHER_MINOR_EXAMPLES[locale]}.
- All names are short, clear ${language}.
- No text outside the JSON.

Format:
{"majors":[{"name":"Major","minors":["Minor 1","Minor 2","Major (other)"]}]}`;

  try {
    const tree = extractJson<AiCategoryTree>(await generateGeminiText(prompt));

    if (!Array.isArray(tree.majors) || tree.majors.length !== 8) {
      throw new Error(`Expected exactly 8 ${kind} majors`);
    }
    for (const major of tree.majors) {
      if (!major.name?.trim()) throw new Error("Empty major name");
      if (!Array.isArray(major.minors) || major.minors.length < 2 || major.minors.length > 4) {
        throw new Error(`"${major.name}" must have 2 to 4 minors`);
      }
    }

    return dedupeCategoryTree(tree, locale);
  } catch {
    return dedupeCategoryTree(DEFAULT_CATEGORY_TREES[locale][kind], locale);
  }
}

/** Category names must be unique per member and kind (DB unique constraint). */
function dedupeCategoryTree(tree: AiCategoryTree, locale: Locale): AiCategoryTree {
  const used = new Set<string>();
  const unique = (base: string, qualifier: string) => {
    let name = base.trim();
    if (used.has(name)) name = `${base.trim()}(${qualifier})`;
    let n = 2;
    while (used.has(name)) {
      name = `${base.trim()}${n}`;
      n += 1;
    }
    used.add(name);
    return name;
  };

  const majors = tree.majors.map((major, index) => ({
    name: unique(major.name, String(index + 1)),
    minors: major.minors,
  }));

  return {
    majors: majors.map((major) => {
      const minors = major.minors.map((m) => m.trim()).filter(Boolean);
      const last = minors[minors.length - 1] ?? "";
      if (!containsOtherMarker(last)) {
        minors[minors.length - 1] = otherMinorName(major.name, locale);
      }
      return {
        name: major.name,
        minors: minors.map((m) => unique(m, major.name)),
      };
    }),
  };
}

/** Expense analysis JSON returned by Gemini. */
export type ExpenseAnalysis = {
  status: "ok" | "need_info" | "chat";
  date: string | null;
  description: string | null;
  amount: number | null;
  item_name: string | null;
  place: string | null;
  category_major: string | null;
  category_minor: string | null;
  reply: string;
};

export type ParsedLedgerIntent = {
  intent: "save_expense" | "save_income" | "chat" | "clarify" | "search";
  date: string | null;
  amount: number | null;
  description: string | null;
  item_name: string | null;
  place: string | null;
  income_detail: string | null;
  income_source: string | null;
  major: string | null;
  minor: string | null;
  search_query: string | null;
  reply: string;
};

export async function analyzeExpenseMessage(params: {
  message: string;
  today: string;
  locale: Locale;
  expenseTree: AiCategoryTree;
  history: ChatTurn[];
}): Promise<ExpenseAnalysis> {
  const language = LOCALE_ENGLISH_NAMES[params.locale];
  const prompt = `You are a friendly AI household-ledger chatbot. Extract expense information from the user's natural-language message.
The user may write in Korean, English, or Japanese.
Today's date (Asia/Seoul): ${params.today}

Available expense categories (use only these names):
${JSON.stringify(params.expenseTree, null, 2)}

Recent conversation:
${formatHistory(params.history, 8)}

User message:
${params.message}

Rules:
1) If it's a stats/lookup/search question (how much, what, find, search, etc.), never save: status="chat".
2) If it records an expense and includes an amount, status="ok" and fill date, description, amount, item_name, place, category_major, category_minor.
3) date is YYYY-MM-DD. "today" = ${params.today}, "yesterday" = one day earlier. If the date is unknown, null.
${AMOUNT_RULES}
   If the amount is unknown, null.
4) description: a short phrase in the user's own words and language (e.g. taxi, lunch).
5) item_name: the purchased item (e.g. americano, kimchi). If unknown, same as description or null.
6) place: store or place of purchase (e.g. Starbucks). null if none.
7) category_major / category_minor must be names from the tree above. If unsure, use that major's catch-all "other" minor.
8) If it's meant as a record but the date or amount is missing, status="need_info".
9) Greetings or small talk: status="chat".
10) reply: a friendly reply written in ${language}. If status="ok", confirm that it was saved.

Return ONLY JSON:
{"status":"ok|need_info|chat","date":"YYYY-MM-DD|null","description":"text|null","amount":20000,"item_name":"taxi","place":null,"category_major":"Transport","category_minor":"Transport (Other)","reply":"reply"}`;

  const parsed = extractJson<ExpenseAnalysis>(await generateGeminiText(prompt));

  if (!parsed.reply?.trim()) {
    parsed.reply = getMessages(params.locale).server.defaultExpenseReply;
  }
  parsed.item_name = parsed.item_name ?? null;
  parsed.place = parsed.place ?? null;

  return parsed;
}

export async function parseLedgerMessage(params: {
  message: string;
  today: string;
  locale: Locale;
  expenseTree: AiCategoryTree;
  incomeTree: AiCategoryTree;
  history: ChatTurn[];
}): Promise<ParsedLedgerIntent> {
  const language = LOCALE_ENGLISH_NAMES[params.locale];
  const prompt = `You are a kind, chat-style AI household-ledger assistant.
The user may write in Korean, English, or Japanese.
Today's date: ${params.today}

Expense categories:
${JSON.stringify(params.expenseTree, null, 2)}

Income categories:
${JSON.stringify(params.incomeTree, null, 2)}

Recent conversation:
${formatHistory(params.history, 8)}

User message:
${params.message}

Tasks:
1) If the message records an expense or income, set intent to save_expense or save_income.
2) If it asks to find/search past records, intent=search and put the key keywords in search_query.
3) Extract date (YYYY-MM-DD), amount, and description (in the user's own words and language).
${AMOUNT_RULES}
4) For expenses also extract item_name (purchased item) and place (where it was bought).
5) For income also extract income_detail (what the income was) and income_source (who paid).
6) Pick the best major/minor names exactly as written in the matching tree.
7) If there is no date, use ${params.today}. If there is no amount, intent=clarify.
8) If information is missing, intent=clarify.
9) General conversation: intent=chat.
10) reply: 1 to 3 short, friendly sentences in ${language}.

Return ONLY JSON:
{"intent":"save_expense|save_income|search|chat|clarify","date":"YYYY-MM-DD|null","amount":12345,"description":"text","item_name":"item|null","place":"place|null","income_detail":"detail|null","income_source":"source|null","major":"major","minor":"minor","search_query":"keywords|null","reply":"reply"}`;

  const parsed = extractJson<ParsedLedgerIntent>(await generateGeminiText(prompt));

  if (!parsed.reply?.trim()) {
    parsed.reply = getMessages(params.locale).server.defaultReply;
  }
  parsed.item_name = parsed.item_name ?? null;
  parsed.place = parsed.place ?? null;
  parsed.income_detail = parsed.income_detail ?? null;
  parsed.income_source = parsed.income_source ?? null;
  parsed.search_query = parsed.search_query ?? null;

  return parsed;
}

export function formatSavedConfirm(
  kind: "expense" | "income",
  params: { date: string; description: string; amount: number },
  locale: Locale,
): string {
  const m = getMessages(locale).server;
  const format = kind === "expense" ? m.savedExpense : m.savedIncome;
  return format(
    formatMonthDay(params.date, locale),
    params.description,
    formatMoney(params.amount, locale),
  );
}

export type LedgerRowForAi = {
  type: "expense" | "income";
  date: string;
  amount: number;
  description: string;
  category_major: string | null;
  category_minor: string | null;
};

export async function answerStatsQuestion(params: {
  question: string;
  today: string;
  locale: Locale;
  expenses: LedgerRowForAi[];
  incomes: LedgerRowForAi[];
  history: ChatTurn[];
}): Promise<string> {
  const language = LOCALE_ENGLISH_NAMES[params.locale];
  const expensePayload = params.expenses.slice(0, 400);
  const incomePayload = params.incomes.slice(0, 200);

  const prompt = `You are a friendly AI household-ledger chatbot. Answer in ${language}.
Today's date (Asia/Seoul): ${params.today}

Below is the user's real ledger data. Base your answer only on this data.
Do not make anything up. If there is no data, say so honestly.
Write amounts with thousands separators, like "${formatMoney(20000, params.locale)}".
Answer in 2 to 5 short, natural sentences. No JSON, no markdown headings.

Expenses (${params.expenses.length} total, up to 400 included):
${JSON.stringify(expensePayload)}

Income (${params.incomes.length} total, up to 200 included):
${JSON.stringify(incomePayload)}

Recent conversation:
${formatHistory(params.history, 6)}

User question:
${params.question}`;

  const text = (await generateGeminiText(prompt)).trim();
  return text || getMessages(params.locale).server.statsNoAnswer;
}
