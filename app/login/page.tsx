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
import {
  clearExplicitLocaleChoice,
  hasExplicitLocaleChoice,
} from "@/lib/i18n/localeStore";
import { isLocale } from "@/lib/i18n/locales";
import { useI18n } from "@/lib/i18n/useI18n";

type LoginMode = "select" | "email" | "phone";

export default function LoginPage() {
  const router = useRouter();
  const { m, locale, setLocale } = useI18n();
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
    const language = hasExplicitLocaleChoice() ? locale : undefined;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "email"
            ? { mode, email, password, language }
            : { mode, countryCode, phone, password, language },
        ),
      });
      const data = await res.json();

      if (res.status === 404 && data.code === "unknown_id") {
        setUnknownId(true);
        return;
      }
      if (!res.ok) {
        setFormError(data.code === "wrong_password" ? m.login.wrongPassword : m.login.failed);
        return;
      }

      const info = data as SessionInfo;
      setSession({ authType: info.authType, loginId: info.loginId });
      if (isLocale(info.language)) setLocale(info.language);
      clearExplicitLocaleChoice();
      router.replace("/home");
    } catch {
      setFormError(m.login.failed);
    } finally {
      setLoading(false);
    }
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
          ← {mode === "select" ? m.auth.backToStart : m.login.backToMethods}
        </button>

        <h1 className="text-3xl font-semibold text-slate-800">{m.login.title}</h1>
        <p className="mt-2 text-base text-slate-500">
          {mode === "select"
            ? m.login.chooseMethod
            : mode === "email"
              ? m.login.withEmail
              : m.login.withPhone}
        </p>

        {mode === "select" ? (
          <div className="mt-10 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => resetMode("email")}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition hover:bg-emerald-700"
            >
              {m.login.emailButton}
            </button>
            <button
              type="button"
              onClick={() => resetMode("phone")}
              className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-emerald-600 bg-white text-lg font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              {m.login.phoneButton}
            </button>
            <button
              type="button"
              onClick={() => router.push("/signup")}
              className="mt-2 text-center text-base font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            >
              {m.login.notMember}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-7">
            {mode === "email" ? (
              <div className="flex flex-col gap-2.5">
                <label htmlFor="email" className="text-base font-medium text-slate-700">
                  {m.auth.idEmail}
                </label>
                {unknownId && <SpeechBubble message={m.login.unknownId} />}
                {emailInvalid && <SpeechBubble message={m.auth.enterEmail} />}
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
                      onChange={(e) => {
                        setCountryCode(e.target.value);
                        setUnknownId(false);
                      }}
                      onBlur={() =>
                        setTouched((t) => ({ ...t, countryCode: true }))
                      }
                      aria-label={m.auth.countryCode}
                      placeholder="+82"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-3 text-center text-lg text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:text-base"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    {unknownId && <SpeechBubble message={m.login.unknownId} />}
                    {phoneInvalid && (
                      <SpeechBubble message={m.auth.enterPhone} />
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

            {formError && <SpeechBubble message={formError} />}

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? m.login.submitting : m.login.title}
              </button>
              {unknownId && (
                <button
                  type="button"
                  onClick={() => router.push("/signup")}
                  className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-emerald-600 bg-white text-lg font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  {m.login.signupButton}
                </button>
              )}
            </div>
          </form>
        )}

        <div className="mt-auto w-full pt-10">
          <LanguageSwitcher variant="buttons" />
        </div>
      </div>
    </div>
  );
}
