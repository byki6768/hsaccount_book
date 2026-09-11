"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { SpeechBubble } from "@/components/SpeechBubble";
import {
  generateUniqueId,
  getLoginId,
  isValidCountryCode,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  markRegistered,
  normalizeCountryCode,
  normalizePhone,
  setSession,
} from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { supabase } from "@/lib/supabase/client";

type SignupMode = "select" | "email" | "phone";

export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<SignupMode>("select");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+82");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [touched, setTouched] = useState({
    email: false,
    phone: false,
    password: false,
    passwordConfirm: false,
    countryCode: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailInvalid = touched.email && !isValidEmail(email);
  const countryCodeInvalid =
    touched.countryCode && !isValidCountryCode(countryCode);
  const phoneInvalid = touched.phone && !isValidPhone(phone);
  const passwordInvalid = touched.password && !isValidPassword(password);
  const passwordMismatch =
    touched.passwordConfirm && passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    setTouched({
      email: mode === "email",
      phone: mode === "phone",
      countryCode: mode === "phone",
      password: true,
      passwordConfirm: true,
    });

    if (mode === "email" && !isValidEmail(email)) return;
    if (mode === "phone") {
      if (!isValidCountryCode(countryCode) || !isValidPhone(phone)) return;
    }
    if (!isValidPassword(password)) return;
    if (password !== passwordConfirm) return;

    setSubmitting(true);

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

    const hashedPassword = await hashPassword(password);
    const normalizedCode = normalizeCountryCode(countryCode) || "82";
    const phoneDigits = normalizePhone(phone);

    if (mode === "phone") {
      const { data: dup } = await supabase
        .from("members")
        .select("id")
        .eq("auth_type", "phone")
        .eq("country_code", normalizedCode)
        .eq("phone", phoneDigits)
        .eq("is_active", true)
        .maybeSingle();
      if (dup) {
        setFormError("이미 등록된 계정입니다. 로그인해 주세요.");
        setSubmitting(false);
        return;
      }
    }

    const payload =
      mode === "email"
        ? {
            unique_id: uniqueId,
            auth_type: "email",
            email: email.trim().toLowerCase(),
            country_code: null as string | null,
            phone: null as string | null,
            password: hashedPassword,
            is_active: true,
          }
        : {
            unique_id: uniqueId,
            auth_type: "phone",
            email: null as string | null,
            country_code: normalizedCode,
            phone: phoneDigits,
            password: hashedPassword,
            is_active: true,
          };

    const { data, error } = await supabase
      .from("members")
      .insert(payload as Record<string, unknown>)
      .select("unique_id, auth_type, email, country_code, phone")
      .single();

    if (error) {
      setFormError(
        error.code === "23505"
          ? "이미 등록된 계정입니다. 로그인해 주세요."
          : error.message,
      );
      setSubmitting(false);
      return;
    }

    markRegistered();
    setSession({
      uniqueId: data.unique_id,
      authType: data.auth_type,
      loginId: getLoginId(data),
    });
    setSubmitting(false);
    router.replace("/home");
  };

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#e8f5f0_0%,_#f7f8fa_45%,_#eef1f5_100%)]">
      <div className="page-main flex min-h-full w-full flex-col py-8 sm:py-10">
        <button
          type="button"
          onClick={() => (mode === "select" ? router.push("/") : setMode("select"))}
          className="mb-6 self-start text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← {mode === "select" ? "처음으로" : "가입 방식 선택"}
        </button>

        <h1 className="text-3xl font-semibold text-slate-800">신규 회원 가입</h1>
        <p className="mt-2 text-base text-slate-500">
          {mode === "select"
            ? "가입 방식을 선택해 주세요"
            : mode === "email"
              ? "이메일로 가입합니다"
              : "휴대폰 번호로 가입합니다"}
        </p>

        {mode === "select" ? (
          <div className="mt-10 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setMode("email")}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition hover:bg-emerald-700"
            >
              이메일 가입
            </button>
            <button
              type="button"
              onClick={() => setMode("phone")}
              className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-emerald-600 bg-white text-lg font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              휴대폰 번호 가입
            </button>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="mt-2 text-center text-base font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            >
              이미 회원이신가요? 로그인
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-7">
            {mode === "email" ? (
              <div className="flex flex-col gap-2.5">
                <label htmlFor="email" className="text-base font-medium text-slate-700">
                  ID (이메일)
                </label>
                {emailInvalid && <SpeechBubble message="이메일을 입력하세요" />}
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                      onChange={(e) => setCountryCode(e.target.value)}
                      onBlur={() =>
                        setTouched((t) => ({ ...t, countryCode: true }))
                      }
                      aria-label="국가번호"
                      placeholder="+82"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-3 text-center text-lg text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:text-base"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    {phoneInvalid && (
                      <SpeechBubble message="휴대폰 번호를 입력하세요" />
                    )}
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/[^\d-]/g, ""))
                      }
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

            <div className="flex flex-col gap-2.5">
              <label
                htmlFor="passwordConfirm"
                className="text-base font-medium text-slate-700"
              >
                비밀번호 확인
              </label>
              {passwordMismatch && (
                <SpeechBubble message="비밀번호가 일치하지 않습니다" />
              )}
              <PasswordInput
                id="passwordConfirm"
                value={passwordConfirm}
                onChange={(value) => {
                  setPasswordConfirm(value);
                  setTouched((t) => ({ ...t, passwordConfirm: true }));
                }}
              />
            </div>

            {formError && <SpeechBubble message={formError} />}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? "가입 중..." : "가입 완료"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
