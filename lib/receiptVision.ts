import { extractJson, generateGeminiText } from "@/lib/gemini";
import type { AiCategoryTree } from "@/lib/aiCategories";

export type ReceiptLineItem = {
  name: string;
  amount: number | null;
};

export type ReceiptExtraction = {
  store_name: string | null;
  date: string | null;
  amount: number | null;
  /** @deprecated use line_items */
  items: string[];
  line_items: ReceiptLineItem[];
  description: string | null;
  category_major: string | null;
  category_minor: string | null;
  confidence: "high" | "medium" | "low";
};

export async function extractReceiptFromImage(params: {
  imageBase64: string;
  mimeType: string;
  today: string;
  expenseTree: AiCategoryTree;
}): Promise<ReceiptExtraction> {
  const prompt = `당신은 한국 영수증 OCR·가계부 분석기입니다.
오늘 날짜(Asia/Seoul): ${params.today}

이미지 영수증에서 정보를 읽고 JSON만 반환하세요.

추출 필드:
- store_name: 가게/상호명 (없으면 null)
- date: 결제/발행일 YYYY-MM-DD (없으면 null, 연도 없으면 ${params.today.slice(0, 4)} 사용)
- amount: 총 결제 금액(정수 원). "합계/받을금액/총액/결제금액" 우선.
- line_items: 개별 품목 배열. 각 항목은 {"name":"품목명","amount":개별금액정수또는null}
  - 영수증에 적힌 개별 품목이름과 개별 품목별 금액을 가능한 모두 추출 (최대 30개)
  - 금액이 안 보이면 amount=null, 이름은 유지
- items: line_items의 name만 모은 배열 (호환용)
- description: 가계부 내용용 짧은 한국어 한 줄 (가게+대표품목 권장)
- category_major / category_minor: 아래 지출 카테고리 트리에서만 선택. 애매하면 (기타) 소분류.
- confidence: high|medium|low

지출 카테고리:
${JSON.stringify(params.expenseTree, null, 2)}

규칙:
- 영수증이 아니면 amount=null, confidence=low
- 추측으로 금액을 만들지 말 것. 읽을 수 없으면 null
- JSON 외 텍스트 금지

형식:
{"store_name":"스타벅스","date":"2026-09-11","amount":11000,"line_items":[{"name":"아메리카노","amount":5500},{"name":"카페라떼","amount":5500}],"items":["아메리카노","카페라떼"],"description":"스타벅스 · 아메리카노 외","category_major":"식비","category_minor":"카페(기타)","confidence":"high"}`;

  const text = await generateGeminiText(prompt, {
    image: {
      data: params.imageBase64,
      mimeType: params.mimeType,
    },
  });

  const parsed = extractJson<ReceiptExtraction>(text);

  const rawLines = Array.isArray(parsed.line_items) ? parsed.line_items : [];
  parsed.line_items = rawLines
    .map((line) => {
      const name = String(line?.name ?? "").trim();
      if (!name) return null;
      const amountRaw = line?.amount;
      const amountNum =
        amountRaw == null || amountRaw === ("" as unknown)
          ? null
          : Math.round(Number(amountRaw));
      return {
        name: name.slice(0, 120),
        amount: amountNum != null && Number.isFinite(amountNum) && amountNum > 0
          ? amountNum
          : null,
      };
    })
    .filter((line): line is ReceiptLineItem => line != null);

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    parsed.items = parsed.line_items.map((line) => line.name);
  } else {
    parsed.items = parsed.items.map((name) => String(name).trim()).filter(Boolean);
  }

  // line_items가 비어 있으면 items 이름으로 보완
  if (parsed.line_items.length === 0 && parsed.items.length > 0) {
    parsed.line_items = parsed.items.map((name) => ({ name, amount: null }));
  }

  if (parsed.amount != null) {
    const n = Number(parsed.amount);
    parsed.amount = Number.isFinite(n) ? Math.round(n) : null;
  }
  if (parsed.description) parsed.description = parsed.description.trim();
  if (parsed.store_name) parsed.store_name = parsed.store_name.trim();

  return parsed;
}

export function buildReceiptDescription(extracted: ReceiptExtraction): string {
  if (extracted.description?.trim()) return extracted.description.trim();

  const store = extracted.store_name?.trim();
  const names = extracted.line_items.map((line) => line.name).filter(Boolean);
  if (store && names.length > 0) {
    const head = names.slice(0, 2).join(", ");
    const more = names.length > 2 ? " 외" : "";
    return `${store} · ${head}${more}`;
  }
  if (store) return store;
  if (names.length > 0) return names.slice(0, 3).join(", ");
  return "영수증 지출";
}
