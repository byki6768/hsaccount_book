import type { SupabaseClient } from "@supabase/supabase-js";

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
 * 회원 식별자·고유 ID를 제외한 가계부 데이터 검색
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
  if (hits.length === 0) return "(검색 결과 없음)";
  return JSON.stringify(hits, null, 2);
}

export function formatSearchHitsForUi(hits: SearchHit[]): string {
  if (hits.length === 0) return "검색 결과가 없습니다.";

  return hits
    .map((hit, index) => {
      const n = index + 1;
      switch (hit.type) {
        case "expense":
          return `${n}. [지출] ${hit.date ?? "-"} / ${hit.description ?? "-"} / ${(hit.amount ?? 0).toLocaleString("ko-KR")}원` +
            (hit.item_name ? ` / 품목:${hit.item_name}` : "") +
            (hit.place ? ` / 장소:${hit.place}` : "");
        case "expense_line_item":
          return `${n}. [개별품목] ${hit.item_name ?? "-"} / ${(hit.item_amount ?? 0).toLocaleString("ko-KR")}원`;
        case "income":
          return `${n}. [수입] ${hit.date ?? "-"} / ${hit.description ?? "-"} / ${(hit.amount ?? 0).toLocaleString("ko-KR")}원` +
            (hit.income_detail ? ` / 내역:${hit.income_detail}` : "") +
            (hit.income_source ? ` / 수입처:${hit.income_source}` : "");
        case "purchase_item":
          return `${n}. [구매품목 합계] ${hit.name} / ${(hit.total_amount ?? 0).toLocaleString("ko-KR")}원 (${hit.entry_count ?? 0}건)`;
        case "purchase_place":
          return `${n}. [구매장소 합계] ${hit.name} / ${(hit.total_amount ?? 0).toLocaleString("ko-KR")}원 (${hit.entry_count ?? 0}건)`;
        case "income_detail":
          return `${n}. [수입내역 합계] ${hit.name} / ${(hit.total_amount ?? 0).toLocaleString("ko-KR")}원 (${hit.entry_count ?? 0}건)`;
        case "income_source":
          return `${n}. [수입처 합계] ${hit.name} / ${(hit.total_amount ?? 0).toLocaleString("ko-KR")}원 (${hit.entry_count ?? 0}건)`;
        case "category":
          return `${n}. [분류] ${hit.kind === "income" ? "수입" : "지출"} · ${hit.name}`;
        default:
          return `${n}. 결과`;
      }
    })
    .join("\n");
}
