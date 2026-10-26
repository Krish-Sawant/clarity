// Gemini-backed decision guide. It speaks the same tool protocol as the scripted
// guide (src/engines/chat/tools.ts): Gemini chooses tools, the browser runs
// them, and every projected number comes from the simulator, never the model.
import { SCENARIOS } from "../engines/sim/scenarios";
import { CITIES } from "../engines/sim/tax";
import { TABLE_ROW_KEYS } from "../engines/sim/summary";
import type { AgentTurn, ChatItem, Session, ToolCall } from "../engines/chat/types";
import { chat, type ProviderMessage, type ProviderToolCall, type ToolSchema } from "./gemini";
import { retrieve, type Passage } from "./rag";

const tool = (name: string, description: string, properties: object = {}, required: string[] = []): ToolSchema =>
  ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });

const str = { type: "string" };
const numStr = { type: "number" };
const item = (properties: Record<string, object>, required: string[]) => ({ type: "array", items: { type: "object", properties, required } });
const OPTION = {
  type: "object",
  properties: {
    label: { type: "string", description: "Short name, e.g. \"Lease\" or \"Buy used\"" },
    starting_cash: numStr,
    savings_apy_pct: numStr,
    income: item({
      name: str, amount: numStr,
      basis: { type: "string", enum: ["monthly_take_home", "annual_gross"] },
      tax_city: { type: "string", enum: CITIES.map((c) => c.id), description: "Only for annual_gross salaries in these cities" },
      state_local_tax_pct: { type: "number", description: "For annual_gross outside the listed cities" },
      annual_raise_pct: numStr, start_month: numStr, end_month: numStr,
    }, ["name", "amount", "basis"]),
    costs: item({ name: str, monthly: numStr, annual_growth_pct: numStr, start_month: numStr, end_month: numStr }, ["name", "monthly"]),
    one_time: item({ name: str, amount: numStr, month: { type: "number", description: "0 = upfront" } }, ["name", "amount"]),
    debts: item({ name: str, balance: numStr, apr_pct: numStr, min_payment: numStr, payments_start_month: numStr }, ["name", "balance", "apr_pct", "min_payment"]),
    assets: item({ name: str, value: numStr, annual_depreciation_pct: numStr }, ["name", "value"]),
  },
  required: ["label"],
};

export const TOOLS: ToolSchema[] = [
  tool("pick_scenario", "Start one of the preset comparisons. Returns its input fields and suggested follow-up questions.",
    { scenario_id: { type: "string", enum: SCENARIOS.map((s) => s.id) } }, ["scenario_id"]),
  tool("define_comparison", "Start a custom comparison of any two money options. Include only cash flows that differ or matter. Use only values the user gave or picked; ask for anything missing first. List in assumptions any value the user explicitly asked you to fill with a typical figure.",
    { title: str, years: { type: "number", description: "Horizon, 1-10" }, options: { type: "array", items: OPTION, description: "Exactly two options" }, assumptions: { type: "array", items: str } },
    ["title", "years", "options", "assumptions"]),
  tool("set_inputs", "Change inputs of the current comparison by field key. Key \"years\" sets the horizon (1-10). Values are strings: numbers as digits, toggles as true/false, cities by id.",
    { inputs: item({ key: str, value: str }, ["key", "value"]) }, ["inputs"]),
  tool("ask_user", "Ask the user one follow-up question with 2-4 short answer choices. Ends your turn until they reply.",
    { question: str, choices: { type: "array", items: str } }, ["question", "choices"]),
  tool("run_simulation", "Run the projection with the current inputs. Returns the only projected numbers you may quote."),
  tool("show_playground", "Add a link to the summary cards for both options in the comparison below."),
  tool("show_chart", "Add a link to the line chart in the comparison below, switched to this measure. netWorth = overall position, cash = savings balance (reveals dips and shortfalls), debt = payoff progress.",
    { metric: { type: "string", enum: ["netWorth", "cash", "debt"] }, title: { type: "string", description: "Plain-language title saying what to look for" } }, ["metric", "title"]),
  tool("show_breakdown", "Add a link to the bar chart of each option's first-month budget: pay, each cost, debt payments, and what's left to save. Returns those amounts."),
  tool("show_table", "Add a link to the comparison table.", { rows: { type: "array", items: { type: "string", enum: TABLE_ROW_KEYS } } }, ["rows"]),
];

function systemPrompt(session: Session, passages: Passage[]): string {
  const presets = SCENARIOS.map((s) => `- ${s.id}: ${s.title}`).join("\n");
  const state = session.scenarioId
    ? `Current comparison: ${session.scenarioId}, ${session.years} years, inputs ${JSON.stringify(session.values)}`
    : "No comparison started yet.";
  const sources = passages.length
    ? passages.map((p) => `<source id="${p.source_id}" title="${p.title}" kind="${p.kind}">\n${p.text}\n</source>`).join("\n")
    : "(No trusted source matched this message.)";
  return `You are Clarity's decision guide: a friendly, plain-spoken helper for young adults weighing a money decision. You educate; you do not give personalized financial, legal, or tax advice.

WHAT YOU CAN SIMULATE
Any choice between two options that can be described as money over time: income, recurring costs, one-time costs, debts, and assets (leasing vs buying, renting vs buying, freelancing vs a salaried job, a bootcamp vs community college, keeping vs selling something, two apartments...).
Presets with richer built-in models (prefer them when they clearly fit):
${presets}

HOW TO WORK
1. Understand the decision. If it fits a preset, call pick_scenario, then ask its suggested follow-ups (from ask_about) one per turn with ask_user, mapping answers onto fields with set_inputs.
2. Otherwise build a custom comparison. First ask short follow-ups with ask_user (one per turn, with choices) for every number the comparison needs that the user hasn't given (e.g. price, monthly payment, income, savings, monthly living costs). Then call define_comparison using only the user's numbers.
   Model each option as the user's whole monthly budget, not just the part that differs: both options include their income and their regular living costs (rent, food, etc.), otherwise savings and net worth come out unrealistically high. Include costs specific to an option (insurance, repairs, fees, depreciation of assets) on that option.
3. When the comparison is set up, in one reply: run_simulation, then link the views that tell the story: show_playground, show_chart (netWorth, with a title naming what to notice), show_breakdown, and show_table. Add a second show_chart when it helps: metric "debt" if either option carries debt, metric "cash" if lowest_savings is low or savings run out. The show_ tools don't draw anything in the chat; each adds a link to that view in the live comparison below. Then explain the result in 3-5 sentences.
4. For a what-if on the current comparison: set_inputs (field keys from pick_scenario or define_comparison), run_simulation, then link the one or two views that show the change best (show_chart for changes over time, show_breakdown for monthly-budget changes), then a 2-3 sentence explanation; the comparison below updates by itself. If the what-if adds something new (a new cost or option), call define_comparison again with the change.
5. For a general money question, answer from SOURCES without tools.
6. If the question isn't a money decision at all, say what you can help with.

NUMBERS (strict)
- Never calculate or estimate results yourself. Projected figures (net worth, savings, payoff months, interest) come only from run_simulation; quote them as given (rounding such as $81,688 to $81.7k is fine).
- In explanations, any other dollar amount or percentage must be one the user said, one you set as an input or assumption, or one in SOURCES. Don't quote typical market rates (savings yields, loan rates) unless a source states them; set them as inputs instead.
- set_inputs only accepts the field keys returned by pick_scenario or define_comparison; other keys are rejected.
- Never assume a value. Every input must come from the user: something they said, or a choice they picked. Don't fill gaps with typical, average, or default values, and don't guess from context (e.g. a city or job title). If a number is missing, ask for it; group related numbers into one question to keep the conversation short. Answer choices may offer rough ranges for the user to pick from, but the user must pick one.
- If the user says they don't know, ask for their best rough guess. Use a typical value only if they explicitly ask you to, and then say which value you used.
- Before the first run_simulation, check the current inputs: if any value the result depends on is still a preset default the user hasn't confirmed, ask about it first.

SOURCES (strict)
- Ground general guidance and consumer rights in the passages below. Cite with the source id in square brackets right after the sentence, e.g. [cfpb-apr-44]. Use only ids listed below.
- If no passage covers a guidance point, say you don't have a trusted source on that rather than guessing. Never state laws, rates, or limits that aren't in a passage.

STYLE
- Short paragraphs, plain text, no markdown, no headings, under 120 words per message.
- Write every amount and rate as digits ($2,000, 8%), never spelled out in words.
- Never ask for account numbers, SSNs, or other identifiers.

${state}

SOURCES
${sources}`;
}

/* ---------- History → Gemini messages ---------- */

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function sanitizeAssistant(raw: unknown): Extract<ProviderMessage, { role: "assistant" }> | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.role !== "assistant") return null;
  const calls = Array.isArray(m.tool_calls)
    ? (m.tool_calls as ProviderToolCall[]).filter((c) => c?.type === "function" && typeof c.id === "string" && typeof c.function?.name === "string" && typeof c.function?.arguments === "string")
    : [];
  return { role: "assistant", content: typeof m.content === "string" ? m.content : null, ...(calls.length ? { tool_calls: calls } : {}) };
}

export function toProviderMessages(history: ChatItem[]): ProviderMessage[] {
  const out: ProviderMessage[] = [];
  const replayed = new Set<string>(); // ids of tool calls Gemini made itself
  history.forEach((item, i) => {
    if (item.role === "user") out.push({ role: "user", content: item.text });
    else if (item.role === "assistant") {
      const raw = sanitizeAssistant(item.providerMessage);
      if (raw) {
        raw.tool_calls?.forEach((c) => replayed.add(c.id));
        out.push(raw);
        return;
      }
      // Turns from the scripted fallback carry no thought signatures, which Gemini
      // requires on tool calls. Replay them as plain assistant text instead.
      const steps = (item.toolCalls ?? []).map((c) => {
        const r = history.slice(i + 1).find((h) => h.role === "tool" && h.callId === c.id);
        return `${c.name}(${JSON.stringify(c.args)}) → ${truncate(JSON.stringify(r?.role === "tool" ? r.result : null), 1500)}`;
      });
      out.push({ role: "assistant", content: [item.text, steps.length ? `[Steps taken: ${steps.join("; ")}]` : ""].filter(Boolean).join("\n") || "(no text)" });
    } else if (replayed.has(item.callId)) {
      out.push({ role: "tool", tool_call_id: item.callId, content: JSON.stringify(item.result) });
    }
  });
  return out;
}

/* ---------- Gemini tool calls → our ToolCall format ---------- */

function parseValue(raw: string): string | number | boolean {
  const v = raw.trim();
  if (/^(true|yes)$/i.test(v)) return true;
  if (/^(false|no)$/i.test(v)) return false;
  const num = Number(v.replace(/[$,%\s]/g, ""));
  return v !== "" && Number.isFinite(num) ? num : v;
}

export function toToolCall(call: ProviderToolCall): ToolCall {
  let args: Record<string, unknown> = {};
  try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* the tool reports bad arguments */ }
  if (call.function.name === "set_inputs" && Array.isArray(args.inputs)) {
    const values: Record<string, unknown> = {};
    for (const entry of args.inputs as { key?: unknown; value?: unknown }[]) {
      if (typeof entry?.key === "string") values[entry.key] = parseValue(String(entry.value ?? ""));
    }
    args = { values };
  }
  return { id: call.id, name: call.function.name, args };
}

/* ---------- Grounding checks ---------- */

function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number" && Number.isFinite(value)) out.push(Math.abs(value));
  else if (typeof value === "string") for (const m of value.matchAll(/\d[\d,]*(?:\.\d+)?/g)) out.push(Number(m[0].replace(/,/g, "")));
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

const RATE_KEY = /apr|apy|pct|percent|rate|raise|growth|depreciation/i;
const PERCENT = /(\d+(?:\.\d+)?)(?:\s?[-–]\s?(\d+(?:\.\d+)?))?\s?(?:%|percent)/gi;

/** Rates are small numbers that collide with everything, so they're only allowed from rate-shaped places. */
function ratesIn(value: unknown, out: number[], key = ""): number[] {
  if (typeof value === "number" && RATE_KEY.test(key)) out.push(Math.abs(value));
  else if (typeof value === "string") for (const m of value.matchAll(PERCENT)) out.push(...[m[1], m[2]].filter(Boolean).map(Number));
  else if (Array.isArray(value)) value.forEach((v) => ratesIn(v, out, key));
  else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => ratesIn(v, out, RATE_KEY.test(k) ? k : key));
  return out;
}

export type Allowed = { amounts: number[]; rates: number[] };

/** Figures the model may quote: the user's words, tool calls and results, passages, and gaps between the two options. */
export function allowedNumbers(history: ChatItem[], passages: Passage[], pendingCalls: ToolCall[] = []): Allowed {
  const amounts: number[] = [];
  const rates: number[] = [];
  const add = (value: unknown) => { numbersIn(value, amounts); ratesIn(value, rates); };
  for (const item of history) {
    if (item.role === "user") add(item.text);
    if (item.role === "assistant") item.toolCalls?.forEach((c) => add(c.args));
    if (item.role === "tool") {
      add(item.result);
      const options = (item.result as { options?: unknown })?.options;
      if (Array.isArray(options) && options.length === 2) {
        for (const [k, a] of Object.entries(options[0] as Record<string, unknown>)) {
          const b = (options[1] as Record<string, unknown>)[k];
          if (typeof a === "number" && typeof b === "number") amounts.push(Math.abs(a - b));
        }
      }
    }
  }
  pendingCalls.forEach((c) => add(c.args)); // inputs/assumptions set in this same reply
  passages.forEach((p) => add(p.text));
  return { amounts, rates };
}

const DOLLARS = /\$\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m)?\b/gi;
const close = (allowed: number[], value: number, tolerance: number) => allowed.some((n) => Math.abs(n - value) <= Math.max(tolerance, n * 0.01));

export function unverifiedAmounts(text: string, allowed: Allowed): string[] {
  const bad: string[] = [];
  for (const m of text.matchAll(DOLLARS)) {
    const scale = m[2]?.toLowerCase() === "k" ? 1e3 : m[2]?.toLowerCase() === "m" ? 1e6 : 1;
    // 1% tolerance covers rounding like $81,688 → $81.7k, not a different figure.
    if (!close(allowed.amounts, Number(m[1].replace(/,/g, "")) * scale, 1)) bad.push(m[0].trim());
  }
  for (const m of text.matchAll(PERCENT)) {
    if ([m[1], m[2]].filter(Boolean).some((v) => !close(allowed.rates, Number(v), 0.05))) bad.push(m[0].trim());
  }
  return bad;
}

const dropSentencesWith = (text: string, bad: string[]) =>
  text.split(/(?<=[.!?])\s+/).filter((s) => !bad.some((b) => s.includes(b))).join(" ").trim();

/** Normalizes citations to one " [id]" per source (Gemini sometimes writes "[a, b]") and drops ids it wasn't given. */
export function keepKnownCitations(text: string, passages: Pick<Passage, "source_id">[]): string {
  const known = new Set(passages.map((p) => p.source_id));
  return text.replace(/\s?\[([a-z0-9][a-z0-9#-]*(?:\s*,\s*[a-z0-9][a-z0-9#-]*)*)\]/gi, (_, ids: string) =>
    ids.split(",").map((id) => id.trim().split("#")[0]).filter((id) => known.has(id)).map((id) => ` [${id}]`).join(""));
}

/* ---------- Input checks: every input comes from the user ---------- */

// Timing and horizon describe the comparison, not the user's money, so the model may set them.
const TIMING_KEY = /^(years|month|start_month|end_month|payments_start_month)$/;

function inputNumbers(value: unknown, key = "", out: number[] = []): number[] {
  if (TIMING_KEY.test(key)) return out;
  if (typeof value === "number" && Number.isFinite(value)) out.push(Math.abs(value));
  else if (typeof value === "string" && /^\s*-?\$?\d[\d,]*(?:\.\d+)?\s*%?\s*$/.test(value)) out.push(Math.abs(Number(value.replace(/[$,%\s]/g, ""))));
  else if (Array.isArray(value)) value.forEach((v) => inputNumbers(v, key, out));
  else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => inputNumbers(v, k, out));
  return out;
}

/** Amounts the user typed or picked, with "$6k" scaling and monthly ↔ yearly conversions. Zero covers "no debt". */
export function userNumbers(history: ChatItem[]): number[] {
  const out = [0];
  for (const item of history) {
    if (item.role !== "user") continue;
    for (const m of item.text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)?\b/gi)) {
      const n = Number(m[1].replace(/,/g, ""));
      const scale = /^(k|thousand)$/i.test(m[2] ?? "") ? 1e3 : /^(m|million)$/i.test(m[2] ?? "") ? 1e6 : 1;
      for (const v of new Set([n, n * scale])) out.push(v, v * 12, v / 12);
    }
  }
  return out;
}

const mentioned = (history: ChatItem[], word: string) =>
  history.some((h) => h.role === "user" && h.text.toLowerCase().includes(word.toLowerCase().replace(/-/g, " ")));

type InputProblems = { message: string; rejected: Set<string>; missing: string[] };

/** Finds inputs the model made up, and preset defaults the user never gave before a simulation runs. */
export function inputProblems(history: ChatItem[], session: Session, calls: ToolCall[]): InputProblems | null {
  const allowed = userNumbers(history);
  const rejected = new Set<string>();
  const invented: string[] = [];
  for (const call of calls) {
    if (call.name !== "set_inputs" && call.name !== "define_comparison") continue;
    const args = call.name === "define_comparison" ? { ...call.args, assumptions: undefined, title: undefined } : call.args;
    const numbers = inputNumbers(args).filter((n) => !close(allowed, n, 0.5));
    const words = call.name === "set_inputs" ? Object.values((call.args.values ?? {}) as Record<string, unknown>).filter((v): v is string => typeof v === "string" && !mentioned(history, v)) : [];
    if (numbers.length || words.length) {
      rejected.add(call.id);
      invented.push(...numbers.map((n) => String(n)), ...words);
    }
  }

  let missing: string[] = [];
  if (calls.some((c) => c.name === "run_simulation")) {
    const picked = calls.find((c) => c.name === "pick_scenario")?.args.scenario_id;
    const scenario = SCENARIOS.find((s) => s.id === (picked ?? session.scenarioId));
    if (scenario) {
      const given = new Set<string>();
      const collect = (c: ToolCall) => { if (c.name === "set_inputs" && !rejected.has(c.id)) Object.keys((c.args.values ?? {}) as object).forEach((k) => given.add(k)); };
      history.forEach((h) => { if (h.role === "assistant") h.toolCalls?.forEach(collect); });
      calls.forEach(collect);
      // A value the user changed in the inputs panel differs from the preset default.
      const fresh = !!picked || session.scenarioId !== scenario.id;
      missing = scenario.fields.filter((f) => !given.has(f.key) && (fresh || session.values[f.key] === scenario.defaults[f.key])).map((f) => f.label);
    }
  }

  if (!rejected.size && !missing.length) return null;
  const parts = [
    invented.length ? `These input values were not given by the user: ${invented.join(", ")}. Never estimate or assume inputs.` : "",
    missing.length ? `These inputs still hold preset defaults the user never gave: ${missing.join("; ")}. Do not call run_simulation yet.` : "",
  ];
  return { message: `[Automated check] ${parts.filter(Boolean).join(" ")} Call ask_user to ask for the missing numbers, grouping related ones into one question.`, rejected, missing };
}

/* ---------- One agent turn ---------- */

export type DecisionTurn = AgentTurn & { sources: Pick<Passage, "source_id" | "title" | "url">[] };

export async function decideTurn(history: ChatItem[], session: Session): Promise<DecisionTurn> {
  const lastUser = history.findLast((h) => h.role === "user");
  if (!lastUser || lastUser.role !== "user") return { sources: [] };
  const passages = await retrieve(lastUser.text, session.scenarioId);
  const messages: ProviderMessage[] = [{ role: "system", content: systemPrompt(session, passages) }, ...toProviderMessages(history)];

  const draft = async (extra: ProviderMessage[] = []) => {
    const reply = await chat([...messages, ...extra], TOOLS);
    const toolCalls = (reply.tool_calls ?? []).filter((c) => c.type === "function").map(toToolCall);
    const text = keepKnownCitations(reply.content?.trim() ?? "", passages);
    return { reply, toolCalls, text, bad: unverifiedAmounts(text, allowedNumbers(history, passages, toolCalls)) };
  };

  let turn = await draft();
  if (turn.bad.length) {
    // One retry with the problem spelled out, then drop any sentence still carrying an unverified figure.
    turn = await draft([{ role: "user", content: `[Automated check] Your reply used figures not found in tool results, inputs, or sources: ${turn.bad.join(", ")}. Rewrite without them; for projections, call run_simulation and quote its results.` }]);
    if (turn.bad.length) turn.text = dropSentencesWith(turn.text, turn.bad);
  }

  const problems = inputProblems(history, session, turn.toolCalls);
  if (problems) {
    // One retry; if the model still assumes, drop those calls and ask the user ourselves.
    turn = await draft([{ role: "user", content: problems.message }]);
    if (turn.bad.length) turn.text = dropSentencesWith(turn.text, turn.bad);
    const still = inputProblems(history, session, turn.toolCalls);
    if (still) {
      turn.toolCalls = turn.toolCalls.filter((c) => !still.rejected.has(c.id) && !(still.missing.length && c.name === "run_simulation"));
      if (!turn.toolCalls.some((c) => c.name === "ask_user")) {
        const needed = still.missing.length ? still.missing.map((label) => label.toLowerCase()).join("; ") : "the actual amounts for each option";
        turn.text = `Before I run the numbers, I need these from you rather than guessing: ${needed}. What are they?`;
      }
    }
  }

  const kept = new Set(turn.toolCalls.map((c) => c.id));
  const rawCalls = turn.reply.tool_calls?.filter((c) => kept.has(c.id));
  const cited = new Set([...turn.text.matchAll(/\[([a-z0-9-]+)\]/g)].map((m) => m[1]));
  return {
    text: turn.text || undefined,
    toolCalls: turn.toolCalls,
    providerMessage: { ...turn.reply, content: turn.text || null, tool_calls: rawCalls?.length ? rawCalls : undefined },
    sources: passages.filter((p) => cited.has(p.source_id)).map(({ source_id, title, url }) => ({ source_id, title, url }))
      .filter((p, i, all) => all.findIndex((q) => q.source_id === p.source_id) === i),
  };
}
