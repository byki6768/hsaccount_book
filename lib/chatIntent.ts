/**
 * 지출/수입 기록 vs 통계 질문 구분
 * - 금액이 포함되면 → 기록(ledger)
 * - 의문사/질문 표현이면 → 질문(question)
 */

const AMOUNT_PATTERN =
  /(\d{1,3}(,\d{3})+|\d+)\s*만\s*원?|\d+\.\d+\s*만\s*원?|(\d{1,3}(,\d{3})+|\d+)\s*원|\b\d{4,}\b/;

const QUESTION_PATTERN =
  /[?？]|얼마|얼마나|뭐|무엇|어떻게|어디|언제|누가|왜|어느|알려|보여|말해|궁금|찾아|검색|총\s*지출|총\s*수입|가장\s*많이|지난\s*주|이번\s*달|저번\s*달|어제\s*뭐|뭐\s*샀|얼마나\s*쓰|지출이|수입이/;

const SEARCH_PATTERN = /찾아|검색|조회|어디에\s*있|기록\s*있|산\s*적|쓴\s*적|들어\s*온\s*적/;

export type ChatIntentKind = "ledger" | "question" | "search" | "chat";

export function classifyChatIntent(message: string): ChatIntentKind {
  const text = message.trim();
  if (!text) return "chat";

  const hasAmount = AMOUNT_PATTERN.test(text);
  const hasQuestion = QUESTION_PATTERN.test(text);
  const hasSearch = SEARCH_PATTERN.test(text);

  // 금액이 있으면 기록 우선 (예: "오늘 점심 15000원")
  if (hasAmount && !isAmountOnlyQuestion(text, hasQuestion)) {
    return "ledger";
  }

  if (hasSearch) return "search";
  if (hasQuestion) return "question";

  return "chat";
}

export function extractSearchQuery(message: string): string {
  return message
    .replace(/찾아\s*줘|검색해\s*줘|검색|조회|알려\s*줘|보여\s*줘/g, " ")
    .replace(/[?？]/g, " ")
    .trim();
}

/** "얼마야", "얼마나" 등은 질문이지 금액 수치가 아님 */
function isAmountOnlyQuestion(text: string, hasQuestion: boolean): boolean {
  if (!hasQuestion) return false;
  // 숫자+원/만이 실제 기록용 금액인지: "15000원", "2만원" 형태
  const concreteAmount =
    /(\d{1,3}(,\d{3})+|\d+)\s*만\s*원?|\d+\.\d+\s*만\s*원?|(\d{1,3}(,\d{3})+|\d+)\s*원/.test(
      text,
    );
  return !concreteAmount;
}
