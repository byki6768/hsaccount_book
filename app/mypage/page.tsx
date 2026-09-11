"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { PasswordInput } from "@/components/PasswordInput";
import { SpeechBubble } from "@/components/SpeechBubble";
import {
  clearRegisteredFlag,
  clearSession,
  getLoginId,
  getSession,
  isValidPassword,
  setSession,
  type AuthType,
} from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  auth_type: AuthType;
  email: string | null;
  country_code: string | null;
  phone: string | null;
};

export default function MyPage() {
  return (
    <AuthGuard>
      <MyPageContent />
    </AuthGuard>
  );
}

function MyPageContent() {
  const router = useRouter();
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
    const session = getSession();
    if (!session) return;

    const { data, error: fetchError } = await supabase
      .from("members")
      .select("auth_type, email, country_code, phone")
      .eq("unique_id", session.uniqueId)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    if (!data) {
      clearSession();
      router.replace("/");
      return;
    }

    const nextProfile = data as Profile;
    setProfile(nextProfile);
    setSession({
      uniqueId: session.uniqueId,
      authType: nextProfile.auth_type,
      loginId: getLoginId(nextProfile),
    });
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    setError(null);
    setMessage(null);

    const session = getSession();
    if (!isValidPassword(newPassword) || newPassword !== confirmPassword || !session) {
      return;
    }

    setSaving(true);
    const hashed = await hashPassword(newPassword);
    const { error: updateError } = await supabase
      .from("members")
      .update({ password: hashed })
      .eq("unique_id", session.uniqueId)
      .eq("is_active", true);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setEditing(false);
    setNewPassword("");
    setConfirmPassword("");
    setTouched({ password: false, confirm: false });
    setMessage("비밀번호가 수정되었습니다.");
    setSaving(false);
  };

  const handleWithdraw = async () => {
    if (withdrawStep === "idle") {
      setWithdrawStep("confirm");
      return;
    }

    const session = getSession();
    if (!session) return;

    setSaving(true);
    const { error: updateError } = await supabase
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

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    clearSession();
    clearRegisteredFlag();
    setMessage("탈퇴가 완료 되었습니다!");
    setSaving(false);

    window.setTimeout(() => {
      router.replace("/");
    }, 1200);
  };

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#e8f5f0_0%,_#f7f8fa_45%,_#eef1f5_100%)]">
      <AppHeader loggedIn />
      <div className="page-main flex min-h-[calc(100dvh-5.5rem)] flex-col py-6 sm:py-8">
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">마이 페이지</h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">계정 정보를 확인하고 관리하세요</p>

        {loading ? (
          <p className="mt-10 text-center text-slate-400">불러오는 중...</p>
        ) : profile ? (
          <>
            <div className="mt-8 flex-1 space-y-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">ID</p>
                <p className="mt-1 break-all text-lg font-semibold text-slate-800">
                  {getLoginId(profile)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500">비밀번호</p>
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
                    수정
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
                        새 비밀번호
                      </label>
                      {passwordInvalid && (
                        <SpeechBubble message="문자 또는 숫자로만 입력하세요" />
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
                        비밀번호 확인
                      </label>
                      {passwordMismatch && (
                        <SpeechBubble message="비밀번호가 일치하지 않습니다" />
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
                      {saving ? "수정 중..." : "수정 확인"}
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
                <SpeechBubble message="탈퇴하시면 모든 기록이 사라집니다! 그래도 탈퇴하시겠습니다?" />
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
                {withdrawStep === "confirm" ? "탈퇴 확인" : "회원 탈퇴"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
