import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";

export type SearchHit = {
  type:
    | "expense"
    | "income"
    | "purchase_item"
    | "purchase_place"
    | "income_detail"
    | "income_source"
    | "category"
    | "expense_line_item";
  date?: string | null;
  amount?: number | null;
  description?: string | null;
  item_name?: string | null;
  item_amount?: number | null;
  place?: string | null;
  income_detail?: string | null;
  income_source?: string | null;
  category_name?: string | null;
  total_amount?: number | null;
  entry_count?: number | null;
  name?: string | null;
  kind?: string | null;
};

/**
 * Searches ledger data, never exposing member identifiers or unique IDs.
 */
export async function searchMemberLedger(
  supabase: SupabaseClient,
  memberUniqueId: string,
  query: string,
  limit = 40,
): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const safe = q.replace(/[%_,()]/g, " ").trim();
  if (!safe) return [];
  const like = `%${safe}%`;
  const hits: SearchHit[] = [];

  const expenseOr = [
    `description.ilike."${like}"`,
    `item_name.ilike."${like}"`,
    `place.ilike."${like}"`,
  ].join(",");
  const incomeOr = [
    `description.ilike."${like}"`,
    `income_detail.ilike."${like}"`,
    `income_source.ilike."${like}"`,
  ].join(",");

  const [
    { data: expenses },
    { data: incomes },
    { data: lineItems },
    { data: items },
    { data: places },
    { data: details },
    { data: sources },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("date, amount, description, item_name, place")
      .eq("member_unique_id", memberUniqueId)
      .or(expenseOr)
      .order("date", { ascending: false })
      .limit(limit),
    supabase
      .from("incomes")
      .select("date, amount, description, income_detail, income_source")
      .eq("member_unique_id", memberUniqueId)
      .or(incomeOr)
      .order("date", { ascending: false })
      .limit(limit),
    supabase
      .from("expense_line_items")
      .select("item_name, item_amount, created_at")
      .eq("member_unique_id", memberUniqueId)
      .ilike("item_name", like)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("purchase_items")
      .select("name, total_amount, entry_count")
      .eq("member_unique_id", memberUniqueId)
      .ilike("name", like)
      .order("total_amount", { ascending: false })
      .limit(20),
    supabase
      .from("purchase_places")
      .select("name, total_amount, entry_count")
      .eq("member_unique_id", memberUniqueId)
      .ilike("name", like)
      .order("total_amount", { ascending: false })
      .limit(20),
    supabase
      .from("income_details")
      .select("name, total_amount, entry_count")
      .eq("member_unique_id", memberUniqueId)
      .ilike("name", like)
      .order("total_amount", { ascending: false })
      .limit(20),
    supabase
      .from("income_sources")
      .select("name, total_amount, entry_count")
      .eq("member_unique_id", memberUniqueId)
      .ilike("name", like)
      .order("total_amount", { ascending: false })
      .limit(20),
    supabase
      .from("categories")
      .select("name, kind")
      .eq("member_unique_id", memberUniqueId)
      .ilike("name", like)
      .limit(20),
  ]);

  for (const row of expenses ?? []) {
    hits.push({
      type: "expense",
      date: row.date,
      amount: row.amount,
      description: row.description,
      item_name: row.item_name,
      place: row.place,
    });
  }
  for (const row of incomes ?? []) {
    hits.push({
      type: "income",
      date: row.date,
      amount: row.amount,
      description: row.description,
      income_detail: row.income_detail,
      income_source: row.income_source,
    });
  }
  for (const row of lineItems ?? []) {
    hits.push({
      type: "expense_line_item",
      item_name: row.item_name,
      item_amount: row.item_amount,
    });
  }
  for (const row of items ?? []) {
    hits.push({
      type: "purchase_item",
      name: row.name,
      total_amount: row.total_amount,
      entry_count: row.entry_count,
    });
  }
  for (const row of places ?? []) {
    hits.push({
      type: "purchase_place",
      name: row.name,
      total_amount: row.total_amount,
      entry_count: row.entry_count,
    });
  }
  for (const row of details ?? []) {
    hits.push({
      type: "income_detail",
      name: row.name,
      total_amount: row.total_amount,
      entry_count: row.entry_count,
    });
  }
  for (const row of sources ?? []) {
    hits.push({
      type: "income_source",
      name: row.name,
      total_amount: row.total_amount,
      entry_count: row.entry_count,
    });
  }
  for (const row of categories ?? []) {
    hits.push({
      type: "category",
      name: row.name,
      kind: row.kind,
    });
  }

  return hits.slice(0, limit);
}

export function formatSearchHitsForAi(hits: SearchHit[]): string {
  if (hits.length === 0) return "(no results)";
  return JSON.stringify(hits, null, 2);
}

export function formatSearchHitsForUi(hits: SearchHit[], locale: Locale): string {
  const { search: s, common } = getMessages(locale);
  if (hits.length === 0) return s.noResults;

  const money = (value: number | null | undefined) => formatMoney(value ?? 0, locale);
  const total = (label: string, hit: SearchHit) =>
    `[${label}] ${hit.name} / ${money(hit.total_amount)} (${common.itemCount(hit.entry_count ?? 0)})`;

  return hits
    .map((hit, index) => {
      const n = `${index + 1}.`;
      switch (hit.type) {
        case "expense":
          return `${n} [${s.expense}] ${hit.date ?? "-"} / ${hit.description ?? "-"} / ${money(hit.amount)}` +
            (hit.item_name ? ` / ${s.item}: ${hit.item_name}` : "") +
            (hit.place ? ` / ${s.place}: ${hit.place}` : "");
        case "expense_line_item":
          return `${n} [${s.lineItem}] ${hit.item_name ?? "-"} / ${money(hit.item_amount)}`;
        case "income":
          return `${n} [${s.income}] ${hit.date ?? "-"} / ${hit.description ?? "-"} / ${money(hit.amount)}` +
            (hit.income_detail ? ` / ${s.detail}: ${hit.income_detail}` : "") +
            (hit.income_source ? ` / ${s.source}: ${hit.income_source}` : "");
        case "purchase_item":
          return `${n} ${total(s.itemTotal, hit)}`;
        case "purchase_place":
          return `${n} ${total(s.placeTotal, hit)}`;
        case "income_detail":
          return `${n} ${total(s.incomeDetailTotal, hit)}`;
        case "income_source":
          return `${n} ${total(s.incomeSourceTotal, hit)}`;
        case "category":
          return `${n} [${s.category}] ${hit.kind === "income" ? s.income : s.expense} · ${hit.name}`;
        default:
          return `${n} ${s.result}`;
      }
    })
    .join("\n");
}
