"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { clearSession, getSession } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/useI18n";

type AppHeaderProps = {
  loggedIn?: boolean;
};

export function AppHeader({ loggedIn }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { m } = useI18n();
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(loggedIn));

  useEffect(() => {
    setIsLoggedIn(loggedIn ?? Boolean(getSession()));
  }, [loggedIn]);

  const handleAuthClick = async () => {
    if (isLoggedIn) {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      clearSession();
      router.replace("/");
      return;
    }
    router.push("/login");
  };

  const navItem = (href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        className={`rounded-xl border px-2.5 py-2 text-[11px] font-medium transition sm:px-3 sm:text-sm ${
          active
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <div className="page-shell flex flex-col gap-3 py-3 sm:py-3.5">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <Link
            href="/home"
            className="flex min-w-0 items-center gap-2.5 sm:gap-3.5"
          >
            <Image
              src="/logo.svg"
              alt={m.common.logoAlt}
              width={56}
              height={56}
              priority
              unoptimized
              className="h-11 w-11 shrink-0 rounded-2xl sm:h-14 sm:w-14"
            />
            <span className="truncate text-xl font-bold tracking-tight text-slate-800 sm:text-3xl">
              {m.common.headerTitle}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {isLoggedIn && <LanguageSwitcher variant="compact" />}
            <button
              type="button"
              onClick={handleAuthClick}
              className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 sm:px-3.5 sm:text-sm"
            >
              {isLoggedIn ? m.common.logout : m.common.login}
            </button>
          </div>
        </div>

        {isLoggedIn && (
          <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {navItem("/stats", m.nav.stats)}
            {navItem("/charts", m.nav.charts)}
            {navItem("/mypage", m.nav.mypage)}
          </nav>
        )}
      </div>
    </header>
  );
}
