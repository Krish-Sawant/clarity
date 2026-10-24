/** The merged scenario, projection and scripted-chat modules remain the source of truth. */
import { SCENARIOS, CITY_OPTIONS, type Field, type Scenario, type Values } from "../../../../frontend/src/lib/sim/scenarios";
import { compare } from "../../../../frontend/src/lib/sim/project";
import { futureYouMessage } from "../../../../frontend/src/lib/sim/message";
import { TABLE_ROW_KEYS, TABLE_ROWS, summarize, type TableRow, type TableRowKey } from "../../../../frontend/src/lib/sim/summary";
import { runAgentLoop, type LoopEvent } from "../../../../frontend/src/lib/chat/loop";
import { mockAgent } from "../../../../frontend/src/lib/chat/mockAgent";
import type { Block, ChartMetric, ChatItem, Session, Snapshot } from "../../../../frontend/src/lib/chat/types";

export type { Block, ChartMetric, ChatItem, Field, LoopEvent, Scenario, Session, Snapshot, TableRowKey, Values };
export const decisionScenarios = SCENARIOS;
export const decisionCities = CITY_OPTIONS;

export function getDecisionScenario(id: unknown): Scenario {
  if (typeof id !== "string") throw new Error("Choose a supported comparison.");
  const scenario = SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new Error("Choose a supported comparison.");
  return scenario;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readDecisionField(field: Field, raw: unknown): Values[string] {
  if (field.kind === "city") {
    if (typeof raw !== "string" || !CITY_OPTIONS.some((city) => city.value === raw)) throw new Error(`${field.label}: choose one of the listed cities.`);
    return raw;
  }
  if (field.kind === "toggle") {
    if (typeof raw !== "boolean") throw new Error(`${field.label}: choose on or off.`);
    return raw;
  }
  if ((typeof raw !== "number" && typeof raw !== "string") || typeof raw === "string" && raw.trim() === "") throw new Error(`${field.label}: enter a number; blank is not zero.`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < (field.min ?? 0) || value > (field.max ?? 1_000_000)) throw new Error(`${field.label}: use a number from ${field.min ?? 0} to ${field.max ?? 1_000_000}.`);
  if (field.kind === "months" && !Number.isInteger(value)) throw new Error(`${field.label}: use a whole number of months.`);
  return value;
}

function readYears(raw: unknown): number {
  if ((typeof raw !== "string" && typeof raw !== "number") || typeof raw === "string" && raw.trim() === "") throw new Error("Comparison horizon: enter a whole number from 1 to 10 years.");
  const years = Number(raw);
  if (!Number.isInteger(years) || years < 1 || years > 10) throw new Error("Comparison horizon: enter a whole number from 1 to 10 years.");
  return years;
}

/** Defaults are explicitly synthetic; overrides must be known, typed, bounded fields. */
export function createDecisionSession(scenarioId: unknown, overrides: unknown = {}, years?: unknown): Session {
  const scenario = getDecisionScenario(scenarioId);
  if (!record(overrides)) throw new Error("Comparison inputs must be an object of named fields.");
  const keys = new Set(scenario.fields.map((field) => field.key));
  if (Object.keys(overrides).some((key) => !keys.has(key))) throw new Error("An input is not part of this comparison.");
  const input = { ...scenario.defaults, ...overrides };
  const values: Values = {};
  for (const field of scenario.fields) values[field.key] = readDecisionField(field, input[field.key]);
  return { scenarioId: scenario.id, values, years: readYears(years ?? scenario.defaultYears) };
}

/** Source derive rules (such as city → typical rent) run only on deliberate edits. */
export function updateDecisionSession(session: Session, key: string, raw: unknown): Session {
  const current = createDecisionSession(session.scenarioId, session.values, session.years);
  const scenario = getDecisionScenario(current.scenarioId);
  const field = scenario.fields.find((item) => item.key === key);
  if (!field) throw new Error("That input is not part of this comparison.");
  const values = { ...current.values, [key]: readDecisionField(field, raw) };
  return createDecisionSession(scenario.id, { ...values, ...scenario.derive?.(key, values) }, current.years);
}

export function getDecisionResult(snapshot: Snapshot | Session) {
  const valid = createDecisionSession(snapshot.scenarioId, snapshot.values, snapshot.years);
  const scenario = getDecisionScenario(valid.scenarioId);
  const months = valid.years * 12;
  const comparison = compare(...scenario.build(valid.values), months);
  for (const projection of [comparison.a, comparison.b]) {
    if (projection.points.length !== months + 1 || !projection.points.every((point) => [point.cash, point.debt, point.assets, point.netWorth, point.income, point.costs, point.debtPayments].every(Number.isFinite))) throw new Error("The comparison could not produce a valid projection. Review the inputs.");
  }
  return {
    scenario, snapshot: { scenarioId: scenario.id, values: { ...valid.values }, years: valid.years }, months, comparison,
    summary: summarize(comparison, months), lines: futureYouMessage(comparison, months),
  };
}

export type DecisionResult = ReturnType<typeof getDecisionResult>;

export function decisionTableRows(months: number, requested: TableRowKey[] = TABLE_ROW_KEYS) {
  const valid = new Set<string>(TABLE_ROW_KEYS);
  return requested.filter((key) => valid.has(key)).map((key) => ({ key, row: TABLE_ROWS[key] as TableRow })).filter(({ row }) => months >= Math.max(12, row.minMonths ?? 0));
}

/** Local mock agent only. It has no model call or action-execution tools. */
export async function runDecisionChat(
  history: ChatItem[], session: Session | null, message: string,
  onEvent?: (event: LoopEvent) => void,
) {
  if (typeof message !== "string" || !message.trim() || message.trim().length > 1200) throw new Error("Ask a comparison question using 1–1,200 characters.");
  const initial: Session = session?.scenarioId
    ? createDecisionSession(session.scenarioId, session.values, session.years)
    : { scenarioId: null, values: {}, years: 5 };
  const events: LoopEvent[] = [];
  const input: ChatItem[] = [...structuredClone(history), { role: "user", text: message.trim() }];
  const output = await runAgentLoop(mockAgent, input, initial, (event) => {
    const frozen = structuredClone(event);
    events.push(frozen);
    onEvent?.(frozen);
  });
  const validatedSession = output.session.scenarioId ? createDecisionSession(output.session.scenarioId, output.session.values, output.session.years) : output.session;
  return { history: output.history, session: validatedSession, events };
}
