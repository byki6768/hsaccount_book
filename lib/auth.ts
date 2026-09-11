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
};

export type SessionUser = {
  uniqueId: string;
  authType: AuthType;
  loginId: string;
};

const SESSION_KEY = "hsaccount_session";
const REGISTERED_KEY = "hsaccount_registered";

export function generateUniqueId(): string {
  const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const alnum =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = letters[Math.floor(Math.random() * letters.length)];
  for (let i = 1; i < 16; i += 1) {
    id += alnum[Math.floor(Math.random() * alnum.length)];
  }
  return id;
}

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

/** 국가번호: 숫자만 저장 (예: "+ 82" → "82") */
export function normalizeCountryCode(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCountryCode(value: string): boolean {
  return /^\d{1,4}$/.test(normalizeCountryCode(value));
}

/** 휴대폰 번호: 하이픈·공백 등 무시하고 숫자만 */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** 표시용 로그인 ID (국가번호-휴대폰번호) */
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
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setSession(user: SessionUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  localStorage.setItem(REGISTERED_KEY, "true");
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function hasRegisteredBefore(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(REGISTERED_KEY) === "true";
}

export function markRegistered(): void {
  localStorage.setItem(REGISTERED_KEY, "true");
}

export function clearRegisteredFlag(): void {
  localStorage.removeItem(REGISTERED_KEY);
}
