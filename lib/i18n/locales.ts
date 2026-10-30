export const LOCALES = ["ko", "en", "ja"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tags for Intl formatting and speech recognition. */
export const LOCALE_TAGS: Record<Locale, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
};

/** Native names for the pre-login language buttons. */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
};

/** Compact labels for the header toggle. */
export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  ko: "Ko",
  en: "En",
  ja: "Ja",
};

/** English language names used inside AI prompts. */
export const LOCALE_ENGLISH_NAMES: Record<Locale, string> = {
  ko: "Korean",
  en: "English",
  ja: "Japanese",
};
