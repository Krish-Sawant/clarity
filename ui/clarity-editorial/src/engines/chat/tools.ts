import { futureYouMessage } from "../sim/message.ts";
import { compare } from "../sim/project.ts";
import { lookupScenario, parseCustomSpec, registerCustomScenario } from "../sim/custom.ts";
import { CITY_OPTIONS, SCENARIOS, type Scenario, type Values } from "../sim/scenarios.ts";
import { TABLE_ROW_KEYS, budgetRows, summarize, type TableRowKey } from "../sim/summary.ts";
import type { Block, ChartMetric, Session, Snapshot, ToolCall } from "./types.ts";

export type ToolOutcome = {
  result: unknown;
  session: Session;
  block?: Block;
  // ask_user ends the agent loop until the user replies.
  waitForUser?: boolean;
};

export const EMPTY_SESSION: Session = { scenarioId: null, values: {}, years: 5 };

const CHART_METRICS: ChartMetric[] = ["netWorth", "cash", "debt"];

export function scenarioById(id: string | null): Scenario | undefined {
  return lookupScenario(id);
}

export function simulate(snapshot: Snapshot) {
  const scenario = scenarioById(snapshot.scenarioId)!;
  const months = snapshot.years * 12;
  return { comparison: compare(...scenario.build(snapshot.values), months), months };
}

// Option labels for the current inputs, used to fill "{a}" / "{b}" in follow-up text.
export function fillLabels(text: string, session: Session): string {
  const scenario = scenarioById(session.scenarioId);
  if (!scenario) return text;
  const [a, b] = scenario.build(session.values);
  return text.replaceAll("{a}", a.label).replaceAll("{b}", b.label);
}

const snapshotOf = (s: Session): Snapshot => ({ scenarioId: s.scenarioId!, values: { ...s.values }, years: s.years });

function coerce(scenario: Scenario, key: string, raw: unknown): Values[string] | undefined {
  const field = scenario.fields.find((f) => f.key === key);
  if (!field) return undefined;
  if (field.kind === "city") return CITY_OPTIONS.some((c) => c.value === raw) ? String(raw) : undefined;
  if (field.kind === "toggle") return typeof raw === "boolean" ? raw : undefined;
  const num = Number(raw);
  if (!Number.isFinite(num)) return undefined;
  return Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, num));
}

export function runTool(call: ToolCall, session: Session): ToolOutcome {
  const args = call.args;
  const fail = (error: string, extra: object = {}): ToolOutcome => ({ result: { error, ...extra }, session });
  const scenario = scenarioById(session.scenarioId);
  const needsScenario = ["set_inputs", "run_simulation", "show_chart", "show_table", "show_playground", "show_breakdown", "explain"];
  if (needsScenario.includes(call.name) && !scenario) return fail("No scenario picked yet. Call pick_scenario first.");

  switch (call.name) {
    case "pick_scenario": {
      const picked = scenarioById(String(args.scenario_id));
      if (!picked) return fail("Unknown scenario.", { available: SCENARIOS.map((s) => s.id) });
      const next = { scenarioId: picked.id, values: { ...picked.defaults }, years: picked.defaultYears };
      return {
        session: next,
        result: {
          scenario_id: picked.id,
          options: picked.groupLabels,
          fields: picked.fields.map((f) => ({ key: f.key, label: f.label, kind: f.kind, min: f.min, max: f.max, default: picked.defaults[f.key] })),
          ask_about: picked.followUps.map((f) => ({ question: fillLabels(f.question, next), fields: f.fields })),
        },
      };
    }

    case "define_comparison": {
      const parsed = parseCustomSpec(args);
      if ("error" in parsed) return fail(parsed.error);
      const custom = registerCustomScenario(parsed.spec);
      const next = { scenarioId: custom.id, values: { ...custom.defaults }, years: custom.defaultYears };
      return {
        session: next,
        result: {
          scenario_id: custom.id,
          options: custom.groupLabels,
          fields: custom.fields.map((f) => ({ key: f.key, label: f.label, value: custom.defaults[f.key] })),
          assumptions: custom.assumptions,
        },
      };
    }

    case "set_inputs": {
      const input = (args.values ?? {}) as Record<string, unknown>;
      let values = { ...session.values };
      let years = session.years;
      const applied: Record<string, unknown> = {};
      const rejected: string[] = [];
      for (const [key, raw] of Object.entries(input)) {
        if (key === "years") {
          const y = Math.round(Number(raw));
          if (y >= 1 && y <= 10) years = applied.years = y;
          else rejected.push(key);
          continue;
        }
        const v = coerce(scenario!, key, raw);
        if (v === undefined) {
          rejected.push(key);
          continue;
        }
        values = { ...values, [key]: v };
        values = { ...values, ...scenario!.derive?.(key, values) };
        applied[key] = v;
      }
      return { session: { ...session, values, years }, result: { applied, rejected } };
    }

    case "ask_user": {
      const choices = Array.isArray(args.choices) ? args.choices.map(String).slice(0, 5) : [];
      return {
        session,
        result: { shown: true },
        block: { type: "question", text: String(args.question ?? ""), choices },
        waitForUser: true,
      };
    }

    case "run_simulation": {
      const { comparison, months } = simulate(snapshotOf(session));
      return { session, result: summarize(comparison, months) };
    }

    case "show_chart": {
      const metric = CHART_METRICS.includes(args.metric as ChartMetric) ? (args.metric as ChartMetric) : "netWorth";
      const title = typeof args.title === "string" ? args.title : undefined;
      return { session, result: { shown: true }, block: { type: "chart", snapshot: snapshotOf(session), metric, title } };
    }

    case "show_table": {
      const valid = new Set<unknown>(TABLE_ROW_KEYS);
      const asked = Array.isArray(args.rows) ? args.rows.filter((r): r is TableRowKey => valid.has(r)) : [];
      const rows = asked.length ? asked : TABLE_ROW_KEYS;
      return { session, result: { shown: true, rows }, block: { type: "table", snapshot: snapshotOf(session), rows } };
    }

    case "show_playground":
      return { session, result: { shown: true }, block: { type: "playground", snapshot: snapshotOf(session) } };

    case "show_breakdown": {
      const snapshot = snapshotOf(session);
      const { comparison } = simulate(snapshot);
      const rows = budgetRows(scenario!.build(snapshot.values), comparison);
      return { session, result: { shown: true, month_1_budget: rows }, block: { type: "breakdown", snapshot } };
    }

    case "explain": {
      // Template text for now; the AI-written version must pass a number check against run_simulation's results.
      const { comparison, months } = simulate(snapshotOf(session));
      const lines = futureYouMessage(comparison, months);
      return { session, result: { shown: true }, block: { type: "message", lines } };
    }

    default:
      return fail(`Unknown tool "${call.name}".`);
  }
}
