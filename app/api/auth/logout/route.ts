import { NextResponse } from "next/server";
import { clearSessionCookie, readSessionCookie } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await readSessionCookie();
    if (session) {
      await createServerSupabase()
        .from("members")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("unique_id", session.uniqueId);
    }
  } finally {
    await clearSessionCookie();
  }
  return NextResponse.json({ ok: true });
}
