"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, setSession, type SessionInfo } from "@/lib/auth";
import { isLocale } from "@/lib/i18n/locales";
import { useI18n } from "@/lib/i18n/useI18n";

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { m, setLocale } = useI18n();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          clearSession();
          router.replace("/");
          return;
        }
        const info = (await res.json()) as SessionInfo;
        setSession({ authType: info.authType, loginId: info.loginId });
        if (isLocale(info.language)) setLocale(info.language);
        setReady(true);
      } catch {
        if (!cancelled) router.replace("/");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname, setLocale]);

  useEffect(() => {
    const onLeave = () => {
      // Record latest activity on the server, then end the session.
      navigator.sendBeacon("/api/auth/logout");
      clearSession();
    };

    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);

    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 text-slate-500">
        {m.common.checkingLogin}
      </div>
    );
  }

  return <>{children}</>;
}
