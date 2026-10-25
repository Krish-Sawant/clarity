// Server-only Gemini access. The key is read from .env.local and never reaches the browser.

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 60_000;

export class GeminiError extends Error {
  constructor(message: string, readonly status = 502) { super(message); }
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("Gemini is not configured on this server.", 503);
  return key;
}

export const chatModel = () => process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export type ProviderToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ProviderMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content?: string | null; tool_calls?: ProviderToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolSchema = { type: "function"; function: { name: string; description: string; parameters: object } };

// Gemini answers 503 when a model is briefly overloaded and 429 at the per-minute quota.
const RETRY_DELAYS_MS = [1500, 4000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One Chat Completions call through Gemini's OpenAI-compatible endpoint. */
export async function chat(messages: ProviderMessage[], tools: ToolSchema[]) {
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`${BASE}/openai/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
        // Thinking tokens count toward max_tokens; with a small cap the model can run out before replying
        // (finish_reason "length", empty message). Low effort keeps replies fast; the tools do the math.
        body: JSON.stringify({ model: chatModel(), messages, tools, tool_choice: "auto", max_tokens: 8192, reasoning_effort: "low" }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new GeminiError("Gemini took too long to answer.", 504);
      throw new GeminiError("Gemini is unreachable.", 502);
    }
    if (res.ok || ![429, 500, 503].includes(res.status) || attempt >= RETRY_DELAYS_MS.length) break;
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
  if (!res.ok) {
    console.error(`Gemini chat HTTP ${res.status}:`, (await res.text()).slice(0, 500));
    throw new GeminiError(res.status === 429 ? "Gemini rate limit reached." : `Gemini HTTP ${res.status}.`, res.status === 429 ? 429 : 502);
  }
  const choice = (await res.json()).choices?.[0];
  if (!choice?.message || !["stop", "tool_calls"].includes(choice.finish_reason)) {
    console.error("Gemini incomplete reply:", choice?.finish_reason, JSON.stringify(choice?.message ?? null).slice(0, 500));
    throw new GeminiError(`Gemini returned an incomplete reply (${choice?.finish_reason ?? "no choice"}).`);
  }
  return choice.message as Extract<ProviderMessage, { role: "assistant" }>;
}

const queryCache = new Map<string, number[]>();

/** Embeds a search query with the same model and size as the index, normalized to unit length. */
export async function embedQuery(text: string, model: string, dimensions: number): Promise<number[]> {
  const cached = queryCache.get(text);
  if (cached) return cached;
  const res = await fetch(`${BASE}/models/${model}:embedContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] }, taskType: "RETRIEVAL_QUERY", outputDimensionality: dimensions }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new GeminiError(`Embedding HTTP ${res.status}.`, res.status === 429 ? 429 : 502);
  const values: number[] = (await res.json()).embedding.values;
  const norm = Math.hypot(...values);
  const vector = values.map((v) => v / norm);
  if (queryCache.size > 500) queryCache.clear();
  queryCache.set(text, vector);
  return vector;
}
