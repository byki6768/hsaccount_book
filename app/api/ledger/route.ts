import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Part = "expenses" | "incomes" | "categories";
const PARTS: Part[] = ["expenses", "incomes", "categories"];

/** GET /api/ledger?include=expenses,incomes,categories */
export async function GET(request: Request) {
  const session = await getSessionMember();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const requested = new URL(request.url).searchParams.get("include");
  const include = new Set<Part>(
    requested
      ? (requested.split(",").filter((p) => PARTS.includes(p as Part)) as Part[])
      : PARTS,
  );

  const supabase = createServerSupabase();
  const uid = session.uniqueId;

  const [expenses, incomes, categories] = await Promise.all([
    include.has("expenses")
      ? supabase
          .from("expenses")
          .select("id, date, amount, description, category_id, created_at")
          .eq("member_unique_id", uid)
          .order("created_at", { ascending: false })
      : null,
    include.has("incomes")
      ? supabase
          .from("incomes")
          .select("id, date, amount, description, category_id, created_at")
          .eq("member_unique_id", uid)
          .order("created_at", { ascending: false })
      : null,
    include.has("categories")
      ? supabase
          .from("categories")
          .select("*")
          .eq("member_unique_id", uid)
          .order("sort_order", { ascending: true })
      : null,
  ]);

  const failed = [expenses, incomes, categories].find((r) => r?.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ...(expenses ? { expenses: expenses.data ?? [] } : {}),
    ...(incomes ? { incomes: incomes.data ?? [] } : {}),
    ...(categories ? { categories: categories.data ?? [] } : {}),
  });
}
