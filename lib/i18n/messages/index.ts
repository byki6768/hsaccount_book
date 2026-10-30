import type { Locale } from "@/lib/i18n/locales";
import { en } from "@/lib/i18n/messages/en";
import { ja } from "@/lib/i18n/messages/ja";
import { ko, type Messages } from "@/lib/i18n/messages/ko";

const MESSAGES: Record<Locale, Messages> = { ko, en, ja };

export type { Messages };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
