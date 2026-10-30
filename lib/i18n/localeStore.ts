import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales";

// sessionStorage: a fresh app launch starts in the default language.
const LOCALE_KEY = "hsaccount_locale";
const EXPLICIT_KEY = "hsaccount_locale_explicit";

let current: Locale | null = null;
const listeners = new Set<() => void>();

function applyToDocument(locale: Locale) {
  document.documentElement.lang = locale;
}

function readInitial(): Locale {
  try {
    const stored = sessionStorage.getItem(LOCALE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function getLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  if (!current) {
    current = readInitial();
    applyToDocument(current);
  }
  return current;
}

export function getServerLocale(): Locale {
  return DEFAULT_LOCALE;
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * `explicit` marks a choice made on a pre-login screen, so login can
 * save it as the member's preference instead of restoring the old one.
 */
export function setLocale(locale: Locale, options: { explicit?: boolean } = {}): void {
  current = locale;
  try {
    sessionStorage.setItem(LOCALE_KEY, locale);
    if (options.explicit) sessionStorage.setItem(EXPLICIT_KEY, "1");
  } catch {
    // storage unavailable (private mode); keep in-memory value
  }
  applyToDocument(locale);
  listeners.forEach((listener) => listener());
}

export function hasExplicitLocaleChoice(): boolean {
  try {
    return sessionStorage.getItem(EXPLICIT_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearExplicitLocaleChoice(): void {
  try {
    sessionStorage.removeItem(EXPLICIT_KEY);
  } catch {
    // ignore
  }
}
