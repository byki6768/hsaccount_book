import { GoogleGenerativeAI } from "@google/generative-ai";

/** API 키에서 실제로 응답하는 모델 (gemini-2.0-flash 등은 403/미지원일 수 있음) */
export const GEMINI_MODEL = "gemini-flash-latest";

export function getGeminiModel(model = GEMINI_MODEL) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model });
}

export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 응답에서 JSON을 찾지 못했습니다");
  }
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
