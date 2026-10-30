"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SpeechBubble } from "@/components/SpeechBubble";
import {
  isValidCountryCode,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  setSession,
  type SessionInfo,
} from "@/lib/auth";
import { clearExplicitLocaleChoice } from "@/lib/i18n/localeStore";
import { useI18n } from "@/lib/i18n/useI18n";

type SignupMode = "select" | "email" | "phone";

export default function SignupPage() {
  const router = useRouter();
  const { m, locale } = useI18n();
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

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "email"
            ? { mode, email, password, language: locale }
            : { mode, countryCode, phone, password, language: locale },
        ),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.code === "duplicate" ? m.signup.duplicate : m.signup.failed);
        return;
      }

      const info = data as SessionInfo;
      setSession({ authType: info.authType, loginId: info.loginId });
      clearExplicitLocaleChoice();
      router.replace("/home");
    } catch {
      setFormError(m.signup.failed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#e8f5f0_0%,_#f7f8fa_45%,_#eef1f5_100%)]">
      <div className="page-main flex min-h-full w-full flex-col py-8 sm:py-10">
        <button
          type="button"
          onClick={() => (mode === "select" ? router.push("/") : setMode("select"))}
          className="mb-6 self-start text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← {mode === "select" ? m.auth.backToStart : m.signup.backToMethods}
        </button>

        <h1 className="text-3xl font-semibold text-slate-800">{m.signup.title}</h1>
        <p className="mt-2 text-base text-slate-500">
          {mode === "select"
            ? m.signup.chooseMethod
            : mode === "email"
              ? m.signup.withEmail
              : m.signup.withPhone}
        </p>

        {mode === "select" ? (
          <div className="mt-10 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setMode("email")}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition hover:bg-emerald-700"
            >
              {m.signup.emailButton}
            </button>
            <button
              type="button"
              onClick={() => setMode("phone")}
              className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-emerald-600 bg-white text-lg font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              {m.signup.phoneButton}
            </button>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="mt-2 text-center text-base font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            >
              {m.signup.alreadyMember}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-7">
            {mode === "email" ? (
              <div className="flex flex-col gap-2.5">
                <label htmlFor="email" className="text-base font-medium text-slate-700">
                  {m.auth.idEmail}
                </label>
                {emailInvalid && <SpeechBubble message={m.auth.enterEmail} />}
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
                  {m.auth.idPhone}
                </label>
                <div className="flex items-end gap-2">
                  <div className="w-[6.5rem] shrink-0">
                    {countryCodeInvalid && (
                      <SpeechBubble message={m.auth.enterCountryCode} />
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
                      aria-label={m.auth.countryCode}
                      placeholder="+82"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-3 text-center text-lg text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:text-base"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    {phoneInvalid && (
                      <SpeechBubble message={m.auth.enterPhone} />
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
                {m.auth.password}
              </label>
              {passwordInvalid && (
                <SpeechBubble message={m.auth.passwordRule} />
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
                {m.auth.passwordConfirm}
              </label>
              {passwordMismatch && (
                <SpeechBubble message={m.auth.passwordMismatch} />
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
              {submitting ? m.signup.submitting : m.signup.submit}
            </button>
          </form>
        )}

        <div className="mt-auto w-full pt-10">
          <LanguageSwitcher variant="buttons" />
        </div>
      </div>
    </div>
  );
}
