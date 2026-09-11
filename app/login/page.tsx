"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { SpeechBubble } from "@/components/SpeechBubble";
import {
  getLoginId,
  isValidCountryCode,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  markRegistered,
  Member,
  normalizeCountryCode,
  normalizePhone,
  setSession,
} from "@/lib/auth";
import { hashPassword, isBcryptHash, verifyPassword } from "@/lib/password";
import { supabase } from "@/lib/supabase/client";

type LoginMode = "select" | "email" | "phone";

const UNKNOWN_ID_MESSAGE =
  "없는 ID입니다, 신규 회원 가입을 하여 주세요";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("select");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+82");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({
    email: false,
    phone: false,
    password: false,
    countryCode: false,
  });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [unknownId, setUnknownId] = useState(false);

  const emailInvalid = touched.email && !isValidEmail(email);
  const countryCodeInvalid =
    touched.countryCode && !isValidCountryCode(countryCode);
  const phoneInvalid = touched.phone && !isValidPhone(phone);
  const passwordInvalid = touched.password && !isValidPassword(password);

  const resetMode = (next: LoginMode) => {
    setMode(next);
    setUnknownId(false);
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setUnknownId(false);

    setTouched({
      email: mode === "email",
      phone: mode === "phone",
      countryCode: mode === "phone",
      password: true,
    });

    if (mode === "email" && !isValidEmail(email)) return;
    if (mode === "phone") {
      if (!isValidCountryCode(countryCode) || !isValidPhone(phone)) return;
    }
    if (!isValidPassword(password)) return;

    setLoading(true);

    let query = supabase.from("members").select("*").eq("is_active", true);

    if (mode === "email") {
      query = query.eq("email", email.trim().toLowerCase());
    } else {
      const code = normalizeCountryCode(countryCode);
      const phoneDigits = normalizePhone(phone);
      query = query
        .eq("auth_type", "phone")
        .eq("country_code", code)
        .eq("phone", phoneDigits);
    }

    const { data, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      setFormError(fetchError.message);
      setLoading(false);
      return;
    }

    const matched = data as Member | null;

    if (!matched) {
      setUnknownId(true);
      setLoading(false);
      return;
    }

    if (!(await verifyPassword(password, matched.password))) {
      setFormError("비밀번호가 올바르지 않습니다");
      setLoading(false);
      return;
    }

    if (matched.password && !isBcryptHash(matched.password)) {
      const hashed = await hashPassword(password);
      await supabase
        .from("members")
        .update({ password: hashed })
        .eq("unique_id", matched.unique_id);
    }

    markRegistered();
    setSession({
      uniqueId: matched.unique_id,
      authType: matched.auth_type,
      loginId: getLoginId(matched),
    });
    setLoading(false);
    router.replace("/home");
  };

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#e8f5f0_0%,_#f7f8fa_45%,_#eef1f5_100%)]">
      <div className="page-main flex min-h-full w-full flex-col py-8 sm:py-10">
        <button
          type="button"
          onClick={() =>
            mode === "select" ? router.push("/") : resetMode("select")
          }
          className="mb-6 self-start text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← {mode === "select" ? "처음으로" : "로그인 방식 선택"}
        </button>

        <h1 className="text-3xl font-semibold text-slate-800">로그인</h1>
        <p className="mt-2 text-base text-slate-500">
          {mode === "select"
            ? "로그인 방식을 선택해 주세요"
            : mode === "email"
              ? "이메일로 로그인합니다"
              : "휴대폰 번호로 로그인합니다"}
        </p>

        {mode === "select" ? (
          <div className="mt-10 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => resetMode("email")}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition hover:bg-emerald-700"
            >
              이메일 로그인
            </button>
            <button
              type="button"
              onClick={() => resetMode("phone")}
              className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-emerald-600 bg-white text-lg font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              휴대폰 번호 로그인
            </button>
            <button
              type="button"
              onClick={() => router.push("/signup")}
              className="mt-2 text-center text-base font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            >
              아직 회원이 아니신가요? 신규 회원
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-7">
            {mode === "email" ? (
              <div className="flex flex-col gap-2.5">
                <label htmlFor="email" className="text-base font-medium text-slate-700">
                  ID (이메일)
                </label>
                {unknownId && <SpeechBubble message={UNKNOWN_ID_MESSAGE} />}
                {emailInvalid && <SpeechBubble message="이메일을 입력하세요" />}
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setUnknownId(false);
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="*****@*********.com"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-lg text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:text-base"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <label htmlFor="phone" className="text-base font-medium text-slate-700">
                  ID (휴대폰 번호)
                </label>
                <div className="flex items-end gap-2">
                  <div className="w-[6.5rem] shrink-0">
                    {countryCodeInvalid && (
                      <SpeechBubble message="국가번호를 입력하세요" />
                    )}
                    <input
                      id="countryCode"
                      type="text"
                      inputMode="tel"
                      value={countryCode}
                      onChange={(e) => {
                        setCountryCode(e.target.value);
                        setUnknownId(false);
                      }}
                      onBlur={() =>
                        setTouched((t) => ({ ...t, countryCode: true }))
                      }
                      aria-label="국가번호"
                      placeholder="+82"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-3 text-center text-lg text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:text-base"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    {unknownId && <SpeechBubble message={UNKNOWN_ID_MESSAGE} />}
                    {phoneInvalid && (
                      <SpeechBubble message="휴대폰 번호를 입력하세요" />
                    )}
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/[^\d-]/g, ""));
                        setUnknownId(false);
                      }}
                      onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                      placeholder="10-1234-5678"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-lg text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:text-base"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <label htmlFor="password" className="text-base font-medium text-slate-700">
                비밀번호
              </label>
              {passwordInvalid && (
                <SpeechBubble message="문자 또는 숫자로만 입력하세요" />
              )}
              <PasswordInput
                id="password"
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  setTouched((t) => ({ ...t, password: true }));
                }}
              />
            </div>

            {formError && <SpeechBubble message={formError} />}

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>
              {unknownId && (
                <button
                  type="button"
                  onClick={() => router.push("/signup")}
                  className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-emerald-600 bg-white text-lg font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  신규 회원 가입
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
