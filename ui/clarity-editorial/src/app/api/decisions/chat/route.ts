import type { ChatItem, Session } from "../../../../../../../frontend/src/lib/chat/types";
import { auth0 } from "../../../../lib/auth/server";
import { decideTurn } from "../../../../server/decision-agent";
import { GeminiError } from "../../../../server/gemini";

// POST { history, session } → one agent turn { text, toolCalls, providerMessage, sources }.
// The browser runs the tools and calls again until the turn ends.

const MAX_BODY_BYTES = 400_000;
const MAX_ITEMS = 120;
const MAX_USER_CHARS = 1200;

// Each user message can take several agent calls, so the window is generous. In-memory: per server process.
const WINDOW_MS = 10 * 60_000;
const MAX_CALLS = 150;
const calls = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (calls.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  calls.set(ip, recent);
  return recent.length > MAX_CALLS;
}

function validHistory(x: unknown): x is ChatItem[] {
  return Array.isArray(x) && x.length > 0 && x.length <= MAX_ITEMS && x.every((h) =>
    h && typeof h === "object" && (
      (h.role === "user" && typeof h.text === "string" && h.text.length <= MAX_USER_CHARS) ||
      (h.role === "assistant" && (h.toolCalls === undefined || Array.isArray(h.toolCalls))) ||
      (h.role === "tool" && typeof h.callId === "string")));
}

function validSession(x: unknown): x is Session {
  const s = x as Session;
  return !!s && typeof s === "object" && (s.scenarioId === null || typeof s.scenarioId === "string") &&
    !!s.values && typeof s.values === "object" && typeof s.years === "number";
}

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  // Gemini calls spend the project's quota, so only signed-in users may make them.
  if (!(await auth0?.getSession())) return error("Sign in required.", 401);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return error("Conversation is too long. Start over to continue.", 413);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(ip)) return error("Too many requests. Try again in a few minutes.", 429);

  let body: { history?: unknown; session?: unknown };
  try { body = JSON.parse(raw); } catch { return error("Invalid JSON.", 400); }
  if (!validHistory(body.history) || !validSession(body.session)) return error("Invalid conversation.", 400);

  try {
    return Response.json(await decideTurn(body.history, body.session));
  } catch (e) {
    if (e instanceof GeminiError) return error(e.message, e.status);
    console.error("decision chat failed", e);
    const detail = process.env.NODE_ENV === "development" && e instanceof Error ? ` (${e.message})` : "";
    return error(`The guide could not answer. Try again.${detail}`, 500);
  }
}
