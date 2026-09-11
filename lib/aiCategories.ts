import { extractJson, generateGeminiText } from "@/lib/gemini";
import type { CategoryKind } from "@/lib/categories";

export type AiCategoryTree = {
  majors: Array<{
    name: string;
    minors: string[];
  }>;
};

const KIND_LABEL: Record<CategoryKind, string> = {
  expense: "지출",
  income: "수입",
};

export async function generateCategoryTree(
  kind: CategoryKind,
): Promise<AiCategoryTree> {
  const prompt = `당신은 한국 개인 가계부 카테고리 설계자입니다.
${KIND_LABEL[kind]} 내역을 분류할 대분류·소분류 트리를 JSON으로만 반환하세요.

규칙:
- 대분류(majors)는 정확히 8개
- 각 대분류 아래 소분류(minors)는 2~4개
- 각 대분류의 소분류 목록 마지막 항목은 반드시 "(기타)"로 끝나야 함 (예: "식비(기타)", "급여(기타)")
- 이름은 짧고 명확한 한국어
- JSON 외 텍스트 금지

형식:
{"majors":[{"name":"대분류명","minors":["소분류1","소분류2","대분류명(기타)"]}]}`;

  const text = await generateGeminiText(prompt);
  const tree = extractJson<AiCategoryTree>(text);

  if (!Array.isArray(tree.majors) || tree.majors.length !== 8) {
    throw new Error(`${KIND_LABEL[kind]} 대분류는 정확히 8개여야 합니다`);
  }

  for (const major of tree.majors) {
    if (!major.name?.trim()) throw new Error("빈 대분류 이름이 있습니다");
    if (!Array.isArray(major.minors) || major.minors.length < 2 || major.minors.length > 4) {
      throw new Error(`"${major.name}" 소분류는 2~4개여야 합니다`);
    }
    const last = major.minors[major.minors.length - 1] ?? "";
    if (!last.includes("기타")) {
      major.minors[major.minors.length - 1] = `${major.name}(기타)`;
    }
  }

  return tree;
}

/** Gemini가 반환하는 지출 분석 JSON */
export type ExpenseAnalysis = {
  status: "ok" | "need_info" | "chat";
  date: string | null;
  description: string | null;
  amount: number | null;
  item_name: string | null;
  place: string | null;
  category_major: string | null;
  category_minor: string | null;
  reply: string;
};

export type ParsedLedgerIntent = {
  intent: "save_expense" | "save_income" | "chat" | "clarify" | "search";
  date: string | null;
  amount: number | null;
  description: string | null;
  item_name: string | null;
  place: string | null;
  income_detail: string | null;
  income_source: string | null;
  major: string | null;
  minor: string | null;
  search_query: string | null;
  reply: string;
};

export async function analyzeExpenseMessage(params: {
  message: string;
  today: string;
  expenseTree: AiCategoryTree;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<ExpenseAnalysis> {
  const historyText = params.history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
    .join("\n");

  const prompt = `당신은 한국 AI 가계부 챗봇입니다. 사용자의 자연어에서 지출 정보를 추출합니다.
오늘 날짜(Asia/Seoul): ${params.today}

사용 가능한 지출 카테고리(이 목록의 이름만 사용):
${JSON.stringify(params.expenseTree, null, 2)}

최근 대화:
${historyText || "(없음)"}

사용자 메시지:
${params.message}

규칙:
1) 통계/조회/검색 질문(얼마, 뭐, 찾아, 검색 등)이면 절대 저장하지 말고 status="chat".
2) 지출 기록이고 금액(숫자+원/만)이 있으면 status="ok" 로 date, description, amount, item_name, place, category_major, category_minor 를 채운다.
3) date는 YYYY-MM-DD. "오늘"→${params.today}, "어제"→하루 전. 날짜를 전혀 알 수 없으면 null.
4) amount는 정수(원). "2만원"=20000. 금액을 알 수 없으면 null.
5) description은 짧은 한국어 내용(예: 택시, 점심).
6) item_name은 구매 품목명(예: 아메리카노, 김치). 모르면 description과 같게 하거나 null.
7) place는 구매 장소/가게명(예: 스타벅스, 이마트). 없으면 null.
8) category_major / category_minor 는 위 트리에 있는 이름만 사용. 애매하면 해당 대분류의 (기타) 소분류.
9) 기록 의도인데 날짜 또는 금액이 없으면 status="need_info".
10) 인사/잡담이면 status="chat".
11) reply는 친근한 한국어. status=ok 이면 저장 확인 멘트.

JSON만 반환:
{"status":"ok|need_info|chat","date":"YYYY-MM-DD|null","description":"내용|null","amount":20000,"item_name":"택시","place":null,"category_major":"교통비","category_minor":"교통비(기타)","reply":"응답"}`;

  const text = await generateGeminiText(prompt);
  const parsed = extractJson<ExpenseAnalysis>(text);

  if (!parsed.reply?.trim()) {
    parsed.reply = "알겠어요. 지출 내용을 말씀해 주세요.";
  }
  parsed.item_name = parsed.item_name ?? null;
  parsed.place = parsed.place ?? null;

  return parsed;
}

export async function parseLedgerMessage(params: {
  message: string;
  today: string;
  expenseTree: AiCategoryTree;
  incomeTree: AiCategoryTree;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<ParsedLedgerIntent> {
  const historyText = params.history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
    .join("\n");

  const prompt = `당신은 카카오톡 스타일의 친절한 AI 가계부 챗봇입니다.
오늘 날짜: ${params.today}

지출 카테고리:
${JSON.stringify(params.expenseTree, null, 2)}

수입 카테고리:
${JSON.stringify(params.incomeTree, null, 2)}

최근 대화:
${historyText || "(없음)"}

사용자 메시지:
${params.message}

할 일:
1) 메시지가 지출/수입 기록이면 intent를 save_expense 또는 save_income으로 설정
2) 검색/찾기 요청("찾아줘","검색","~한 적","어디서 샀")이면 intent=search, search_query에 핵심 키워드
3) date(YYYY-MM-DD), amount(정수 원), description을 추출
4) 지출이면 item_name(구매 품목명), place(구매 장소)도 추출
5) 수입이면 income_detail(수입 내역), income_source(수입처)도 추출
6) 해당 kind 트리에서 가장 적합한 major/minor 이름을 정확히 골라 지정
7) 날짜가 없으면 ${params.today} 사용. 금액이 없으면 intent=clarify
8) 정보가 부족하면 intent=clarify
9) 일반 대화면 intent=chat
10) reply는 짧고 친근한 한국어 1~3문장

JSON만 반환:
{"intent":"save_expense|save_income|search|chat|clarify","date":"YYYY-MM-DD|null","amount":12345,"description":"내용","item_name":"품목|null","place":"장소|null","income_detail":"내역|null","income_source":"수입처|null","major":"대분류","minor":"소분류","search_query":"키워드|null","reply":"응답"}`;

  const text = await generateGeminiText(prompt);
  const parsed = extractJson<ParsedLedgerIntent>(text);

  if (!parsed.reply?.trim()) {
    parsed.reply = "알겠어요. 무엇을 도와드릴까요?";
  }
  parsed.item_name = parsed.item_name ?? null;
  parsed.place = parsed.place ?? null;
  parsed.income_detail = parsed.income_detail ?? null;
  parsed.income_source = parsed.income_source ?? null;
  parsed.search_query = parsed.search_query ?? null;

  return parsed;
}

export function formatExpenseConfirm(params: {
  date: string;
  description: string;
  amount: number;
}): string {
  const [, m, d] = params.date.split("-").map(Number);
  const monthDay =
    Number.isFinite(m) && Number.isFinite(d)
      ? `${m}월 ${d}일`
      : params.date;
  return `${monthDay} ${params.description} ${params.amount.toLocaleString("ko-KR")}원을 저장했어요.`;
}

export type LedgerRowForAi = {
  type: "expense" | "income";
  date: string;
  amount: number;
  description: string;
  category_major: string | null;
  category_minor: string | null;
};

export async function answerStatsQuestion(params: {
  question: string;
  today: string;
  expenses: LedgerRowForAi[];
  incomes: LedgerRowForAi[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const historyText = params.history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
    .join("\n");

  const expensePayload = params.expenses.slice(0, 400);
  const incomePayload = params.incomes.slice(0, 200);

  const prompt = `당신은 친근한 한국어 AI 가계부 챗봇입니다.
오늘 날짜(Asia/Seoul): ${params.today}

아래는 사용자의 실제 가계부 데이터입니다. 이 데이터만 근거로 질문에 답하세요.
지어내지 마세요. 데이터가 없으면 솔직히 없다고 말하세요.
금액은 천 단위 콤마(예: 20,000원)로 표기하세요.
답변은 자연스럽고 짧은 2~5문장. JSON 금지, 마크다운 제목 금지.

지출 내역 (${params.expenses.length}건, 최대 400건 전달):
${JSON.stringify(expensePayload)}

수입 내역 (${params.incomes.length}건, 최대 200건 전달):
${JSON.stringify(incomePayload)}

최근 대화:
${historyText || "(없음)"}

사용자 질문:
${params.question}`;

  const text = (await generateGeminiText(prompt)).trim();
  return text || "데이터를 살펴봤는데, 답변을 만들지 못했어요. 질문을 조금 바꿔 볼래요?";
}
