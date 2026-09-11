import { NextResponse } from "next/server";
import {
  formatSearchHitsForUi,
  searchMemberLedger,
} from "@/lib/ledgerSearch";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      query?: string;
      memberUniqueId?: string;
    };
    const query = body.query?.trim() ?? "";
    const memberUniqueId = body.memberUniqueId?.trim() ?? "";

    if (!memberUniqueId) {
      return NextResponse.json(
        { error: "로그인이 필요합니다" },
        { status: 401 },
      );
    }
    if (!query) {
      return NextResponse.json(
        { error: "검색어를 입력하세요", hits: [], text: "검색어를 입력해 주세요." },
        { status: 400 },
      );
    }

    const supabase = createServerSupabase();
    const hits = await searchMemberLedger(supabase, memberUniqueId, query);

    return NextResponse.json({
      query,
      hits,
      text: formatSearchHitsForUi(hits),
      count: hits.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "검색 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
