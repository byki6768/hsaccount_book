import { NextResponse } from "next/server";
import {
  getLoginId,
  isValidCountryCode,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  normalizeCountryCode,
  normalizePhone,
} from "@/lib/auth";
import { generateUniqueId, hashPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DUPLICATE_MESSAGE = "이미 등록된 계정입니다. 로그인해 주세요.";

type SignupBody = {
  mode?: "email" | "phone";
  email?: string;
  countryCode?: string;
  phone?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupBody;
    const password = body.password ?? "";

    if (!isValidPassword(password)) {
      return NextResponse.json({ error: "비밀번호 형식이 올바르지 않습니다" }, { status: 400 });
    }
    if (body.mode !== "email" && body.mode !== "phone") {
      return NextResponse.json({ error: "가입 방식을 선택하세요" }, { status: 400 });
    }

    const email = (body.email ?? "").trim().toLowerCase();
    const countryCode = normalizeCountryCode(body.countryCode ?? "") || "82";
    const phone = normalizePhone(body.phone ?? "");

    if (body.mode === "email" && !isValidEmail(email)) {
      return NextResponse.json({ error: "이메일을 입력하세요" }, { status: 400 });
    }
    if (body.mode === "phone" && (!isValidCountryCode(countryCode) || !isValidPhone(phone))) {
      return NextResponse.json({ error: "휴대폰 번호를 입력하세요" }, { status: 400 });
    }

    const supabase = createServerSupabase();

    let uniqueId = generateUniqueId();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: existing } = await supabase
        .from("members")
        .select("id")
        .eq("unique_id", uniqueId)
        .maybeSingle();
      if (!existing) break;
      uniqueId = generateUniqueId();
    }

    if (body.mode === "phone") {
      const { data: dup } = await supabase
        .from("members")
        .select("id")
        .eq("auth_type", "phone")
        .eq("country_code", countryCode)
        .eq("phone", phone)
        .eq("is_active", true)
        .maybeSingle();
      if (dup) {
        return NextResponse.json({ error: DUPLICATE_MESSAGE }, { status: 409 });
      }
    }

    const { data, error } = await supabase
      .from("members")
      .insert({
        unique_id: uniqueId,
        auth_type: body.mode,
        email: body.mode === "email" ? email : null,
        country_code: body.mode === "phone" ? countryCode : null,
        phone: body.mode === "phone" ? phone : null,
        password: await hashPassword(password),
        is_active: true,
      })
      .select("unique_id, auth_type, email, country_code, phone")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: DUPLICATE_MESSAGE }, { status: 409 });
      }
      throw new Error(error.message);
    }

    const user = { authType: data.auth_type, loginId: getLoginId(data) };
    await setSessionCookie({ ...user, uniqueId: data.unique_id });
    return NextResponse.json(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "가입에 실패했습니다";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
