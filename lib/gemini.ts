import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

/** 우선순위: lite(부하↓) → flash. 503이면 다음 모델로 전환 */
export const GEMINI_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
] as const;

export const GEMINI_MODEL = GEMINI_MODELS[0];

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다");
  }
  return apiKey;
}

export function getGeminiModel(model: string = GEMINI_MODEL): GenerativeModel {
  const genAI = new GoogleGenerativeAI(getApiKey());
  return genAI.getGenerativeModel({ model });
}

function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /\[503[^\]]*\]/.test(message) ||
    /high demand/i.test(message) ||
    /try again later/i.test(message) ||
    /\[429[^\]]*\]/.test(message) ||
    /resource exhausted/i.test(message) ||
    /unavailable/i.test(message)
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini 호출: 모델 폴백 + 짧은 재시도
 */
export async function generateGeminiText(
  prompt: string,
  options?: { models?: readonly string[]; retriesPerModel?: number },
): Promise<string> {
  const models = options?.models ?? GEMINI_MODELS;
  const retriesPerModel = options?.retriesPerModel ?? 2;
  const genAI = new GoogleGenerativeAI(getApiKey());

  let lastError: unknown;

  for (const modelName of models) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 0; attempt <= retriesPerModel; attempt += 1) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err) {
        lastError = err;
        if (!isRetryableError(err) || attempt === retriesPerModel) {
          break;
        }
        await sleep(600 * (attempt + 1));
      }
    }
  }

  if (lastError instanceof Error) {
    if (isRetryableError(lastError)) {
      throw new Error(
        "AI 서버가 잠시 혼잡해요. 잠시 후 다시 시도해 주세요.",
      );
    }
    throw lastError;
  }
  throw new Error("Gemini 응답에 실패했습니다");
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
