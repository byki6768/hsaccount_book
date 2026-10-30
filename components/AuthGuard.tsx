"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, setSession, type SessionUser } from "@/lib/auth";

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
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
        setSession((await res.json()) as SessionUser);
        setReady(true);
      } catch {
        if (!cancelled) router.replace("/");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

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
        로그인 확인 중...
      </div>
    );
  }

  return <>{children}</>;
}
