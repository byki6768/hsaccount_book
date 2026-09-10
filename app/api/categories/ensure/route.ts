import { NextResponse } from "next/server";
import { ensureAiCategoryTrees } from "@/lib/aiCategoryService";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { memberUniqueId?: string };
    const memberUniqueId = body.memberUniqueId?.trim();
    if (!memberUniqueId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const supabase = createServerSupabase();
    const result = await ensureAiCategoryTrees(supabase, memberUniqueId);

    return NextResponse.json({
      expenseTree: result.expenseTree,
      incomeTree: result.incomeTree,
      generated: result.generated,
      categoryCount: result.categories.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "카테고리 생성에 실패했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
