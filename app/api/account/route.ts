import { NextResponse } from "next/server";
import { getLoginId, isValidPassword } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { clearSessionCookie, getSessionMember } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UNAUTHORIZED = { error: "로그인이 필요합니다" };

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

  return NextResponse.json({
    authType: data.auth_type,
    loginId: getLoginId(data),
  });
}

export async function PATCH(request: Request) {
  const session = await getSessionMember();
  if (!session) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const body = (await request.json()) as { password?: string };
  const password = body.password ?? "";
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "문자 또는 숫자로만 입력하세요" }, { status: 400 });
  }

  const { error } = await createServerSupabase()
    .from("members")
    .update({ password: await hashPassword(password) })
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
