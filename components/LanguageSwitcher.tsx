"use client";

import {
  LOCALES,
  LOCALE_NATIVE_NAMES,
  LOCALE_SHORT_LABELS,
  type Locale,
} from "@/lib/i18n/locales";
import { useI18n } from "@/lib/i18n/useI18n";

type LanguageSwitcherProps = {
  /** "buttons": full names for pre-login screens; "compact": Ko/En/Ja for the header */
  variant: "buttons" | "compact";
};

export function LanguageSwitcher({ variant }: LanguageSwitcherProps) {
  const { locale, m, setLocale } = useI18n();

  const choose = (next: Locale) => {
    if (next === locale) return;
    if (variant === "buttons") {
      setLocale(next, { explicit: true });
      return;
    }
    setLocale(next);
    void fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: next }),
    }).catch(() => null);
  };

  if (variant === "compact") {
    return (
      <div
        role="group"
        aria-label={m.common.language}
        className="flex shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => choose(code)}
            aria-pressed={code === locale}
            title={LOCALE_NATIVE_NAMES[code]}
            className={`px-1.5 py-1 text-[10px] font-semibold transition sm:px-2 sm:text-xs ${
              code === locale
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {LOCALE_SHORT_LABELS[code]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={m.common.language}
      className="flex w-full items-center justify-center gap-2"
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          onClick={() => choose(code)}
          aria-pressed={code === locale}
          className={`min-w-[5.5rem] rounded-xl border px-3 py-2 text-sm font-medium transition ${
            code === locale
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {LOCALE_NATIVE_NAMES[code]}
        </button>
      ))}
    </div>
  );
}
