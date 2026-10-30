"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { PasswordInput } from "@/components/PasswordInput";
import { SpeechBubble } from "@/components/SpeechBubble";
import {
  clearSession,
  isValidPassword,
  setSession,
  type SessionInfo,
} from "@/lib/auth";
import { useI18n } from "@/lib/i18n/useI18n";

type Profile = SessionInfo;

export default function MyPage() {
  return (
    <AuthGuard>
      <MyPageContent />
    </AuthGuard>
  );
}

function MyPageContent() {
  const router = useRouter();
  const { m } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withdrawStep, setWithdrawStep] = useState<"idle" | "confirm">("idle");
  const [saving, setSaving] = useState(false);

  const passwordInvalid = touched.password && !isValidPassword(newPassword);
  const passwordMismatch =
    touched.confirm && confirmPassword.length > 0 && newPassword !== confirmPassword;

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/account", { cache: "no-store" });
      const data = await res.json();

      if (res.status === 401) {
        clearSession();
        router.replace("/");
        return;
      }
      if (!res.ok) {
        setError(m.mypage.loadFailed);
        return;
      }

      const nextProfile = data as Profile;
      setProfile(nextProfile);
      setSession({ authType: nextProfile.authType, loginId: nextProfile.loginId });
    } catch {
      setError(m.mypage.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [router, m]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    setError(null);
    setMessage(null);

    if (!isValidPassword(newPassword) || newPassword !== confirmPassword) {
      return;
    }

    setSaving(true);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    }).catch(() => null);

    if (!res?.ok) {
      const data = res ? await res.json().catch(() => ({})) : {};
      setError(data.code === "invalid_password" ? m.auth.passwordRule : m.mypage.updateFailed);
      setSaving(false);
      return;
    }

    setEditing(false);
    setNewPassword("");
    setConfirmPassword("");
    setTouched({ password: false, confirm: false });
    setMessage(m.mypage.updated);
    setSaving(false);
  };

  const handleWithdraw = async () => {
    if (withdrawStep === "idle") {
      setWithdrawStep("confirm");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/account", { method: "DELETE" }).catch(() => null);

    if (!res?.ok) {
      setError(m.mypage.withdrawFailed);
      setSaving(false);
      return;
    }

    clearSession();
    setMessage(m.mypage.withdrawDone);
    setSaving(false);

    window.setTimeout(() => {
      router.replace("/");
    }, 1200);
  };

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#e8f5f0_0%,_#f7f8fa_45%,_#eef1f5_100%)]">
      <AppHeader loggedIn />
      <div className="page-main flex min-h-[calc(100dvh-5.5rem)] flex-col py-6 sm:py-8">
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">{m.mypage.title}</h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">{m.mypage.subtitle}</p>

        {loading ? (
          <p className="mt-10 text-center text-slate-400">{m.common.loading}</p>
        ) : profile ? (
          <>
            <div className="mt-8 flex-1 space-y-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">ID</p>
                <p className="mt-1 break-all text-lg font-semibold text-slate-800">
                  {profile.loginId}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500">{m.auth.password}</p>
                    <p className="mt-1 text-lg font-semibold tracking-widest text-slate-800">
                      ******
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing((v) => !v);
                      setMessage(null);
                      setError(null);
                    }}
                    className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {m.common.edit}
                  </button>
                </div>

                {editing && (
                  <form
                    onSubmit={handleUpdatePassword}
                    className="mt-5 space-y-5 border-t border-slate-100 pt-5"
                  >
                    <div>
                      <label
                        htmlFor="newPassword"
                        className="mb-2 block text-base font-medium text-slate-700"
                      >
                        {m.mypage.newPassword}
                      </label>
                      {passwordInvalid && (
                        <SpeechBubble message={m.auth.passwordRule} />
                      )}
                      <PasswordInput
                        id="newPassword"
                        value={newPassword}
                        onChange={(value) => {
                          setNewPassword(value);
                          setTouched((t) => ({ ...t, password: true }));
                        }}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="mb-2 block text-base font-medium text-slate-700"
                      >
                        {m.auth.passwordConfirm}
                      </label>
                      {passwordMismatch && (
                        <SpeechBubble message={m.auth.passwordMismatch} />
                      )}
                      <PasswordInput
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(value) => {
                          setConfirmPassword(value);
                          setTouched((t) => ({ ...t, confirm: true }));
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {saving ? m.mypage.updating : m.mypage.updateSubmit}
                    </button>
                  </form>
                )}
              </div>

              {message && (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-700">
                  {message}
                </div>
              )}
              {error && <SpeechBubble message={error} />}
            </div>

            <div className="mt-10 flex flex-col items-end gap-2">
              {withdrawStep === "confirm" && (
                <SpeechBubble message={m.mypage.withdrawWarning} />
              )}
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={saving}
                className={`min-w-[14rem] rounded-xl px-10 py-2.5 text-sm font-semibold transition disabled:opacity-60 sm:min-w-[16rem] ${
                  withdrawStep === "confirm"
                    ? "bg-rose-500 text-white hover:bg-rose-600"
                    : "bg-[#f7e9a8] text-slate-800 hover:bg-[#f3e08f]"
                }`}
              >
                {withdrawStep === "confirm" ? m.mypage.withdrawConfirm : m.mypage.withdraw}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
