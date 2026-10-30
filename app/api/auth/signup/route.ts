import { NextResponse } from "next/server";
import {
  getLoginId,
  isValidCountryCode,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  normalizeCountryCode,
  normalizePhone,
  type SessionInfo,
} from "@/lib/auth";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { generateUniqueId, hashPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SignupBody = {
  mode?: "email" | "phone";
  email?: string;
  countryCode?: string;
  phone?: string;
  password?: string;
  language?: string;
};

function invalid(code: string) {
  return NextResponse.json({ code, error: `Invalid input: ${code}` }, { status: 400 });
}

function duplicate() {
  return NextResponse.json({ code: "duplicate" }, { status: 409 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupBody;
    const password = body.password ?? "";
    const language = isLocale(body.language) ? body.language : DEFAULT_LOCALE;

    if (!isValidPassword(password)) return invalid("invalid_password");
    if (body.mode !== "email" && body.mode !== "phone") return invalid("invalid_mode");

    const email = (body.email ?? "").trim().toLowerCase();
    const countryCode = normalizeCountryCode(body.countryCode ?? "") || "82";
    const phone = normalizePhone(body.phone ?? "");

    if (body.mode === "email" && !isValidEmail(email)) return invalid("invalid_email");
    if (body.mode === "phone" && (!isValidCountryCode(countryCode) || !isValidPhone(phone))) {
      return invalid("invalid_phone");
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
      if (dup) return duplicate();
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
        language,
      })
      .select("unique_id, auth_type, email, country_code, phone")
      .single();

    if (error) {
      if (error.code === "23505") return duplicate();
      throw new Error(error.message);
    }

    const info: SessionInfo = {
      authType: data.auth_type,
      loginId: getLoginId(data),
      language,
    };
    await setSessionCookie({
      uniqueId: data.unique_id,
      authType: info.authType,
      loginId: info.loginId,
    });
    return NextResponse.json(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-up failed";
    return NextResponse.json({ code: "server_error", error: message }, { status: 500 });
  }
}
