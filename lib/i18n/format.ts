import { LOCALE_TAGS, type Locale } from "@/lib/i18n/locales";

const CURRENCY_SUFFIX: Record<Locale, string> = {
  ko: "원",
  en: "",
  ja: "円",
};

export function formatMoney(value: number, locale: Locale): string {
  return `${value.toLocaleString(LOCALE_TAGS[locale])}${CURRENCY_SUFFIX[locale]}`;
}

/** Compact axis tick: 10,000 units for ko/ja, thousands for en. */
export function formatAxisTick(value: number, locale: Locale): string {
  if (locale === "en") {
    return value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);
  }
  const unit = locale === "ko" ? "만" : "万";
  return value >= 10000 ? `${Math.round(value / 10000)}${unit}` : String(value);
}

/** Weekday names starting from Monday. */
export function weekdayNames(locale: Locale, width: "long" | "short"): string[] {
  const fmt = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: width });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
}

export function formatYearMonth(year: number, month: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    year: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, 1));
}

/** "10월 30일" / "Oct 30" / "10月30日" from a YYYY-MM-DD key. */
export function formatMonthDay(dateKey: string, locale: Locale): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return dateKey;
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    month: locale === "en" ? "short" : "long",
    day: "numeric",
  }).format(new Date(y || 2000, m - 1, d));
}
