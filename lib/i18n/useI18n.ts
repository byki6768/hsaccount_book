"use client";

import { useSyncExternalStore } from "react";
import { getLocale, getServerLocale, setLocale, subscribeLocale } from "@/lib/i18n/localeStore";
import { getMessages } from "@/lib/i18n/messages";

export function useI18n() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getServerLocale);
  return { locale, m: getMessages(locale), setLocale };
}
