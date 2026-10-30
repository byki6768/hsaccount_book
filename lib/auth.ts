import type { Locale } from "@/lib/i18n/locales";

export type AuthType = "email" | "phone";

export type Member = {
  id: number;
  unique_id: string;
  auth_type: AuthType;
  email: string | null;
  country_code: string | null;
  phone: string | null;
  password: string | null;
  is_active: boolean;
  created_at: string;
  withdrawn_at: string | null;
  last_seen_at?: string | null;
  language?: string | null;
};

/** Display-only copy kept in the browser; the real session is the HTTP-only cookie. */
export type SessionUser = {
  authType: AuthType;
  loginId: string;
};

/** What auth/account APIs return: the session user plus their saved UI language. */
export type SessionInfo = SessionUser & { language: Locale };

const SESSION_KEY = "hsaccount_session";

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPassword(value: string): boolean {
  return /^[A-Za-z0-9]{6,20}$/.test(value);
}

export function isValidPhone(value: string): boolean {
  const digits = normalizePhone(value);
  return /^\d{9,11}$/.test(digits);
}

/** Country code: digits only (e.g. "+ 82" -> "82") */
export function normalizeCountryCode(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCountryCode(value: string): boolean {
  return /^\d{1,4}$/.test(normalizeCountryCode(value));
}

/** Mobile number: digits only, ignoring hyphens and spaces */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** Display login ID (country code-mobile number) */
export function getLoginId(member: Pick<Member, "auth_type" | "email" | "country_code" | "phone">): string {
  if (member.auth_type === "email") {
    return member.email ?? "";
  }
  const code = normalizeCountryCode(member.country_code ?? "") || "82";
  const phone = normalizePhone(member.phone ?? "");
  return phone ? `${code}-${phone}` : code;
}

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (!parsed.authType || typeof parsed.loginId !== "string") return null;
    return { authType: parsed.authType, loginId: parsed.loginId };
  } catch {
    return null;
  }
}

export function setSession(user: SessionUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
