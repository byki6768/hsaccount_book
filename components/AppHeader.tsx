"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getSession } from "@/lib/auth";

type AppHeaderProps = {
  loggedIn?: boolean;
};

export function AppHeader({ loggedIn }: AppHeaderProps) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(loggedIn));

  useEffect(() => {
    setIsLoggedIn(loggedIn ?? Boolean(getSession()));
  }, [loggedIn]);

  const handleAuthClick = () => {
    if (isLoggedIn) {
      clearSession();
      router.replace("/");
      return;
    }
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/home"
          className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700 sm:text-base"
        >
          <Image
            src="/account-book-hero.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
          />
          <span className="truncate">나의 AI 가계부</span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/stats"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            통계
          </Link>
          <Link
            href="/mypage"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            마이 페이지
          </Link>
          <button
            type="button"
            onClick={handleAuthClick}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            {isLoggedIn ? "로그아웃" : "로그인"}
          </button>
        </div>
      </div>
    </header>
  );
}
