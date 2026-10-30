import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { AuthType, SessionUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

const COOKIE_NAME = "hs_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type ServerSession = SessionUser & { uniqueId: string };

type Payload = {
  uid: string;
  at: AuthType;
  lid: string;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET 환경변수(32자 이상)가 설정되지 않았습니다");
  }
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

function encode(session: ServerSession): string {
  const payload: Payload = {
    uid: session.uniqueId,
    at: session.authType,
    lid: session.loginId,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

function decode(token: string | undefined): ServerSession | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Payload;
    if (!payload.uid || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { uniqueId: payload.uid, authType: payload.at, loginId: payload.lid };
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: ServerSession): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, encode(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readSessionCookie(): Promise<ServerSession | null> {
  const store = await cookies();
  return decode(store.get(COOKIE_NAME)?.value);
}

/** Signed cookie + member still active. Returns null when the caller is not logged in. */
export async function getSessionMember(): Promise<ServerSession | null> {
  const session = await readSessionCookie();
  if (!session) return null;

  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("members")
    .select("unique_id")
    .eq("unique_id", session.uniqueId)
    .eq("is_active", true)
    .maybeSingle();

  return data ? session : null;
}
