import { NextResponse } from "next/server";
import {
  formatSearchHitsForUi,
  searchMemberLedger,
} from "@/lib/ledgerSearch";
import { getSessionMember } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getSessionMember();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim() ?? "";
    if (!query) {
      return NextResponse.json(
        { error: "Query is required", hits: [], text: "" },
        { status: 400 },
      );
    }

    const supabase = createServerSupabase();
    const hits = await searchMemberLedger(supabase, session.uniqueId, query);

    return NextResponse.json({
      query,
      hits,
      text: formatSearchHitsForUi(hits, session.language),
      count: hits.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
