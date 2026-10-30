/**
 * Distinguishes ledger entries from questions and searches.
 * - Contains a concrete amount: ledger entry
 * - Question wording: question
 */
import {
  ANY_AMOUNT,
  CONCRETE_AMOUNT,
  LEDGER_TOPIC,
  QUESTION,
  SEARCH,
  SEARCH_FILLER,
  STATS_QUESTION,
} from "@/lib/i18n/intentPatterns";

export type ChatIntentKind = "ledger" | "question" | "search" | "chat";

export function classifyChatIntent(message: string): ChatIntentKind {
  const text = message.trim();
  if (!text) return "chat";

  const hasAmount = ANY_AMOUNT.test(text);
  const hasQuestion = QUESTION.test(text);
  const hasSearch = SEARCH.test(text);

  // An amount wins, e.g. "lunch today 15000", unless it's only a question word like "how much".
  if (hasAmount && !(hasQuestion && !CONCRETE_AMOUNT.test(text))) {
    return "ledger";
  }

  if (hasSearch) return "search";
  if (hasQuestion) return "question";

  return "chat";
}

export function extractSearchQuery(message: string): string {
  return message.replace(SEARCH_FILLER, " ").replace(/\s+/g, " ").trim();
}

export function looksLikeStatsQuestion(message: string): boolean {
  return STATS_QUESTION.test(message);
}

export function mentionsLedgerTopic(message: string): boolean {
  return LEDGER_TOPIC.test(message);
}
