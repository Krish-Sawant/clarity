import type { Field, Scenario, Values } from "../sim/scenarios.ts";
import type { TableRowKey } from "../sim/summary.ts";
import { fillLabels, scenarioById } from "./tools.ts";
import type { Agent, AgentTurn, ChatItem, Session, ToolCall } from "./types.ts";

// Scripted stand-in for the AI. It speaks the same tool protocol the real model
// will, so the UI is built once, and it doubles as an offline backup demo.
// Understanding is keyword- and number-based on purpose: it only needs to handle
// the demo flows, not arbitrary language.

let nextId = 0;
const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({ id: `call_${++nextId}`, name, args });

const RESULT_ROWS: TableRowKey[] = [
  "takeHome", "costs", "leftover", "upfront", "netWorth1y", "netWorth3y", "netWorthEnd", "debtFree", "emergencyFund", "lowestCash",
];
const WHAT_IF_ROWS: TableRowKey[] = ["leftover", "netWorthEnd", "debtFree", "lowestCash"];

/* ---------- Understanding text ---------- */

const ROUTES: [string, RegExp[]][] = [
  ["job-offer", [/\boffer/, /\bjob\b/, /salary/, /\bnyc\b|new york|pittsburgh|philly|philadelphia|chicago|austin|seattle/, /relocat/, /\$?\d{2,3}k\b/]],
  ["car", [/\bcar\b/, /vehicle/, /auto loan/, /repairs?/]],
  ["grad-school", [/grad(uate)? school/, /master'?s/, /\bmba\b/, /degree/, /\bphd\b/]],
  ["move-out", [/move out|moving out/, /parents/, /live at home|living at home|with my family/, /own (place|apartment)/]],
  ["debt-vs-save", [/credit card|card debt/, /pay (it )?off|pay down/, /emergency fund/, /save first|savings first/]],
];

export function routeQuestion(text: string): string | null {
  const t = text.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const [id, patterns] of ROUTES) {
    const score = patterns.filter((p) => p.test(t)).length;
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

const CITY_ALIASES: Record<string, RegExp> = {
  nyc: /\bnyc\b|new york|manhattan|brooklyn/i,
  pittsburgh: /pittsburgh|\bpgh\b/i,
  philadelphia: /philadelphia|philly/i,
  chicago: /chicago/i,
  austin: /austin/i,
  seattle: /seattle/i,
};

function citiesIn(text: string): string[] {
  return Object.entries(CITY_ALIASES)
    .map(([id, re]) => ({ id, at: text.search(re) }))
    .filter((c) => c.at >= 0)
    .sort((x, y) => x.at - y.at)
    .map((c) => c.id);
}

type Amount = { value: number; unit: "money" | "pct" | "years" | "months" | null };

export function parseAmounts(text: string): Amount[] {
  const re = /(\$)?\s?(\d+(?:,\d{3})*(?:\.\d+)?)\s?(k\b|thousand)?\s?(%|percent|years?\b|yrs?\b|months?\b|mos?\b)?/gi;
  return [...text.matchAll(re)].map((m) => {
    const value = Number(m[2].replace(/,/g, "")) * (m[3] ? 1000 : 1);
    const u = m[4]?.toLowerCase();
    let unit: Amount["unit"] = m[1] || m[3] ? "money" : null;
    if (u) unit = u === "%" || u.startsWith("percent") ? "pct" : u.startsWith("y") ? "years" : "months";
    return { value, unit };
  });
}

function fits(field: Field, a: Amount): boolean {
  if (field.kind === "percent") return a.unit === "pct" || (a.unit === null && a.value <= 100);
  if (field.kind === "months") return a.unit === "years" || a.unit === "months" || (a.unit === null && a.value <= 120);
  return a.unit === "money" || a.unit === null;
}

function toFieldValue(field: Field, a: Amount): number {
  if (field.kind === "months" && (a.unit === "years" || (a.unit === null && a.value <= 10))) return a.value * 12;
  return a.value;
}

const NEGATION = /\b(no|none|zero|nothing|don'?t|dont|funded)\b/i;

// Map free text onto a follow-up's fields: numbers in order, "no ..." means 0.
function answerFields(scenario: Scenario, fieldKeys: string[], text: string) {
  const amounts = parseAmounts(text);
  const used = new Set<number>();
  const values: Values = {};
  const assumed: string[] = [];
  for (const key of fieldKeys) {
    const field = scenario.fields.find((f) => f.key === key)!;
    const i = amounts.findIndex((a, idx) => !used.has(idx) && fits(field, a));
    if (i >= 0) {
      used.add(i);
      values[key] = toFieldValue(field, amounts[i]);
    } else if (field.kind === "money" && NEGATION.test(text)) {
      values[key] = 0;
    } else {
      assumed.push(field.label.toLowerCase());
    }
  }
  return { values, assumed };
}

/* ---------- Turns ---------- */

function lastAsk(history: ChatItem[]): ToolCall | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.role === "assistant" && item.toolCalls?.length) return item.toolCalls.find((c) => c.name === "ask_user");
  }
  return undefined;
}

function askFollowUp(scenario: Scenario, index: number, session: Session): ToolCall {
  const fu = scenario.followUps[index];
  return call("ask_user", {
    question: fillLabels(fu.question, session),
    choices: fu.choices.map((c) => fillLabels(c.label, session)),
    follow_up: index,
  });
}

const UNSUPPORTED =
  "I can't model that one yet. Right now I can compare two job offers or cities, buying a car vs keeping yours, " +
  "grad school vs working, moving out vs living at home, or paying off debt vs saving first. Tell me about one of those.";

function startScenario(scenario: Scenario, text: string): AgentTurn {
  const extracted: Values = {};
  if (scenario.id === "job-offer") {
    const [cityA, cityB] = citiesIn(text);
    const salaries = parseAmounts(text).filter((a) => a.value >= 20_000).map((a) => a.value);
    if (cityA) extracted.cityA = cityA;
    if (cityB) extracted.cityB = cityB;
    if (salaries[0]) extracted.salaryA = salaries[0];
    if (salaries[1]) extracted.salaryB = salaries[1];
  }
  const preview: Session = { scenarioId: scenario.id, values: { ...scenario.defaults, ...extracted }, years: scenario.defaultYears };
  const calls = [call("pick_scenario", { scenario_id: scenario.id })];
  if (Object.keys(extracted).length) calls.push(call("set_inputs", { values: extracted }));
  calls.push(askFollowUp(scenario, 0, preview));
  return {
    text: fillLabels(
      `Let's compare "{a}" vs "{b}". ${scenario.followUps.length} quick questions first; anything you skip gets a typical default you can change later.`,
      preview,
    ),
    toolCalls: calls,
  };
}

function answerTurn(scenario: Scenario, index: number, text: string, session: Session): AgentTurn {
  const fu = scenario.followUps[index];
  const choice = fu.choices.find((c) => fillLabels(c.label, session).toLowerCase() === text.trim().toLowerCase());
  let { values, assumed } = choice ? { values: choice.values, assumed: [] as string[] } : answerFields(scenario, fu.fields, text);

  // "Pittsburgh grows faster, maybe 10%" should land on option B's field.
  if (!choice && scenario.id === "job-offer" && fu.fields.every((k) => /[AB]$/.test(k))) {
    const mentions = citiesIn(text);
    const b = String(session.values.cityB);
    if (mentions.includes(b) && !mentions.includes(String(session.values.cityA))) {
      const [keyA, keyB] = fu.fields;
      if (keyA in values) values = { [keyB]: values[keyA] };
      assumed = [];
    }
  }

  const calls: ToolCall[] = [];
  if (Object.keys(values).length) calls.push(call("set_inputs", { values }));
  const note = assumed.length ? `I'll use typical values for ${assumed.join(" and ")}; you can change them on the card. ` : "Got it. ";
  const nextSession = { ...session, values: { ...session.values, ...values } };

  if (index + 1 < scenario.followUps.length) {
    calls.push(askFollowUp(scenario, index + 1, nextSession));
    return { text: note, toolCalls: calls };
  }
  calls.push(call("run_simulation"), call("show_playground"), call("show_table", { rows: RESULT_ROWS }), call("explain"));
  return {
    text: `${note}Here's how the two paths compare. Drag the sliders on the card to test your own assumptions, or ask me a what-if.`,
    toolCalls: calls,
  };
}

function whatIfValues(scenario: Scenario, text: string, session: Session) {
  const t = text.toLowerCase();
  const has = (key: string) => scenario.fields.some((f) => f.key === key);
  let side = "A";
  if (scenario.id === "job-offer") {
    const mentions = citiesIn(text);
    if (mentions.includes(String(session.values.cityB)) && !mentions.includes(String(session.values.cityA))) side = "B";
  }
  const key = (base: string) => (has(base) ? base : has(base + side) ? base + side : null);
  const amounts = parseAmounts(text);
  const money = amounts.find((a) => a.unit === "money" || a.unit === null);
  const pct = amounts.find((a) => a.unit === "pct");
  const out: Record<string, unknown> = {};

  const years = /\b(?:over|in|after)\s+(\d+)\s*(?:years?|yrs?)/.exec(t);
  if (years) out.years = Number(years[1]);
  if (/roommate/.test(t) && key("roommate")) out[key("roommate")!] = !/\bno roommate|without (a )?roommate/.test(t);
  if (/raise|promotion/.test(t) && pct) {
    const k = scenario.id === "grad-school" ? "raiseAfter" : key("raise");
    if (k) out[k] = pct.value;
  }
  if (/\brent\b/.test(t) && money && key("rent")) out[key("rent")!] = money.value;
  if (/salary|offer|\bpay\b/.test(t) && money && money.value >= 20_000 && key("salary")) out[key("salary")!] = money.value;

  // Fallback: a field whose label appears in the text, e.g. "what if the down payment is $5k".
  if (!Object.keys(out).length && amounts.length) {
    for (const f of scenario.fields) {
      const core = f.label.toLowerCase().replace(/\(.*?\)|\/.*$/g, "").trim();
      const a = amounts.find((x) => fits(f, x));
      if (core && t.includes(core) && a) {
        out[f.key] = toFieldValue(f, a);
        break;
      }
    }
  }
  return out;
}

function whatIfTurn(scenario: Scenario, text: string, session: Session): AgentTurn {
  const values = whatIfValues(scenario, text, session);
  if (!Object.keys(values).length) {
    return {
      text:
        "This demo assistant understands what-ifs like \"what if I get a roommate\", \"what if raises are 12%\", " +
        "\"what if rent is $2,000\" or \"over 10 years\", or a brand-new question. You can also drag the sliders on the card above.",
    };
  }
  return {
    text: "Here's the same comparison with that change:",
    toolCalls: [
      call("set_inputs", { values }),
      call("run_simulation"),
      call("show_chart", { metric: "netWorth", title: `What if: ${text.trim()}` }),
      call("show_table", { rows: WHAT_IF_ROWS }),
      call("explain"),
    ],
  };
}

export function decide(history: ChatItem[], session: Session): AgentTurn {
  const last = history.at(-1);
  // Our tools already ran for this message, so the turn is over.
  if (!last || last.role !== "user") return {};
  const text = last.text;
  const scenario = scenarioById(session.scenarioId);
  const ask = lastAsk(history);

  if (ask && typeof ask.args.follow_up === "number" && scenario) {
    return answerTurn(scenario, ask.args.follow_up, text, session);
  }

  const routed = routeQuestion(text);
  if (!scenario) {
    const target = scenarioById(routed);
    return target ? startScenario(target, text) : { text: UNSUPPORTED };
  }
  if (!/what if/i.test(text) && routed && routed !== scenario.id) return startScenario(scenarioById(routed)!, text);
  return whatIfTurn(scenario, text, session);
}

export const mockAgent: Agent = async (history, session) => {
  await new Promise((r) => setTimeout(r, 400));
  return decide(history, session);
};
