import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily Vercel cron hits this so the free-tier Supabase project never auto-pauses. */
export async function GET() {
  const { error } = await createServerSupabase()
    .from("members")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (error) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
