import { GoogleGenerativeAI } from "@google/generative-ai";

/** Priority: lite (less load) first, then flash. Falls back on 503. */
export const GEMINI_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
] as const;

/** Thrown when every model stays overloaded; routes show a localized "busy" reply. */
export class GeminiBusyError extends Error {
  constructor() {
    super("Gemini is overloaded, try again later");
    this.name = "GeminiBusyError";
  }
}

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return apiKey;
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

export type GeminiInlineImage = {
  mimeType: string;
  /** raw base64 (no data URL prefix) */
  data: string;
};

/**
 * Calls Gemini with model fallback and short retries.
 * Text only, or text + image (vision).
 */
export async function generateGeminiText(
  prompt: string,
  options?: {
    models?: readonly string[];
    retriesPerModel?: number;
    image?: GeminiInlineImage;
  },
): Promise<string> {
  const models = options?.models ?? GEMINI_MODELS;
  const retriesPerModel = options?.retriesPerModel ?? 2;
  const genAI = new GoogleGenerativeAI(getApiKey());

  const parts: Array<string | { inlineData: { data: string; mimeType: string } }> =
    options?.image
      ? [
          { inlineData: { data: options.image.data, mimeType: options.image.mimeType } },
          prompt,
        ]
      : [prompt];

  let lastError: unknown;

  for (const modelName of models) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 0; attempt <= retriesPerModel; attempt += 1) {
      try {
        const result = await model.generateContent(parts);
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
    if (isRetryableError(lastError)) throw new GeminiBusyError();
    throw lastError;
  }
  throw new Error("Gemini request failed");
}

export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON found in AI response");
  }
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
