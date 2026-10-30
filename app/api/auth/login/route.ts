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
  type SessionInfo,
} from "@/lib/auth";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
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
  /** Sent only when the user picked a language on a pre-login screen. */
  language?: string;
};

function invalid(code: string) {
  return NextResponse.json({ code, error: `Invalid input: ${code}` }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const password = body.password ?? "";

    if (!isValidPassword(password)) return invalid("invalid_password");

    const supabase = createServerSupabase();
    let query = supabase.from("members").select("*").eq("is_active", true);

    if (body.mode === "email") {
      const email = (body.email ?? "").trim().toLowerCase();
      if (!isValidEmail(email)) return invalid("invalid_email");
      query = query.eq("email", email);
    } else if (body.mode === "phone") {
      const countryCode = body.countryCode ?? "";
      const phone = body.phone ?? "";
      if (!isValidCountryCode(countryCode) || !isValidPhone(phone)) {
        return invalid("invalid_phone");
      }
      query = query
        .eq("auth_type", "phone")
        .eq("country_code", normalizeCountryCode(countryCode))
        .eq("phone", normalizePhone(phone));
    } else {
      return invalid("invalid_mode");
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);

    const member = data as Member | null;
    if (!member) {
      return NextResponse.json({ code: "unknown_id" }, { status: 404 });
    }

    if (!(await verifyPassword(password, member.password))) {
      return NextResponse.json({ code: "wrong_password" }, { status: 401 });
    }

    const updates: Record<string, string> = {};
    if (member.password && !isBcryptHash(member.password)) {
      updates.password = await hashPassword(password);
    }

    const chosen = isLocale(body.language) ? body.language : null;
    if (chosen && chosen !== member.language) updates.language = chosen;
    const language = chosen ?? (isLocale(member.language) ? member.language : DEFAULT_LOCALE);

    if (Object.keys(updates).length > 0) {
      await supabase.from("members").update(updates).eq("unique_id", member.unique_id);
    }

    const info: SessionInfo = {
      authType: member.auth_type,
      loginId: getLoginId(member),
      language,
    };
    await setSessionCookie({
      uniqueId: member.unique_id,
      authType: info.authType,
      loginId: info.loginId,
    });
    return NextResponse.json(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ code: "server_error", error: message }, { status: 500 });
  }
}
