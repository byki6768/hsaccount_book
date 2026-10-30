import { NextResponse } from "next/server";
import { ensureAiCategoryTrees } from "@/lib/aiCategoryService";
import { getSessionMember } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await getSessionMember();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const supabase = createServerSupabase();
    const result = await ensureAiCategoryTrees(supabase, session.uniqueId, session.language);

    return NextResponse.json({
      expenseTree: result.expenseTree,
      incomeTree: result.incomeTree,
      generated: result.generated,
      categoryCount: result.categories.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Category generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
