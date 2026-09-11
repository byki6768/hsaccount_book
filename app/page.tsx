"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  const goLogin = () => {
    router.push("/login");
  };

  const goSignup = () => {
    router.push("/signup");
  };

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,_#e8f5f0_0%,_#f7f8fa_45%,_#eef1f5_100%)]">
      <div className="page-main flex min-h-full w-full flex-col items-center justify-center py-10 sm:py-12">
        <div className="flex w-full flex-1 flex-col items-center justify-center text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 scale-110 rounded-full bg-emerald-200/40 blur-2xl" />
            <Image
              src="/account-book-hero.png"
              alt="나의 AI 가계부 로고"
              width={220}
              height={220}
              priority
              className="relative h-44 w-44 rounded-[2rem] object-cover shadow-[0_20px_50px_-24px_rgba(16,185,129,0.55)] sm:h-52 sm:w-52"
            />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-800 sm:text-[2.5rem]">
            나의 AI 가계부
          </h1>
          <p className="mt-3 max-w-xs text-base text-slate-500">
            밝고 차분하게, 오늘의 지출을 기록하세요
          </p>
        </div>

        <div className="mt-10 flex w-full flex-col gap-4 pb-4">
          <button
            type="button"
            onClick={goLogin}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.99]"
          >
            로그인
          </button>
          <button
            type="button"
            onClick={goSignup}
            className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-emerald-600 bg-white text-lg font-semibold text-emerald-700 transition hover:bg-emerald-50 active:scale-[0.99]"
          >
            신규 회원
          </button>
        </div>
      </div>
    </div>
  );
}
