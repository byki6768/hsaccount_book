import { NextResponse } from "next/server";
import {
  getLoginId,
  isValidCountryCode,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  normalizeCountryCode,
  normalizePhone,
  type Member,
} from "@/lib/auth";
import { hashPassword, isBcryptHash, verifyPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type LoginBody = {
  mode?: "email" | "phone";
  email?: string;
  countryCode?: string;
  phone?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const password = body.password ?? "";

    if (!isValidPassword(password)) {
      return NextResponse.json({ error: "비밀번호 형식이 올바르지 않습니다" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    let query = supabase.from("members").select("*").eq("is_active", true);

    if (body.mode === "email") {
      const email = (body.email ?? "").trim().toLowerCase();
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "이메일을 입력하세요" }, { status: 400 });
      }
      query = query.eq("email", email);
    } else if (body.mode === "phone") {
      const countryCode = body.countryCode ?? "";
      const phone = body.phone ?? "";
      if (!isValidCountryCode(countryCode) || !isValidPhone(phone)) {
        return NextResponse.json({ error: "휴대폰 번호를 입력하세요" }, { status: 400 });
      }
      query = query
        .eq("auth_type", "phone")
        .eq("country_code", normalizeCountryCode(countryCode))
        .eq("phone", normalizePhone(phone));
    } else {
      return NextResponse.json({ error: "로그인 방식을 선택하세요" }, { status: 400 });
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);

    const member = data as Member | null;
    if (!member) {
      return NextResponse.json({ code: "unknown_id" }, { status: 404 });
    }

    if (!(await verifyPassword(password, member.password))) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다" }, { status: 401 });
    }

    if (member.password && !isBcryptHash(member.password)) {
      await supabase
        .from("members")
        .update({ password: await hashPassword(password) })
        .eq("unique_id", member.unique_id);
    }

    const user = { authType: member.auth_type, loginId: getLoginId(member) };
    await setSessionCookie({ ...user, uniqueId: member.unique_id });
    return NextResponse.json(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "로그인에 실패했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
