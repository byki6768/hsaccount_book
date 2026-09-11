import type { SupabaseClient } from "@supabase/supabase-js";

export type ExpenseLabelFields = {
  item_name: string | null;
  place: string | null;
};

export type IncomeLabelFields = {
  income_detail: string | null;
  income_source: string | null;
};

function normalizeLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

/**
 * 동일 이름이면 total_amount / entry_count 를 누적(추가)
 */
async function upsertNamedTotal(
  supabase: SupabaseClient,
  table:
    | "purchase_items"
    | "purchase_places"
    | "income_details"
    | "income_sources",
  memberUniqueId: string,
  name: string,
  amount: number,
) {
  const { data: existing, error: findError } = await supabase
    .from(table)
    .select("id, total_amount, entry_count")
    .eq("member_unique_id", memberUniqueId)
    .eq("name", name)
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  if (existing) {
    const { error } = await supabase
      .from(table)
      .update({
        total_amount: (existing.total_amount ?? 0) + amount,
        entry_count: (existing.entry_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from(table).insert({
    member_unique_id: memberUniqueId,
    name,
    total_amount: amount,
    entry_count: 1,
  });
  if (error) throw new Error(error.message);
}

export async function recordExpenseLabels(
  supabase: SupabaseClient,
  memberUniqueId: string,
  amount: number,
  fields: { itemName?: string | null; place?: string | null },
): Promise<ExpenseLabelFields> {
  const item_name = normalizeLabel(fields.itemName);
  const place = normalizeLabel(fields.place);

  if (item_name) {
    await upsertNamedTotal(
      supabase,
      "purchase_items",
      memberUniqueId,
      item_name,
      amount,
    );
  }
  if (place) {
    await upsertNamedTotal(
      supabase,
      "purchase_places",
      memberUniqueId,
      place,
      amount,
    );
  }

  return { item_name, place };
}

export async function recordIncomeLabels(
  supabase: SupabaseClient,
  memberUniqueId: string,
  amount: number,
  fields: { incomeDetail?: string | null; incomeSource?: string | null },
): Promise<IncomeLabelFields> {
  const income_detail = normalizeLabel(fields.incomeDetail);
  const income_source = normalizeLabel(fields.incomeSource);

  if (income_detail) {
    await upsertNamedTotal(
      supabase,
      "income_details",
      memberUniqueId,
      income_detail,
      amount,
    );
  }
  if (income_source) {
    await upsertNamedTotal(
      supabase,
      "income_sources",
      memberUniqueId,
      income_source,
      amount,
    );
  }

  return { income_detail, income_source };
}

export async function saveExpenseLineItems(
  supabase: SupabaseClient,
  params: {
    expenseId: number;
    memberUniqueId: string;
    lines: Array<{ name: string; amount: number | null }>;
  },
) {
  const rows = params.lines
    .map((line, index) => {
      const name = normalizeLabel(line.name);
      if (!name) return null;
      return {
        expense_id: params.expenseId,
        member_unique_id: params.memberUniqueId,
        item_name: name,
        item_amount: line.amount && line.amount > 0 ? Math.round(line.amount) : 0,
        sort_order: index + 1,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (rows.length === 0) return;

  const { error } = await supabase.from("expense_line_items").insert(rows);
  if (error) throw new Error(error.message);

  // 개별 품목별로 구매품목 합계 누적
  for (const row of rows) {
    await upsertNamedTotal(
      supabase,
      "purchase_items",
      params.memberUniqueId,
      row.item_name,
      row.item_amount > 0 ? row.item_amount : 0,
    );
  }
}
