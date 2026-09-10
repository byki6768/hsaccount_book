"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router, pathname]);

  useEffect(() => {
    const onLeave = () => {
      const session = getSession();
      if (!session) return;

      // Persist latest activity timestamp for analytics, then end the session.
      void supabase
        .from("members")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("unique_id", session.uniqueId);

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
