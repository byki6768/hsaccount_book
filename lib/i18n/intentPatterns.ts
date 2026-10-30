/**
 * Language-specific patterns used to understand user input in Korean,
 * English, and Japanese. All three languages are always checked, since a
 * user may type in any of them regardless of the UI language.
 */

const NUMBER = String.raw`(\d{1,3}(,\d{3})+|\d+)`;

/** A concrete money amount, e.g. "15000원", "2만원", "800円", "3万円", "$12", "1200 yen". */
export const CONCRETE_AMOUNT = new RegExp(
  [
    String.raw`${NUMBER}\s*만\s*원?`,
    String.raw`\d+\.\d+\s*만\s*원?`,
    String.raw`${NUMBER}\s*원`,
    String.raw`${NUMBER}\s*万\s*円?`,
    String.raw`\d+\.\d+\s*万\s*円?`,
    String.raw`${NUMBER}\s*円`,
    String.raw`[$¥₩]\s*${NUMBER}`,
    String.raw`${NUMBER}\s*(won|yen|dollars?|usd|krw|jpy)\b`,
  ].join("|"),
  "i",
);

/** Any amount, including a bare number with 4+ digits. */
export const ANY_AMOUNT = new RegExp(`${CONCRETE_AMOUNT.source}|\\b\\d{4,}\\b`, "i");

export const QUESTION = new RegExp(
  [
    // Korean
    String.raw`얼마|얼마나|뭐|무엇|어떻게|어디|언제|누가|왜|어느|알려|보여|말해|궁금|찾아|검색|총\s*지출|총\s*수입|가장\s*많이|지난\s*주|이번\s*달|저번\s*달|어제\s*뭐|뭐\s*샀|얼마나\s*쓰|지출이|수입이`,
    // English
    String.raw`\bhow\s+much\b|\bwhat\b|\bwhen\b|\bwhere\b|\bwhich\b|\bshow\b|\btell\s+me\b|\btotal\b|\bmost\b|\blast\s+(week|month)\b|\bthis\s+(week|month)\b`,
    // Japanese
    String.raw`いくら|何|どこ|いつ|どれ|どの|教えて|見せて|合計|一番|先週|今週|先月|今月|使った`,
    String.raw`[?？]`,
  ].join("|"),
  "i",
);

export const SEARCH = new RegExp(
  [
    String.raw`찾아|검색|조회|어디에\s*있|기록\s*있|산\s*적|쓴\s*적|들어\s*온\s*적`,
    String.raw`\bfind\b|\bsearch\b|\blook\s+up\b|\bdid\s+i\s+(buy|spend)\b`,
    String.raw`探して|検索|調べて|買ったこと|使ったこと`,
  ].join("|"),
  "i",
);

/** Phrases removed from a message to leave just the search keywords. */
export const SEARCH_FILLER =
  /찾아\s*줘|검색해\s*줘|검색|조회|알려\s*줘|보여\s*줘|\bplease\b|\bfind\b|\bsearch\s+for\b|\bsearch\b|\blook\s+up\b|\bshow\s+me\b|を?探して(ください)?|を?検索して(ください)?|検索|を?調べて(ください)?|[?？]/gi;

/** Stats-style wording that the AI may have mistaken for small talk. */
export const STATS_QUESTION =
  /얼마|뭐|어떻게|총\s*지출|가장\s*많이|지난\s*주|이번\s*달|\bhow\s+much\b|\btotal\b|\bmost\b|\blast\s+week\b|\bthis\s+month\b|いくら|合計|一番|先週|今月/i;

/** Ledger-related wording in general conversation. */
export const LEDGER_TOPIC =
  /지출|수입|썼|샀|통계|내역|\bspen[dt]\b|\bexpenses?\b|\bincome\b|\bbought\b|\bstat(s|istics)?\b|支出|収入|使った|買った|統計|明細/i;

export const RELATIVE_DAYS: Record<"today" | "yesterday", string[]> = {
  today: ["오늘", "today", "今日"],
  yesterday: ["어제", "yesterday", "昨日"],
};
