import { NextResponse } from "next/server";
import { getLoginId, isValidPassword, type SessionInfo } from "@/lib/auth";
import { isLocale } from "@/lib/i18n/locales";
import { hashPassword } from "@/lib/password";
import { clearSessionCookie, getSessionMember } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UNAUTHORIZED = { error: "Login required" };

export async function GET() {
  const session = await getSessionMember();
  if (!session) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { data, error } = await createServerSupabase()
    .from("members")
    .select("auth_type, email, country_code, phone")
    .eq("unique_id", session.uniqueId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const info: SessionInfo = {
    authType: data.auth_type,
    loginId: getLoginId(data),
    language: session.language,
  };
  return NextResponse.json(info);
}

/** Updates the password and/or the saved UI language. */
export async function PATCH(request: Request) {
  const session = await getSessionMember();
  if (!session) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const body = (await request.json()) as { password?: string; language?: string };
  const updates: Record<string, string> = {};

  if (body.password !== undefined) {
    if (!isValidPassword(body.password)) {
      return NextResponse.json({ code: "invalid_password" }, { status: 400 });
    }
    updates.password = await hashPassword(body.password);
  }
  if (body.language !== undefined) {
    if (!isLocale(body.language)) {
      return NextResponse.json({ code: "invalid_language" }, { status: 400 });
    }
    updates.language = body.language;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ code: "nothing_to_update" }, { status: 400 });
  }

  const { error } = await createServerSupabase()
    .from("members")
    .update(updates)
    .eq("unique_id", session.uniqueId)
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSessionMember();
  if (!session) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { error } = await createServerSupabase()
    .from("members")
    .update({
      email: null,
      phone: null,
      country_code: null,
      password: null,
      is_active: false,
      withdrawn_at: new Date().toISOString(),
    })
    .eq("unique_id", session.uniqueId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
